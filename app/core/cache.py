"""Thread-safe bounded LRU + TTL cache for in-process hot paths and Redis fallbacks."""

from __future__ import annotations

from collections import OrderedDict
from collections.abc import Iterator, MutableMapping
import threading
import time
from typing import TypeVar

K = TypeVar("K")
V = TypeVar("V")
_MISSING = object()


class BoundedTTLCache(MutableMapping[K, V]):
    """In-memory thread-safe OrderedDict with hard maxsize LRU eviction and optional TTL expiry."""

    def __init__(self, *, maxsize: int = 1024, ttl_seconds: float | None = None) -> None:
        if maxsize < 1:
            raise ValueError("maxsize must be >= 1")
        self.maxsize = int(maxsize)
        self.ttl_seconds = float(ttl_seconds) if ttl_seconds is not None and ttl_seconds > 0 else None
        self._data: OrderedDict[K, tuple[float | None, V]] = OrderedDict()
        self._lock = threading.RLock()

    def _compute_expiry(self, ttl_seconds: float | None = None) -> float | None:
        ttl = self.ttl_seconds if ttl_seconds is None else (float(ttl_seconds) if ttl_seconds > 0 else None)
        if ttl is None:
            return None
        return time.monotonic() + ttl

    def _prune_expired_locked(self, now: float | None = None) -> int:
        if now is None:
            now = time.monotonic()
        expired_keys = [k for k, (exp, _) in self._data.items() if exp is not None and exp <= now]
        for k in expired_keys:
            self._data.pop(k, None)
        return len(expired_keys)

    def prune_expired(self) -> int:
        """Remove all expired entries and return the count evicted."""
        with self._lock:
            return self._prune_expired_locked()

    def set(self, key: K, value: V, ttl_seconds: float | None = None) -> None:
        """Store or overwrite `key` with optional per-item TTL override and enforce `maxsize`."""
        with self._lock:
            now = time.monotonic()
            exp = self._compute_expiry(ttl_seconds)
            if key in self._data:
                self._data.move_to_end(key)
            self._data[key] = (exp, value)
            if len(self._data) > self.maxsize:
                self._prune_expired_locked(now)
            while len(self._data) > self.maxsize:
                self._data.popitem(last=False)

    def get(self, key: K, default: V | object = None) -> V | object:  # type: ignore[override]
        with self._lock:
            entry = self._data.get(key, _MISSING)
            if entry is _MISSING:
                return default
            exp, value = entry  # type: ignore[misc]
            if exp is not None and exp <= time.monotonic():
                self._data.pop(key, None)
                return default
            self._data.move_to_end(key)
            return value

    def __getitem__(self, key: K) -> V:
        val = self.get(key, _MISSING)
        if val is _MISSING:
            raise KeyError(key)
        return val  # type: ignore[return-value]

    def __setitem__(self, key: K, value: V) -> None:
        self.set(key, value)

    def __delitem__(self, key: K) -> None:
        with self._lock:
            del self._data[key]

    def __contains__(self, key: object) -> bool:
        with self._lock:
            entry = self._data.get(key, _MISSING)  # type: ignore[arg-type]
            if entry is _MISSING:
                return False
            exp, _ = entry  # type: ignore[misc]
            if exp is not None and exp <= time.monotonic():
                self._data.pop(key, None)  # type: ignore[arg-type]
                return False
            return True

    def __len__(self) -> int:
        with self._lock:
            self._prune_expired_locked()
            return len(self._data)

    def __iter__(self) -> Iterator[K]:
        with self._lock:
            self._prune_expired_locked()
            return iter(list(self._data.keys()))

    def pop(self, key: K, default: V | object = _MISSING) -> V | object:  # type: ignore[override]
        with self._lock:
            entry = self._data.pop(key, _MISSING)
            if entry is _MISSING:
                if default is _MISSING:
                    raise KeyError(key)
                return default
            exp, value = entry  # type: ignore[misc]
            if exp is not None and exp <= time.monotonic():
                if default is _MISSING:
                    raise KeyError(key)
                return default
            return value

    def clear(self) -> None:
        with self._lock:
            self._data.clear()
