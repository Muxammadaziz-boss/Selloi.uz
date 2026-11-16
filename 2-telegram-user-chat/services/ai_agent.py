"""Conversational AI Agent using Google Gemini API."""

from typing import Any, Dict, List
import httpx
from ..config import chat_config
from ..prompts.sales_prompt import DEFAULT_SYSTEM_PROMPT
from .knowledge_retriever import knowledge_retriever


class GeminiSalesAgent:
    """Core AI Agent driving intelligent sales dialogues in Uzbek."""

    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = api_key or chat_config.GEMINI_API_KEY
        self.primary_model = chat_config.DEFAULT_MODEL
        self.fallback_models = chat_config.FALLBACK_MODELS

    async def generate_response(
        self,
        user_message: str,
        history: List[Dict[str, str]] | None = None,
        custom_system_prompt: str | None = None,
        catalog_products: List[Dict[str, Any]] | None = None,
    ) -> str:
        """Generate contextual sales reply using Gemini."""
        if not self.api_key:
            return "Xatolik: Gemini API kaliti sozlanmagan."

        # 1. Retrieve relevant products from catalog via RAG
        if catalog_products:
            knowledge_retriever.update_catalog(catalog_products)
        relevant_items = knowledge_retriever.search(user_message, limit=4)
        catalog_context = knowledge_retriever.format_context_for_llm(relevant_items)

        # 2. Assemble system prompt
        sys_prompt = custom_system_prompt or DEFAULT_SYSTEM_PROMPT
        full_system_instruction = f"{sys_prompt}\n\n{catalog_context}"

        # 3. Assemble contents with dialogue history
        contents = []
        if history:
            for turn in history[-6:]:
                role = "user" if turn["role"] == "user" else "model"
                contents.append({"role": role, "parts": [{"text": turn["text"]}]})

        contents.append({"role": "user", "parts": [{"text": user_message}]})

        # 4. Attempt generation across fallback models
        models_to_try = [self.primary_model] + [m for m in self.fallback_models if m != self.primary_model]

        async with httpx.AsyncClient(timeout=18.0) as client:
            last_err = None
            for model in models_to_try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={self.api_key}"
                body = {
                    "systemInstruction": {"parts": [{"text": full_system_instruction}]},
                    "contents": contents,
                    "generationConfig": {
                        "temperature": chat_config.TEMPERATURE,
                        "maxOutputTokens": chat_config.MAX_TOKENS,
                    },
                }
                try:
                    res = await client.post(url, json=body)
                    if res.status_code == 200:
                        data = res.json()
                        candidates = data.get("candidates", [])
                        if candidates and "content" in candidates[0]:
                            parts = candidates[0]["content"].get("parts", [])
                            if parts and "text" in parts[0]:
                                return parts[0]["text"]
                    last_err = f"HTTP {res.status_code}: {res.text[:120]}"
                except Exception as e:
                    last_err = str(e)
                    continue

        return f"Kechirasiz, tizimda vaqtinchalik texnik uzilish yuz berdi. Iltimos, qayta urinib ko'ring yoki operator bilan bog'laning. ({last_err})"


sales_ai_agent = GeminiSalesAgent()
