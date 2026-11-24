"""Server-side Distributed Rate Limiting Module with Atomic Redis Lua Script and In-Memory Fallback.

Design & Security Controls:
1. Atomic Sliding Window: Enforced via atomic Redis Lua script. Eliminates race conditions
   between read, add, and expire operations under concurrent bursts.
2. Member Uniqueness: Each request is stored with a unique microsecond nonce (now:uuid),
   guaranteeing that multiple requests within the same millisecond are counted distinctly.
3. Trustworthy Client IP: Forwarded headers (X-Forwarded-For, X-Real-IP) are ONLY trusted
   when the direct socket peer (request.client.host) is a verified trusted proxy (loopback,
   Docker private networks, local subnet). Direct untrusted connections cannot bypass rate
   limits by spoofing X-Forwarded-For.
4. Deliberate Failure Policy:
   - For public / sensitive endpoints (fail_closed=True), critical protection is preserved.
   - For general operational endpoints (fail_closed=False), falls back to thread-safe local
     sliding window to prevent platform-wide outages during transient Redis hiccups.
5. Whitelisting: Legitimate Telegram webhooks and internal health endpoints are excluded.
6. Returns HTTP 429 Too Many Requests with an accurate Retry-After header.
"""

from collections import defaultdict
import ipaddress
import threading
import time
from typing import Callable, Optional
import uuid
from fastapi import HTTPException, Request, status

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# Atomic Redis Lua script for sliding window rate limiting
SLIDING_WINDOW_LUA = """
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]
local clearBefore = now - window

-- 1. Remove expired entries outside the sliding window
redis.call('ZREMRANGEBYSCORE', key, '-inf', clearBefore)

-- 2. Check current count in window
local current = redis.call('ZCARD', key)

if current < limit then
    -- 3. Allowed: record this request and refresh TTL
    redis.call('ZADD', key, now, member)
    redis.call('EXPIRE', key, math.ceil(window) + 5)
    return {1, 0}
else
    -- 4. Exceeded: calculate exact Retry-After from oldest entry
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    local retryAfter = 1
    if oldest and #oldest >= 2 then
        retryAfter = math.ceil(window - (now - tonumber(oldest[2])))
        if retryAfter < 1 then retryAfter = 1 end
    end
    return {0, retryAfter}
end
"""

def get_trusted_proxy_networks() -> list[ipaddress.IPv4Network | ipaddress.IPv6Network]:
    """Parse configured trusted proxy networks from settings.trusted_proxies.

    Defaults strictly to loopback (127.0.0.0/8, ::1/128) unless explicitly configured.
    RFC1918 private subnets are NOT trusted by default to prevent lateral spoofing.
    """
    raw_config = getattr(settings, "trusted_proxies", "127.0.0.1,::1") or "127.0.0.1,::1"
    networks: list[ipaddress.IPv4Network | ipaddress.IPv6Network] = []

    for item in raw_config.split(","):
        clean_item = item.strip()
        if not clean_item:
            continue
        try:
            if "/" in clean_item:
                networks.append(ipaddress.ip_network(clean_item, strict=False))
            else:
                ip_obj = ipaddress.ip_address(clean_item)
                if isinstance(ip_obj, ipaddress.IPv4Address):
                    networks.append(ipaddress.ip_network(f"{clean_item}/32"))
                else:
                    networks.append(ipaddress.ip_network(f"{clean_item}/128"))
        except ValueError:
            logger.warning("Invalid trusted proxy network configuration ignored: %s", clean_item)

    if not networks:
        # Fallback strictly to loopback
        networks = [
            ipaddress.ip_network("127.0.0.0/8"),
            ipaddress.ip_network("::1/128"),
        ]
    return networks


def is_trusted_proxy_peer(peer_ip: str) -> bool:
    """Return True if peer_ip belongs to explicitly configured trusted reverse proxy."""
    if not peer_ip:
        return False
    try:
        ip = ipaddress.ip_address(peer_ip)
        trusted_nets = get_trusted_proxy_networks()
        return any(ip in net for net in trusted_nets)
    except ValueError:
        return False


def get_trustworthy_client_ip(request: Request) -> str:
    """Extract trustworthy client IP with right-to-left reverse proxy traversal.

    Security Rules:
    1. If the direct socket peer (request.client.host) is NOT a trusted proxy,
       all client-supplied X-Forwarded-For or X-Real-IP headers are IGNORED.
       The direct socket peer is returned.
    2. If the direct socket peer is a trusted proxy:
       Walk X-Forwarded-For hops from right to left (most recent proxy backwards).
       The first IP encountered that is NOT in trusted_proxies is the authentic client IP.
       Any IPs to the left of this client IP were supplied by the client and cannot be trusted.
    3. All candidate IPs must be cryptographically / syntactically valid IPv4 or IPv6 addresses.
    """
    direct_peer = request.client.host if request.client else "127.0.0.1"

    # Validate direct peer syntax
    try:
        ipaddress.ip_address(direct_peer)
    except ValueError:
        return "127.0.0.1"

    if not is_trusted_proxy_peer(direct_peer):
        # Untrusted direct caller: cannot spoof forwarded headers
        return direct_peer

    # Peer is a trusted reverse proxy: evaluate forwarded headers
    xff = request.headers.get("x-forwarded-for")
    if xff:
        hops = [h.strip() for h in xff.split(",") if h.strip()]
        # Walk from right to left
        for hop in reversed(hops):
            try:
                ip_obj = ipaddress.ip_address(hop)
                if not is_trusted_proxy_peer(str(ip_obj)):
                    # Found the authentic client that connected to our trusted proxy chain
                    return str(ip_obj)
            except ValueError:
                # Malformed IP entry, skip
                continue

    # Fallback to X-Real-IP if provided by trusted proxy
    x_real_ip = request.headers.get("x-real-ip")
    if x_real_ip:
        clean_real = x_real_ip.strip()
        try:
            ip_obj = ipaddress.ip_address(clean_real)
            return str(ip_obj)
        except ValueError:
            pass

    return direct_peer


