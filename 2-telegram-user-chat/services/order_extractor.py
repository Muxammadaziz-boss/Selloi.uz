"""Order details and intent extractor."""

from typing import Any, Dict
import re
import json
import httpx
from ..config import chat_config
from ..prompts.sales_prompt import INTENT_EXTRACTION_PROMPT


class OrderExtractor:
    @staticmethod
    def extract_heuristics(text: str) -> Dict[str, Any]:
        """Fast regex-based heuristics for phone number, address, and quantity."""
        # Uzbek phone numbers: +998... or 998... or 9...
        phone_match = re.search(r"(?:\+?998[\s-]?)?\(?\d{2}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}", text)
        phone = phone_match.group(0).replace(" ", "").replace("-", "") if phone_match else None

        # Quantity: 1 ta, 2 dona, 3 pachka, etc.
        qty_match = re.search(r"(\d+)\s*(?:ta|dona|shtuk|dona|juft)", text, re.IGNORECASE)
        quantity = int(qty_match.group(1)) if qty_match else 1

        return {
            "phone": phone,
            "quantity": quantity,
        }

    @classmethod
    async def extract_with_llm(cls, text: str, api_key: str | None = None) -> Dict[str, Any]:
        """Extract structured intent and order items using Gemini structured output."""
        key = api_key or chat_config.GEMINI_API_KEY
        if not key:
            return cls.extract_heuristics(text)

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{chat_config.DEFAULT_MODEL}:generateContent?key={key}"
        body = {
            "systemInstruction": {"parts": [{"text": INTENT_EXTRACTION_PROMPT}]},
            "contents": [{"role": "user", "parts": [{"text": text}]}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.1,
            },
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                res = await client.post(url, json=body)
                if res.status_code == 200:
                    raw_text = res.json()["candidates"][0]["content"]["parts"][0]["text"]
                    return json.loads(raw_text)
            except Exception:
                pass

        return cls.extract_heuristics(text)


order_extractor = OrderExtractor()
