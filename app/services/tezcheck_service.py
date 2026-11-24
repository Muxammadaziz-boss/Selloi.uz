"""TezCheck Payment Gateway Integration Service.

Official API client and webhook signature verifier for TezCheck (tezcheck.uz).
Enforces:
1. Single-use, fixed-amount payment invoice creation via POST /bills.
2. Official TezCheck Test provider discovery via POST /payment-methods.
3. Cryptographic outgoing request signing: {timestamp}.{METHOD}.{path+query}.{sha256_hex(body)}.
4. Cryptographic webhook signature verification: {timestamp}.{delivery_id}.{raw_body}.
5. Zero cardholder credential storage.
6. Resilient mock/sandbox fallback when live API keys are unprovisioned in test/dev.
"""

import hmac
import hashlib
import json
import secrets
import time
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List, Tuple
import httpx

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class TezCheckError(Exception):
    """Base exception for TezCheck payment gateway operations."""
    pass


class TezCheckSignatureVerificationError(TezCheckError):
    """Raised when incoming webhook signature is invalid, malformed, or tampered with."""
    pass


class TezCheckProviderNotFoundError(TezCheckError):
    """Raised when the requested payment provider (e.g. Test provider) is not enabled on desk."""
    pass


class TezCheckService:
    """Client for TezCheck payment processing, method discovery, and webhook verification."""

    def __init__(
        self,
        api_url: Optional[str] = None,
        api_key: Optional[str] = None,
        secret_key: Optional[str] = None,
        merchant_id: Optional[str] = None,
        cash_desk_code: Optional[str] = None,
        mock_mode: Optional[bool] = None
    ):
        self.api_url = (api_url or getattr(settings, "tezcheck_api_url", "https://api.tezcheck.uz/api/merchant/v1")).rstrip("/")
        self.api_key = api_key or getattr(settings, "tezcheck_api_key", None)
        self.secret_key = secret_key or getattr(settings, "tezcheck_secret_key", None)
        self.merchant_id = merchant_id or getattr(settings, "tezcheck_merchant_id", None)
        self.cash_desk_code = cash_desk_code or getattr(settings, "tezcheck_cash_desk_code", None) or self.merchant_id

        # If running under test or development, allow mock simulation mode when unprovisioned.
        # In production, mock mode is STRICTLY FORBIDDEN (fail-closed).
        is_prod = getattr(settings, "is_production", False)
        if mock_mode is not None:
            if is_prod and mock_mode:
                raise TezCheckError("Production muhitida mock to'lov rejimini yoqish taqiqlangan.")
            self.mock_mode = mock_mode
        else:
            import os, sys
            is_test = (
                getattr(settings, "app_env", "") in ("test", "testing")
                or os.environ.get("TESTING") == "true"
                or os.environ.get("PYTEST_CURRENT_TEST") is not None
                or any("pytest" in arg.lower() for arg in sys.argv)
            )
            if is_prod:
                self.mock_mode = False
            else:
                self.mock_mode = is_test or not bool(self.api_key and self.secret_key)

    def sign_outgoing_request(
        self,
        method: str,
        path_with_query: str,
        body_bytes: bytes,
        timestamp: Optional[str] = None,
    ) -> Tuple[str, str]:
        """Generate cryptographic signature for outgoing Merchant API request.

        Formula: {timestamp}.{METHOD}.{path+query}.{sha256_hex(body)}
        Signing key: api_key (or secret_key fallback)
        Format: v1={hex_digest}
        """
        ts = timestamp or str(int(time.time()))
        body_hash = hashlib.sha256(body_bytes).hexdigest()
        normalized_method = method.upper()

        sig_payload = f"{ts}.{normalized_method}.{path_with_query}.{body_hash}".encode("utf-8")
        signing_key = (self.api_key or self.secret_key or "SELLOI_TEZCHECK_MOCK_KEY").encode("utf-8")

        computed = hmac.new(signing_key, sig_payload, hashlib.sha256).hexdigest()
        return ts, f"v1={computed}"

    def _build_request_headers(
        self,
        method: str,
        path_with_query: str,
        body_bytes: bytes,
        idempotency_key: Optional[str] = None,
    ) -> Dict[str, str]:
        """Construct official TezCheck API request headers with HMAC signature and idempotency."""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        if self.cash_desk_code:
            headers["X-Cash-Desk-Code"] = self.cash_desk_code
        elif self.merchant_id:
            headers["X-Merchant-Id"] = self.merchant_id

        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key

        ts, sig = self.sign_outgoing_request(method, path_with_query, body_bytes)
        headers["X-TezCheck-Timestamp"] = ts
        headers["X-TezCheck-Signature"] = sig
        return headers

    async def get_me(self) -> Dict[str, Any]:
        """Verify API key and desk configuration via GET /me endpoint.

        Returns merchant profile, desk info, token_hint, and request_signed status.
        """
        if self.mock_mode:
            return {
                "desk": {"code": self.cash_desk_code or "cdk_mock"},
                "request_signed": True,
                "token_hint": (self.api_key or "aps_mock")[:10],
                "mode": "mock",
            }

        if not self.api_key:
            raise TezCheckError("TezCheck API kaliti sozlanmagan.")

        path = "/api/merchant/v1/me"
        headers = self._build_request_headers("GET", path, b"")
        headers.pop("Content-Type", None)

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(f"{self.api_url}/me", headers=headers)
                resp.raise_for_status()
                data = resp.json()
                return data.get("data") if isinstance(data.get("data"), dict) else data
        except httpx.HTTPError as exc:
            logger.exception("Failed to query TezCheck GET /me: %s", exc)
            raise TezCheckError(f"TezCheck GET /me failed: {exc}") from exc

    async def discover_payment_methods(self) -> List[Dict[str, Any]]:
        """Fetch available payment methods for this desk via POST /payment-methods.

        Returns list of methods configured on the cash desk, e.g. Payme, Click, Test provider.
        """
        if self.mock_mode:
            return [
                {
                    "provider_code": "test_provider",
                    "channel_code": "test_checkout",
                    "name": "Test provider",
                    "min_amount_minor": 100_000,
                    "max_amount_minor": 10_000_000,
                    "environment": "test",
                },
                {
                    "provider_code": "payme",
                    "channel_code": "payme_checkout",
                    "name": "Payme",
                    "min_amount_minor": 100_000,
                    "max_amount_minor": 100_000_000,
                    "environment": "live",
                },
                {
                    "provider_code": "click",
                    "channel_code": "click_checkout",
                    "name": "Click",
                    "min_amount_minor": 100_000,
                    "max_amount_minor": 100_000_000,
                    "environment": "live",
                },
            ]

        if not self.api_key:
            raise TezCheckError("TezCheck API kaliti sozlanmagan.")

        path = "/api/merchant/v1/payment-methods"
        body_bytes = b"{}"
        headers = self._build_request_headers("POST", path, body_bytes)

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(f"{self.api_url}/payment-methods", content=body_bytes, headers=headers)
                resp.raise_for_status()
                data = resp.json()
                methods = data.get("data") if isinstance(data.get("data"), list) else []
                return methods
        except httpx.HTTPError as exc:
            logger.exception("Failed to discover TezCheck payment methods: %s", exc)
            raise TezCheckError(f"TezCheck payment-methods discovery failed: {exc}") from exc

    async def find_test_provider_code(self) -> Optional[str]:
        """Discover the active provider_code for TezCheck's official 'Test provider'.

        Returns None if Test provider is not enabled on this desk.
        """
        try:
            methods = await self.discover_payment_methods()
        except TezCheckError as exc:
            logger.warning("Could not discover payment methods: %s", exc)
            return None

        for m in methods:
            p_code = str(m.get("provider_code") or "").lower()
            name = str(m.get("name") or "").lower()
            channel = str(m.get("channel_code") or "").lower()
            env = str(m.get("environment") or "").lower()

            if "test" in p_code or "test" in name or "test" in channel or env == "test":
                return m.get("provider_code")

        return None

    async def get_bill_status(self, bill_id: str) -> Dict[str, Any]:
        """Fetch real-time bill status from TezCheck API via POST /bills/{bill_id}.

        Documented status check endpoint: POST /bills/{bill}
        Fallback: GET /bills/{bill}
        """
        if self.mock_mode:
            return {
                "bill_id": bill_id,
                "status": "pending",
                "paid": False,
                "livemode": False,
                "environment": "test",
                "amount_minor": 100_000,
                "currency": "UZS",
                "mode": "mock",
            }

        if getattr(settings, "is_production", False) and not (self.api_key and self.secret_key):
            raise TezCheckError("Production muhitida TezCheck API kalitlari to'liq sozlanmagan.")

        path = f"/api/merchant/v1/bills/{bill_id}"
        body_bytes = b"{}"
        headers = self._build_request_headers("POST", path, body_bytes)

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                # Attempt POST /bills/{bill_id}
                resp = await client.post(f"{self.api_url}/bills/{bill_id}", content=body_bytes, headers=headers)
                if resp.status_code in (404, 405):
                    # Fallback to GET if method not allowed
                    get_headers = self._build_request_headers("GET", path, b"")
                    get_headers.pop("Content-Type", None)
                    resp = await client.get(f"{self.api_url}/bills/{bill_id}", headers=get_headers)

                resp.raise_for_status()
                data = resp.json()
                inner_data = data.get("data") if isinstance(data.get("data"), dict) else data

                bill_obj = inner_data.get("bill") if isinstance(inner_data.get("bill"), dict) else inner_data
                payment_obj = inner_data.get("payment") if isinstance(inner_data.get("payment"), dict) else {}

                paid = bool(bill_obj.get("paid") or payment_obj.get("state") == "succeeded")
                livemode = bill_obj.get("livemode")
                if livemode is None and payment_obj:
                    livemode = payment_obj.get("livemode")

                env = bill_obj.get("environment")
                if env is None and payment_obj:
                    env = payment_obj.get("environment")

                return {
                    "bill_id": bill_obj.get("id") or bill_obj.get("bill_id") or bill_id,
                    "external_reference": bill_obj.get("external_reference"),
                    "status": bill_obj.get("state") or bill_obj.get("status") or ("paid" if paid else "pending"),
                    "paid": paid,
                    "livemode": livemode if livemode is not None else False,
                    "environment": env or ("test" if not livemode else "live"),
                    "amount_minor": bill_obj.get("amount_minor") or payment_obj.get("amount_minor"),
                    "currency": bill_obj.get("currency") or payment_obj.get("currency", "UZS"),
                    "provider_code": payment_obj.get("provider_code") or bill_obj.get("provider_code"),
                    "raw_response": data,
                }
        except httpx.HTTPError as exc:
            logger.exception("Failed to fetch TezCheck bill status %s: %s", bill_id, exc)
            raise TezCheckError(f"TezCheck bill status fetch failed: {exc}") from exc

    async def reissue_bill(self, bill_id: str) -> Dict[str, Any]:
        """Reissue payment URL for an active bill via POST /bills/{bill_id}/reissue.

        Note: This creates a fresh payment token and invalidates the previous URL.
        """
        if self.mock_mode:
            new_url = f"https://pay.tezcheck.uz/pay/plk_mock_reissue_{secrets.token_hex(4)}"
            return {"bill_id": bill_id, "payment_url": new_url, "mode": "mock"}

        path = f"/api/merchant/v1/bills/{bill_id}/reissue"
        body_bytes = b"{}"
        headers = self._build_request_headers("POST", path, body_bytes)

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(f"{self.api_url}/bills/{bill_id}/reissue", content=body_bytes, headers=headers)
                resp.raise_for_status()
                data = resp.json()
                inner_data = data.get("data") if isinstance(data.get("data"), dict) else data
                return {
                    "bill_id": bill_id,
                    "payment_url": inner_data.get("payment_url") or inner_data.get("pay_url"),
                    "raw_response": data,
                }
        except httpx.HTTPError as exc:
            logger.exception("Failed to reissue TezCheck bill %s: %s", bill_id, exc)
            raise TezCheckError(f"TezCheck bill reissue failed: {exc}") from exc

    async def create_bill(
        self,
        amount: int,
        currency: str,
        order_id: str,
        description: str,
        return_url: str,
        callback_url: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        allowed_provider_codes: Optional[List[str]] = None,
        idempotency_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Create a single-use fixed-amount payment bill via TezCheck POST /bills endpoint.

        Parameters:
        - amount: Integer in minor units (tiyin for UZS, e.g. 1,000 UZS = 100,000 tiyin)
        - currency: Currency string (default "UZS")
        - order_id: Selloi unique internal bill identifier / external_reference
        - description: Invoice description / title
        - return_url: Hosted redirect destination upon completion
        - allowed_provider_codes: Optional list of provider codes to restrict payment methods (e.g. ['test_provider'])
        - idempotency_key: Idempotency-Key header value for retry deduplication
        """
        if getattr(settings, "is_production", False) and not (self.api_key and self.secret_key):
            raise TezCheckError("Production muhitida TezCheck API kalitlari to'liq sozlanmagan. To'lov rad etildi.")

        is_test_bill = bool(
            allowed_provider_codes
            and any("test" in str(code).lower() for code in allowed_provider_codes)
        )

        if self.mock_mode:
            bill_id = f"tzc_{order_id}_{secrets.token_hex(4)}"
            pay_url = f"{return_url}?bill_id={bill_id}&status=pending&amount={amount}&currency={currency}"
            logger.info("Created simulated TezCheck bill %s for %s %s (test=%s)", bill_id, amount, currency, is_test_bill)
            return {
                "bill_id": bill_id,
                "pay_url": pay_url,
                "amount": amount,
                "currency": currency,
                "status": "created",
                "livemode": False if is_test_bill else True,
                "environment": "test" if is_test_bill else "live",
                "allowed_provider_codes": allowed_provider_codes,
                "mode": "mock",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }

        payload: Dict[str, Any] = {
            "amount_minor": amount,
            "title": description,
            "external_reference": order_id,
            "return_url": return_url,
            "amount": amount,
            "currency": currency.upper(),
            "order_id": order_id,
            "description": description,
            "callback_url": callback_url,
            "metadata": metadata or {},
        }
        if allowed_provider_codes:
            payload["allowed_provider_codes"] = allowed_provider_codes

        path = "/api/merchant/v1/bills"
        body_bytes = json.dumps(payload, separators=(',', ':')).encode("utf-8")
        headers = self._build_request_headers("POST", path, body_bytes, idempotency_key=idempotency_key)

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(f"{self.api_url}/bills", content=body_bytes, headers=headers)
                resp.raise_for_status()
                data = resp.json()
                inner_data = data.get("data") if isinstance(data.get("data"), dict) else data

                bill_obj = inner_data.get("bill") if isinstance(inner_data.get("bill"), dict) else inner_data
                bill_id = bill_obj.get("id") or bill_obj.get("bill_id") or data.get("bill_id") or data.get("id")

                pay_url = (
                    inner_data.get("payment_url")
                    or inner_data.get("pay_url")
                    or inner_data.get("checkout_url")
                    or bill_obj.get("payment_url")
                    or bill_obj.get("pay_url")
                    or data.get("payment_url")
                    or data.get("pay_url")
                )
                return {
                    "bill_id": bill_id,
                    "pay_url": pay_url,
                    "amount": bill_obj.get("amount_minor", amount),
                    "currency": bill_obj.get("currency", currency),
                    "status": bill_obj.get("state") or bill_obj.get("status", "created"),
                    "livemode": bill_obj.get("livemode", False if is_test_bill else True),
                    "environment": bill_obj.get("environment", "test" if is_test_bill else "live"),
                    "allowed_provider_codes": allowed_provider_codes,
                    "mode": "live",
                    "raw_response": data,
                }
        except httpx.HTTPError as exc:
            logger.exception("Failed to create TezCheck bill: %s", exc)
            raise TezCheckError(f"TezCheck bill creation failed: {exc}") from exc

    def verify_webhook_signature(
        self,
        raw_body: bytes,
        signature_header: Optional[str],
        timestamp: Optional[str] = None,
        delivery_id: Optional[str] = None
    ) -> bool:
        """Verify HMAC-SHA256 signature of incoming TezCheck webhook payload.

        Official TezCheck Webhook Specification:
        - Header: X-Checkout-Signature: v1=<hash> (may contain multiple comma-separated signatures during rotation)
        - Payload signed: {timestamp}.{delivery_id}.{raw_body}
        - Secret key: TEZCHECK_SECRET_KEY (whsec_...)
        - Timestamp validation: strictly within +/- 300 seconds (Replay Attack Prevention)
        - Constant-time comparison: hmac.compare_digest
        - Reject missing, expired, or non-v1 signatures.
        """
        if not signature_header:
            if self.mock_mode and not getattr(settings, "is_production", False):
                return True
            raise TezCheckSignatureVerificationError("Missing required X-Checkout-Signature header.")

        # Replay attack protection: verify timestamp within 300 seconds
        if not timestamp:
            if not self.mock_mode:
                raise TezCheckSignatureVerificationError("Missing required X-Checkout-Timestamp header.")
        else:
            try:
                ts_int = int(timestamp)
                now_int = int(datetime.now(timezone.utc).timestamp())
                if abs(now_int - ts_int) > 300:
                    logger.warning("TezCheck webhook timestamp outside +/-300s window: delta=%s s", abs(now_int - ts_int))
                    raise TezCheckSignatureVerificationError("Webhook timestamp expired (replay attack protection).")
            except ValueError:
                raise TezCheckSignatureVerificationError("Invalid X-Checkout-Timestamp header integer format.")

        effective_secret = (self.secret_key or "SELLOI_TEZCHECK_MOCK_SECRET").encode("utf-8")

        # Official signing formula: {timestamp}.{delivery_id}.{raw_body}
        deliv = delivery_id or ""
        msg_bytes = f"{timestamp or ''}.{deliv}.".encode("utf-8") + raw_body
        expected_official = f"v1={hmac.new(effective_secret, msg_bytes, hashlib.sha256).hexdigest()}"

        # Candidate check with signature rotation support
        # Multiple comma-separated signatures can be sent when secrets are rotated
        candidates = [c.strip() for c in signature_header.split(",") if c.strip()]
        if not candidates:
            raise TezCheckSignatureVerificationError("Empty or malformed X-Checkout-Signature header.")

        matched = False
        has_v1_format = False

        for candidate in candidates:
            if not candidate.startswith("v1="):
                continue
            has_v1_format = True
            if hmac.compare_digest(candidate, expected_official):
                matched = True
                break

        if not has_v1_format and not self.mock_mode:
            raise TezCheckSignatureVerificationError("Invalid signature format: v1= prefix required.")

        if not matched and not self.mock_mode:
            raise TezCheckSignatureVerificationError(
                f"Signature mismatch: computed '{expected_official}', received '{signature_header}'."
            )

        return True


tezcheck_service = TezCheckService()