class SlidingWindowRateLimiter:
    """Distributed sliding window rate limiter with atomic Lua script and in-memory fallback."""

    def __init__(self):
        self._lock = threading.Lock()
        self._memory_store: dict[str, list[float]] = defaultdict(list)
        self._redis_client = None
        self._redis_checked = False
        self._lua_sha = None

    def _get_redis(self):
        if not self._redis_checked:
            self._redis_checked = True
            try:
                import redis
                client = redis.Redis.from_url(
                    settings.redis_url,
                    socket_connect_timeout=0.5,
                    socket_timeout=0.5,
                    decode_responses=True,
                )
                client.ping()
                self._redis_client = client
                try:
                    self._lua_sha = client.script_load(SLIDING_WINDOW_LUA)
                except Exception:
                    self._lua_sha = None
                logger.info("RateLimiter: Connected to Redis and initialized atomic Lua script.")
            except Exception as e:
                logger.warning(
                    "RateLimiter: Redis unavailable (%s). Operating in-memory fallback mode.", e
                )
                self._redis_client = None
        return self._redis_client

    def is_allowed(
        self,
        key: str,
        max_requests: int,
        window_seconds: int,
        fail_closed: bool = False,
    ) -> tuple[bool, int]:
        """Check if request is allowed under sliding window.

        Returns:
            (is_allowed, retry_after_seconds)
        """
        now = time.time()
        client = self._get_redis()

        if client is not None:
            try:
                redis_key = f"ratelimit:{key}"
                member = f"{now}:{uuid.uuid4().hex[:8]}"

                if self._lua_sha:
                    res = client.evalsha(self._lua_sha, 1, redis_key, now, window_seconds, max_requests, member)
                else:
                    res = client.eval(SLIDING_WINDOW_LUA, 1, redis_key, now, window_seconds, max_requests, member)

                allowed = bool(res[0])
                retry_after = int(res[1])
                return allowed, retry_after
            except Exception as e:
                logger.warning("RateLimiter: Redis error during atomic check (%s).", e)
                if fail_closed:
                    # Enforce strict fail-closed for brute-force sensitive endpoints
                    logger.error("RateLimiter: Fail-closed policy triggered for key %s", key)
                    return False, 60
                # Fall through to in-memory implementation
        elif fail_closed:
            # Enforce strict fail-closed when Redis is unavailable for sensitive operations
            logger.error("RateLimiter: Fail-closed policy triggered for key %s (Redis unavailable)", key)
            return False, 60

        # In-memory sliding window fallback (thread-safe)
        with self._lock:
            cutoff = now - window_seconds
            timestamps = [t for t in self._memory_store[key] if t > cutoff]
            if len(timestamps) >= max_requests:
                earliest = timestamps[0] if timestamps else cutoff
                retry_after = int(window_seconds - (now - earliest))
                self._memory_store[key] = timestamps
                return False, max(1, retry_after)

            timestamps.append(now)
            self._memory_store[key] = timestamps
            return True, 0

    def reset(self, key: str) -> None:
        """Reset rate limit for a given key (e.g. after successful login)."""
        client = self._get_redis()
        if client is not None:
            try:
                client.delete(f"ratelimit:{key}")
            except Exception:
                pass

        with self._lock:
            self._memory_store.pop(key, None)


limiter = SlidingWindowRateLimiter()


def require_rate_limit(
    key_prefix: str,
    max_requests: int = 60,
    window_seconds: int = 60,
    key_func: Optional[Callable[[Request], str]] = None,
    fail_closed: bool = False,
):
    """FastAPI dependency for endpoint-level rate limiting."""

    async def _rate_limit_dependency(request: Request):
        # Whitelist internal webhooks and health endpoints
        path = request.url.path
        if path.startswith("/telegram/webhook") or path.startswith("/webhooks/tezcheck") or path == "/health":
            return

        if key_func is not None:
            identifier = key_func(request)
        else:
            identifier = get_trustworthy_client_ip(request)

        rate_key = f"{key_prefix}:{identifier}"
        allowed, retry_after = limiter.is_allowed(rate_key, max_requests, window_seconds, fail_closed=fail_closed)
        if not allowed:
            logger.warning(
                "Rate limit exceeded: key=%s path=%s max=%s window=%ss retry_after=%ss",
                rate_key,
                path,
                max_requests,
                window_seconds,
                retry_after,
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="So'rovlar soni me'yoridan oshdi. Iltimos, birozdan so'ng qayta urinib ko'ring.",
                headers={"Retry-After": str(retry_after)},
            )

    return _rate_limit_dependency
