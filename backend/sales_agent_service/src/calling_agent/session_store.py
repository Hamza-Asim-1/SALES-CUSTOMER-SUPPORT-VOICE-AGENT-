"""
Per-call session registry for the voice agent.

Replaces the single global `demo_config` for authenticated dashboard calls:
each browser call gets its own `CallSession` carrying the business profile,
the live product catalog, the lead being called, the rolling transcript, and
the realtime sentiment score. A tiny pub/sub (one Queue per SSE subscriber)
pushes sentiment / escalation / order events to the live call panel.

In-memory + lock (same pattern as demo_config) — perfect for the demo. A TTL
sweep keeps Render dynos from leaking sessions. The durable record of a call is
written to the `ai_calls` table on /end (see business_data.record_call).
"""
import threading
import time
import uuid
from dataclasses import dataclass, field, asdict
from queue import Queue, Empty
from typing import Any, Dict, List, Optional

# Sentiment starts neutral-positive so one bad sentence doesn't instantly escalate.
_INITIAL_SENTIMENT = 70.0
# Rolling EMA weight for new turns (0..1): higher = more reactive.
_SENTIMENT_ALPHA = 0.5
# Sessions older than this (no activity) are swept.
_SESSION_TTL_SECONDS = 60 * 60


@dataclass
class CallSession:
    session_id: str
    user_id: str
    lead_id: Optional[str] = None
    mode: str = "sales"                       # "sales" | "support"
    company_profile: Dict[str, Any] = field(default_factory=dict)
    products: List[Dict[str, Any]] = field(default_factory=list)
    customer: Dict[str, Any] = field(default_factory=dict)
    agent_name: str = "Alex"
    company_name: str = ""

    transcript: List[Dict[str, Any]] = field(default_factory=list)
    sentiment_score: float = _INITIAL_SENTIMENT   # rolling EMA, 0..100
    min_sentiment: float = _INITIAL_SENTIMENT
    last_emotion: str = "neutral"
    escalated: bool = False
    human_present: bool = False
    orders: List[Dict[str, Any]] = field(default_factory=list)

    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)

    # Non-serialized: SSE subscriber queues.
    _subscribers: List[Queue] = field(default_factory=list, repr=False)

    # ---- pub/sub -----------------------------------------------------
    def subscribe(self) -> Queue:
        q: Queue = Queue()
        self._subscribers.append(q)
        return q

    def unsubscribe(self, q: Queue) -> None:
        try:
            self._subscribers.remove(q)
        except ValueError:
            pass

    def publish(self, event: Dict[str, Any]) -> None:
        """Fan an event out to every live SSE subscriber."""
        self.updated_at = time.time()
        for q in list(self._subscribers):
            try:
                q.put_nowait(event)
            except Exception:
                pass

    # ---- transcript + sentiment -------------------------------------
    def add_turn(self, role: str, text: str, sentiment: Optional[float] = None,
                 emotion: Optional[str] = None) -> Dict[str, Any]:
        turn = {"role": role, "text": text, "ts": time.time()}
        if sentiment is not None:
            turn["sentiment"] = round(sentiment, 1)
        if emotion is not None:
            turn["emotion"] = emotion
        self.transcript.append(turn)
        self.updated_at = time.time()
        return turn

    def apply_sentiment(self, raw_score: float, emotion: str) -> float:
        """Fold a new 0..100 turn score into the rolling EMA and track the minimum."""
        self.sentiment_score = round(
            _SENTIMENT_ALPHA * raw_score + (1 - _SENTIMENT_ALPHA) * self.sentiment_score, 1
        )
        self.min_sentiment = min(self.min_sentiment, self.sentiment_score)
        self.last_emotion = emotion or "neutral"
        self.updated_at = time.time()
        return self.sentiment_score

    def public_dict(self) -> Dict[str, Any]:
        """Serializable snapshot (no queues) for API responses."""
        d = asdict(self)
        d.pop("_subscribers", None)
        return d


class _SessionStore:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._sessions: Dict[str, CallSession] = {}

    def create(self, **kwargs) -> CallSession:
        session_id = kwargs.pop("session_id", None) or uuid.uuid4().hex
        with self._lock:
            self._sweep_locked()
            session = CallSession(session_id=session_id, **kwargs)
            self._sessions[session_id] = session
            return session

    def get(self, session_id: str) -> Optional[CallSession]:
        with self._lock:
            return self._sessions.get(session_id)

    def remove(self, session_id: str) -> Optional[CallSession]:
        with self._lock:
            return self._sessions.pop(session_id, None)

    def _sweep_locked(self) -> None:
        now = time.time()
        stale = [
            sid for sid, s in self._sessions.items()
            if now - s.updated_at > _SESSION_TTL_SECONDS
        ]
        for sid in stale:
            self._sessions.pop(sid, None)


_store = _SessionStore()


def create_session(**kwargs) -> CallSession:
    return _store.create(**kwargs)


def get_session(session_id: str) -> Optional[CallSession]:
    return _store.get(session_id)


def remove_session(session_id: str) -> Optional[CallSession]:
    return _store.remove(session_id)


__all__ = ["CallSession", "create_session", "get_session", "remove_session"]
