"""Conversation Session and Dialogue History Manager."""

from typing import Any, Dict, List
from datetime import datetime


class DialogueSession:
    def __init__(self, chat_id: int, user_info: Dict[str, Any] | None = None) -> None:
        self.chat_id = chat_id
        self.user_info = user_info or {}
        self.history: List[Dict[str, str]] = []
        self.status: str = "ai_active"  # "ai_active" | "human_takeover" | "resolved"
        self.handoff_reason: str | None = None
        self.customer_notes: str = ""
        self.last_updated: datetime = datetime.now()

    def add_message(self, role: str, text: str) -> None:
        self.history.append({"role": role, "text": text, "timestamp": datetime.now().isoformat()})
        self.last_updated = datetime.now()
        # Keep window of recent turns
        if len(self.history) > 20:
            self.history = self.history[-20:]

    def get_context_turns(self, max_turns: int = 8) -> List[Dict[str, str]]:
        return self.history[-max_turns:]


class ConversationManager:
    """In-memory and persistent session orchestrator for chat users."""

    def __init__(self) -> None:
        self._sessions: Dict[int, DialogueSession] = {}

    def get_or_create(self, chat_id: int, user_info: Dict[str, Any] | None = None) -> DialogueSession:
        if chat_id not in self._sessions:
            self._sessions[chat_id] = DialogueSession(chat_id, user_info)
        return self._sessions[chat_id]

    def set_status(self, chat_id: int, status: str, reason: str | None = None) -> None:
        session = self.get_or_create(chat_id)
        session.status = status
        session.handoff_reason = reason
        session.last_updated = datetime.now()

    def get_all_active_sessions(self) -> List[DialogueSession]:
        return list(self._sessions.values())


conversation_manager = ConversationManager()
