"""Central Bank of Uzbekistan (CBU) Reference Exchange Rate Service.

Official Data Source:
https://cbu.uz/uz/arkhiv-kursov-valyut/json/

STRICT FINANCIAL ARCHITECTURE POLICY:
- This service provides USD/UZS reference rates EXCLUSIVELY for internal financial analytics,
  cost budgeting (e.g. tracking LLM API consumption costs in USD vs revenue in UZS), and reporting.
- Customer-facing domestic tariff prices in Uzbekistan are CONTRACTUALLY FIXED IN UZS by administrators.
- Exchange-rate data must NEVER automatically determine, adjust, or peg customer-facing domestic selling prices.
- Never use stale, estimated, or unverified rates for any financial charge.
"""

from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Any, Dict, Optional
import httpx

from app.core.logging import get_logger

logger = get_logger(__name__)

CBU_API_URL = "https://cbu.uz/uz/arkhiv-kursov-valyut/json/"
DEFAULT_CACHE_TTL_SECONDS = 3600  # 1 hour cache
STALE_THRESHOLD_HOURS = 24       # Flag stale if older than 24 hours


class CbuCurrencyService:
    """Manages resilient retrieval, caching, and staleness detection of CBU reference rates."""

    def __init__(self, api_url: str = CBU_API_URL, cache_ttl_seconds: int = DEFAULT_CACHE_TTL_SECONDS):
        self.api_url = api_url
        self.cache_ttl_seconds = cache_ttl_seconds
        self._cached_rate: Optional[Decimal] = None
        self._cached_date_str: Optional[str] = None
        self._last_successful_update: Optional[datetime] = None
        self._last_attempt: Optional[datetime] = None
        self._last_error: Optional[str] = None
        self._cache_expires_at: Optional[datetime] = None

    async def get_usd_reference_rate(self, force_refresh: bool = False) -> Dict[str, Any]:
        """Fetch current USD/UZS reference rate from CBU or return valid cache with staleness flag.

        Returns:
            dict containing:
                - rate: float (e.g. 12850.00)
                - currency: "USD"
                - base_currency: "UZS"
                - rate_date: str (date reported by CBU)
                - last_successful_update: ISO timestamp
                - is_stale: bool (True if data is older than threshold or fallback used)
                - source: "cbu_live" | "cbu_cached" | "cbu_stale_fallback"
                - usage_disclaimer: statement of internal analytics use only
        """
        now = datetime.now(timezone.utc)
        self._last_attempt = now

        # 1. Return valid cache if available and not forcing refresh
        if not force_refresh and self._cached_rate is not None and self._cache_expires_at and now < self._cache_expires_at:
            is_stale = self._check_is_stale(now)
            return self._build_response_payload(source="cbu_cached", is_stale=is_stale)

        # 2. Attempt fetching from official CBU API
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(self.api_url, headers={"User-Agent": "Selloi-FinanceEngine/1.0"})
                if resp.status_code == 200:
                    data = resp.json()
                    usd_entry = next((item for item in data if item.get("Ccy") == "USD"), None)
                    if usd_entry and "Rate" in usd_entry:
                        raw_rate = str(usd_entry["Rate"]).strip().replace(",", ".")
                        rate_val = Decimal(raw_rate)
                        self._cached_rate = rate_val
                        self._cached_date_str = usd_entry.get("Date", now.strftime("%d.%m.%Y"))
                        self._last_successful_update = now
                        self._cache_expires_at = now + timedelta(seconds=self.cache_ttl_seconds)
                        self._last_error = None

                        logger.info("CBU USD reference rate updated: 1 USD = %s UZS (Date: %s)", rate_val, self._cached_date_str)
                        return self._build_response_payload(source="cbu_live", is_stale=False)
                    else:
                        raise ValueError("CBU response missing USD entry or Rate attribute.")
                else:
                    raise httpx.HTTPStatusError(f"CBU API HTTP {resp.status_code}", request=resp.request, response=resp)

        except Exception as exc:
            self._last_error = str(exc)
            logger.warning("CBU currency API fetch failed (%s). Checking fallback cache.", exc)

            # 3. Fallback to existing cached rate if present (marked stale)
            if self._cached_rate is not None:
                return self._build_response_payload(source="cbu_stale_fallback", is_stale=True, error=str(exc))

            # 4. Ultimate fallback if cold start fails without cache
            # Use safe historical reference rate (12,800 UZS) marked strictly stale
            fallback_rate = Decimal("12800.00")
            return {
                "success": False,
                "currency": "USD",
                "base_currency": "UZS",
                "rate": float(fallback_rate),
                "rate_date": "UNAVAILABLE",
                "last_successful_update": None,
                "last_attempt": now.isoformat(),
                "is_stale": True,
                "source": "cold_start_fallback",
                "error": f"CBU API unreachable: {exc}",
                "policy_notice": "Internal analytics only. Domestic UZS prices are administratively fixed and independent of exchange rates."
            }

    def _check_is_stale(self, now: datetime) -> bool:
        if not self._last_successful_update:
            return True
        age = now - self._last_successful_update
        return age > timedelta(hours=STALE_THRESHOLD_HOURS)

    def _build_response_payload(self, source: str, is_stale: bool, error: Optional[str] = None) -> Dict[str, Any]:
        return {
            "success": True,
            "currency": "USD",
            "base_currency": "UZS",
            "rate": float(self._cached_rate) if self._cached_rate else 12800.0,
            "rate_date": self._cached_date_str,
            "last_successful_update": self._last_successful_update.isoformat() if self._last_successful_update else None,
            "last_attempt": self._last_attempt.isoformat() if self._last_attempt else None,
            "is_stale": is_stale,
            "source": source,
            "error": error,
            "policy_notice": "Internal analytics only. Domestic UZS prices are administratively fixed and independent of exchange rates."
        }


cbu_currency_service = CbuCurrencyService()
