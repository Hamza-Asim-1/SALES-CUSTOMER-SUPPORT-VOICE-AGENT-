import logging

logger = logging.getLogger(__name__)

_chatbot = None
_init_failed = False


def get_chatbot():
    global _chatbot, _init_failed

    if _init_failed:
        return None

    if _chatbot is None:
        try:
            from services.chatbot import BusinessChatbot

            _chatbot = BusinessChatbot()
        except Exception as exc:
            logger.warning("Chatbot/Qdrant unavailable — analyze will still work, chat may not: %s", exc)
            _init_failed = True
            return None

    return _chatbot
