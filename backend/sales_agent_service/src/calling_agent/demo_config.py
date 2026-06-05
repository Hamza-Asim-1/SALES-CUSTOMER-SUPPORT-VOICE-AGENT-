"""
Demo-time per-session config for the voice agent.

The frontend POSTs to /demo/config BEFORE starting a voice call:
  {
    "mode": "sales" | "support",
    "company_name": "...",
    "agent_name": "Alex",          (optional, defaults to "Alex")
    "what_we_offer": "...",        (one-line elevator pitch)
    "details": "..."               (free-form extras: pricing, hours, etc.)
  }

The bridge reads `current()` when ElevenLabs hits /v1/chat/completions and uses
it to pick the right prompt template (sales vs support) and inject the company
data. This is intentionally a single shared in-memory config — perfect for a
live demo, not multi-tenant. For production multi-tenancy, key this by
ElevenLabs conversation_id.
"""
import threading
from dataclasses import dataclass, asdict, field

_lock = threading.Lock()


@dataclass
class DemoConfig:
    mode: str = "sales"  # "sales" | "support"
    company_name: str = "TechCare AI"
    agent_name: str = "Alex"
    what_we_offer: str = "AI-powered automation for customer support and sales."
    details: str = ""

    def to_dict(self) -> dict:
        return asdict(self)

    def system_company_blob(self) -> str:
        """Compact company context injected into the system prompt."""
        parts = [f"Company name: {self.company_name}"]
        if self.what_we_offer:
            parts.append(f"What we offer: {self.what_we_offer}")
        if self.details:
            parts.append(f"Other details: {self.details}")
        return "\n".join(parts)

    def product_name(self) -> str:
        """Short product label extracted from what_we_offer."""
        offer = (self.what_we_offer or "").strip()
        if not offer:
            return self.company_name
        for sep in ("—", " - ", ":"):
            if sep in offer:
                return offer.split(sep)[0].strip()
        return offer.split(".")[0].strip() or self.company_name

    def product_info_dict(self) -> dict:
        """Product payload for LangGraph / voice brain — always from live demo config."""
        return {
            "name": self.product_name(),
            "description": (self.what_we_offer or "")[:500],
            "details": (self.details or "")[:500],
            "company_name": self.company_name,
        }


_current = DemoConfig()


def current() -> DemoConfig:
    with _lock:
        # Return a copy so callers can't mutate the live config.
        return DemoConfig(**asdict(_current))


def update(payload: dict) -> DemoConfig:
    """Replace fields supplied in `payload`; ignores unknown keys."""
    global _current
    with _lock:
        data = asdict(_current)
        for k in ("mode", "company_name", "agent_name", "what_we_offer", "details"):
            v = payload.get(k)
            if v is not None:
                data[k] = str(v).strip()
        # Normalise mode.
        mode = (data.get("mode") or "sales").lower()
        data["mode"] = "support" if mode in ("support", "customer_service", "service", "cs") else "sales"
        _current = DemoConfig(**data)
        return DemoConfig(**asdict(_current))


def reset() -> DemoConfig:
    global _current
    with _lock:
        _current = DemoConfig()
        return DemoConfig(**asdict(_current))


def build_techcare_preset(mode: str = "sales") -> DemoConfig:
    """Pre-trained demo: ONE flagship product (ServiceFlow AI) from our database."""
    try:
        from utils.example_company.products_data import Products_data
        products = Products_data.get("products_and_services", [])
        flagship = next((p for p in products if p.get("name") == "ServiceFlow AI"), products[0] if products else None)
    except Exception:
        flagship = None

    if flagship:
        benefits = ", ".join((flagship.get("key_features") or flagship.get("benefits") or [])[:3])
        offer = (
            f"ServiceFlow AI — {flagship.get('description', 'AI ticket categorization, smart routing, and automated responses.')}"
        )
        details = (
            f"Key wins: {benefits or '98% ticket accuracy, smart routing, automated replies'}. "
            "Integrations: Salesforce, Zendesk, HubSpot. "
            "Proof: 60% faster response times, 40% cost savings, 95%+ accuracy. "
            "Offer: free 30-day pilot, then Basic/Pro/Enterprise tiers. "
            "Do NOT pitch any other TechCare product on this call."
        )
    else:
        offer = "ServiceFlow AI — AI-powered ticket categorization, routing, and automated customer responses."
        details = "98% accuracy, 60% faster responses, free 30-day pilot. Salesforce/Zendesk/HubSpot integrations."

    return DemoConfig(
        mode="support" if str(mode).lower() in ("support", "customer_service", "service", "cs") else "sales",
        company_name="TechCare AI",
        agent_name="Alex",
        what_we_offer=offer,
        details=details,
    )


def apply_preset_techcare(mode: str = "sales") -> DemoConfig:
    """Set the live config to the pre-trained TechCare demo."""
    global _current
    with _lock:
        _current = build_techcare_preset(mode)
        return DemoConfig(**asdict(_current))
