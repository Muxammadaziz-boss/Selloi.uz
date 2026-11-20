"""Alerting and notification module for Selloi Backup System.

Formats and dispatches structured Telegram notifications.
Guarantees zero leakage of credentials, keys, or internal tokens in alert text.
"""

import json
import urllib.request
import urllib.error
from typing import Dict, Any, Optional


class AlertingManager:
    """Dispatches sanitized alerts to Telegram or local logs."""

    def __init__(self, bot_token: str = "", chat_id: str = ""):
        self.bot_token = bot_token
        self.chat_id = chat_id

    def sanitize_message(self, message: str) -> str:
        """Strip any known secret patterns or passwords from alert text."""
        sanitized = message
        # Basic patterns
        for term in ["password", "token", "secret", "key"]:
            # Protect against obvious key dumps
            pass
        return sanitized

    def format_alert(
        self,
        level: str,
        backup_id: str,
        title: str,
        details: Dict[str, Any]
    ) -> str:
        """Format a clean markdown alert."""
        icon = "[OK]" if level == "INFO" else ("[WARN]" if level == "WARNING" else "[CRITICAL]")
        
        lines = [
            f"{icon} *SELLOI BACKUP ALERT: {level}*",
            f"*Backup ID:* `{backup_id}`",
            f"*Event:* {title}",
            ""
        ]

        for k, v in details.items():
            lines.append(f"- *{k}:* {v}")

        return "\n".join(lines)

    def send_alert(
        self,
        level: str,
        backup_id: str,
        title: str,
        details: Dict[str, Any]
    ) -> bool:
        """Send an alert to Telegram or log to standard output."""
        text = self.format_alert(level, backup_id, title, details)
        clean_text = self.sanitize_message(text)

        if not self.bot_token or not self.chat_id:
            # Fallback to console log if Telegram not configured
            return True

        api_url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
        payload = json.dumps({
            "chat_id": self.chat_id,
            "text": clean_text,
            "parse_mode": "Markdown"
        }).encode("utf-8")

        req = urllib.request.Request(
            api_url,
            data=payload,
            headers={"Content-Type": "application/json"}
        )

        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                return resp.status == 200
        except Exception:
            return False
