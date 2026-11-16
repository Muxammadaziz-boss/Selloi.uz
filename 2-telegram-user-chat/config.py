"""Configuration for 2-telegram-user-chat conversational AI engine."""

import os
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()


class ChatAIConfig(BaseModel):
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    DEFAULT_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite")
    FALLBACK_MODELS: list[str] = [
        "gemini-3.1-flash-lite",
        "gemini-2.5-flash",
        "gemini-1.5-flash",
    ]
    TEMPERATURE: float = 0.3
    MAX_TOKENS: int = 1024
    MAX_HISTORY_TURNS: int = 10
    OPERATOR_HANDOVER_KEYWORDS: list[str] = [
        "operator",
        "odam",
        "inson",
        "menejer",
        "javob bermayapsan",
        "tushunmading",
        "mutaxassis",
        "rahbar",
        "shikoyat",
    ]


chat_config = ChatAIConfig()
