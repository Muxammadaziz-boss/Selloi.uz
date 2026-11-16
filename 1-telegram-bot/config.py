"""Telegram Bot Configuration & Environment Settings.

This module encapsulates all credentials, webhook secrets, and configuration parameters
specifically required for running the Telegram Bot module.
"""

import os
from pydantic_settings import BaseSettings


class BotSettings(BaseSettings):
    bot_token: str = os.getenv("TELEGRAM_BOT_TOKEN", "")
    webhook_secret: str = os.getenv("TELEGRAM_WEBHOOK_SECRET", "")
    app_base_url: str = os.getenv("APP_BASE_URL", "http://localhost:8000")
    admin_telegram_id: int = int(os.getenv("ADMIN_TELEGRAM_ID", "6990611858"))
    
    # Telegram API endpoints
    telegram_api_url: str = "https://api.telegram.org/bot"

    class Config:
        env_file = ".env"
        extra = "ignore"


bot_settings = BotSettings()
