"""Human Handover and Escalation Service.

Detects when a customer requires human operator intervention,
switches the chat status, and pauses automatic AI responses.
"""

from typing import Tuple
from ..config import chat_config
from .conversation_manager import conversation_manager


class HandoverService:
    @staticmethod
    def should_escalate_to_human(text: str) -> Tuple[bool, str | None]:
        """Check whether incoming user text contains escalation triggers."""
        lower_text = text.lower().strip()
        for keyword in chat_config.OPERATOR_HANDOVER_KEYWORDS:
            if keyword in lower_text:
                return True, f"Mijoz talabi ('{keyword}')"
        return False, None

    @classmethod
    def process_handover(cls, chat_id: int, reason: str) -> str:
        """Escalate conversation to human operator."""
        conversation_manager.set_status(chat_id, "human_takeover", reason=reason)
        return (
            "👨‍💼 <b>Suhbat inson operatoriga yo'naltirildi!</b>\n\n"
            f"Sabab: {reason}.\n"
            "Tez orada operatorimiz siz bilan bevosita bog'lanadi."
        )

    @classmethod
    def resume_ai(cls, chat_id: int) -> str:
        """Resume automated AI assistance."""
        conversation_manager.set_status(chat_id, "ai_active", reason=None)
        return "🤖 <b>AI savdo assistenti qayta faollashtirildi.</b>"


handover_service = HandoverService()
