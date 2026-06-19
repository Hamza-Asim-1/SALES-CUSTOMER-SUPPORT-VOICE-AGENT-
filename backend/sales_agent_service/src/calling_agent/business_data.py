"""
Data access for the voice agent and the dashboard REST API.

Scoped by `user_id` (the business / tenant). Supabase-first: every operation
tries the real Postgres tables. If those tables are missing (schema not applied
yet) or Supabase is unreachable, it transparently falls back to a process-local
**in-memory cache** so the full flow is testable without applying the schema.
The moment the real tables exist, it uses them automatically (no flag flip).

Set DEMO_CACHE=1 to force in-memory mode regardless of Supabase.
"""
import json
import logging
import os
import tempfile
import threading
import time
import uuid
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# --- lazy Supabase client (import deferred so app starts without creds) -------
_supabase = None


def _sb():
    global _supabase
    if _supabase is None:
        from supabase_client import supabase
        _supabase = supabase
    return _supabase


# --- in-memory demo cache (fallback when tables are missing) ------------------
_cache_lock = threading.Lock()
_cache: Dict[str, Any] = {
    "profiles": {},   # user_id -> profile dict
    "products": {},   # product_id -> product dict (carries user_id)
    "orders": [],     # list of order dicts
    "calls": {},      # session_id -> call dict
}
_FORCE_CACHE = (os.getenv("DEMO_CACHE", "") or "").lower() in ("1", "true", "yes")
_cache_active = False

# Persist the demo cache to disk so products/orders survive a service restart
# (the schema isn't applied, so this is the only durable store in demo mode).
_CACHE_FILE = os.getenv("DEMO_CACHE_FILE") or os.path.join(tempfile.gettempdir(), "fyp_demo_cache.json")


def _load_cache():
    try:
        with open(_CACHE_FILE) as f:
            data = json.load(f)
        for k in ("profiles", "products", "orders", "calls"):
            if k in data:
                _cache[k] = data[k]
        logger.info("Loaded demo cache from %s", _CACHE_FILE)
    except FileNotFoundError:
        pass
    except Exception as e:
        logger.warning("Could not load demo cache: %s", e)


def _persist():
    """Save the cache to disk. Caller already holds _cache_lock."""
    try:
        with open(_CACHE_FILE, "w") as f:
            json.dump({k: _cache[k] for k in ("profiles", "products", "orders", "calls")}, f)
    except Exception as e:
        logger.warning("Could not persist demo cache: %s", e)


def _activate_cache():
    global _cache_active
    if not _cache_active:
        _cache_active = True
        logger.warning(
            "Supabase tables unavailable — using in-memory DEMO cache (persisted to %s). "
            "Apply backend/docs/supabase_schema.sql for real persistence.", _CACHE_FILE
        )


_load_cache()


def _cache_on() -> bool:
    return _FORCE_CACHE or _cache_active


PROFILE_TABLE = "company_profile"
PRODUCTS_TABLE = "products"
ORDERS_TABLE = "orders"
CALLS_TABLE = "ai_calls"
MAPPED_TABLE = "Mapped_Dataset"


# ---------------------------------------------------------------------
# Company profile
# ---------------------------------------------------------------------
def get_company_profile(user_id: str) -> Optional[Dict[str, Any]]:
    if _cache_on():
        with _cache_lock:
            return _cache["profiles"].get(user_id)
    try:
        res = _sb().table(PROFILE_TABLE).select("*").eq("user_id", user_id).limit(1).execute()
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:
        logger.error("get_company_profile failed: %s", e)
        _activate_cache()
        with _cache_lock:
            return _cache["profiles"].get(user_id)


def upsert_company_profile(user_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    record = {
        "user_id": user_id,
        "company_name": payload.get("company_name") or payload.get("name") or "",
        "description": payload.get("description"),
        "website": payload.get("website"),
        "social_links": payload.get("social_links") or payload.get("socialLinks") or [],
        "mode": (payload.get("mode") or "sales").lower(),
        "agent_name": payload.get("agent_name") or "Alex",
        "pitch_details": payload.get("pitch_details") or payload.get("details") or "",
        "updated_at": _now_iso(),
    }
    if not _cache_on():
        try:
            res = _sb().table(PROFILE_TABLE).upsert(record, on_conflict="user_id").execute()
            rows = res.data or []
            return rows[0] if rows else record
        except Exception as e:
            logger.error("upsert_company_profile failed: %s", e)
            _activate_cache()
    with _cache_lock:
        _cache["profiles"][user_id] = record
        _persist()
    return record


# ---------------------------------------------------------------------
# Products (with live price + stock)
# ---------------------------------------------------------------------
def list_products(user_id: str) -> List[Dict[str, Any]]:
    if not _cache_on():
        try:
            res = _sb().table(PRODUCTS_TABLE).select("*").eq("user_id", user_id).execute()
            return res.data or []
        except Exception as e:
            logger.error("list_products failed: %s", e)
            _activate_cache()
    with _cache_lock:
        return [dict(p) for p in _cache["products"].values() if p.get("user_id") == user_id]


def create_product(user_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    record = {
        "user_id": user_id,
        "name": (payload.get("name") or "").strip(),
        "description": payload.get("description"),
        "price": _to_number(payload.get("price"), 0),
        "currency": payload.get("currency") or "USD",
        "stock": int(_to_number(payload.get("stock"), 0)),
        "sku": payload.get("sku"),
    }
    if not _cache_on():
        try:
            res = _sb().table(PRODUCTS_TABLE).insert(record).execute()
            rows = res.data or []
            return rows[0] if rows else record
        except Exception as e:
            logger.error("create_product failed: %s", e)
            _activate_cache()
    return _cache_put_product(record)


def create_products_bulk(user_id: str, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    records = []
    for p in items:
        name = (p.get("name") or "").strip()
        if not name:
            continue
        records.append({
            "user_id": user_id,
            "name": name,
            "description": p.get("description"),
            "price": _to_number(p.get("price"), 0),
            "currency": p.get("currency") or "USD",
            "stock": int(_to_number(p.get("stock"), 0)),
            "sku": p.get("sku"),
        })
    if not records:
        return []
    if not _cache_on():
        try:
            res = _sb().table(PRODUCTS_TABLE).insert(records).execute()
            return res.data or []
        except Exception as e:
            logger.error("create_products_bulk failed: %s", e)
            _activate_cache()
    return [_cache_put_product(r) for r in records]


def _cache_put_product(record: Dict[str, Any]) -> Dict[str, Any]:
    pid = uuid.uuid4().hex
    record = {**record, "product_id": pid}
    with _cache_lock:
        _cache["products"][pid] = record
        _persist()
    return dict(record)


def update_product(user_id: str, product_id: str, patch: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    allowed = {}
    for key in ("name", "description", "currency", "sku"):
        if key in patch and patch[key] is not None:
            allowed[key] = patch[key]
    if "price" in patch and patch["price"] is not None:
        allowed["price"] = _to_number(patch["price"], 0)
    if "stock" in patch and patch["stock"] is not None:
        allowed["stock"] = int(_to_number(patch["stock"], 0))
    allowed["updated_at"] = _now_iso()
    if not _cache_on():
        try:
            res = (
                _sb().table(PRODUCTS_TABLE).update(allowed)
                .eq("product_id", product_id).eq("user_id", user_id).execute()
            )
            rows = res.data or []
            return rows[0] if rows else None
        except Exception as e:
            logger.error("update_product failed: %s", e)
            _activate_cache()
    with _cache_lock:
        prod = _cache["products"].get(product_id)
        if not prod or prod.get("user_id") != user_id:
            return None
        prod.update(allowed)
        _persist()
        return dict(prod)


def delete_product(user_id: str, product_id: str) -> bool:
    if not _cache_on():
        try:
            res = (
                _sb().table(PRODUCTS_TABLE).delete()
                .eq("product_id", product_id).eq("user_id", user_id).execute()
            )
            return bool(res.data)
        except Exception as e:
            logger.error("delete_product failed: %s", e)
            _activate_cache()
    with _cache_lock:
        prod = _cache["products"].get(product_id)
        if prod and prod.get("user_id") == user_id:
            del _cache["products"][product_id]
            _persist()
            return True
        return False


def find_product_by_name(user_id: str, name: str) -> Optional[Dict[str, Any]]:
    """Case-insensitive best match for a spoken product name."""
    if not name:
        return None
    products = list_products(user_id)
    needle = name.strip().lower()
    for p in products:
        if (p.get("name") or "").strip().lower() == needle:
            return p
    for p in products:
        pname = (p.get("name") or "").strip().lower()
        if needle in pname or pname in needle:
            return p
    return None


# ---------------------------------------------------------------------
# Orders (atomic stock decrement to prevent overselling)
# ---------------------------------------------------------------------
def place_order(
    user_id: str,
    product: Dict[str, Any],
    quantity: int,
    *,
    lead_id: Optional[str] = None,
    session_id: Optional[str] = None,
    customer_name: Optional[str] = None,
    customer_contact: Optional[str] = None,
) -> Dict[str, Any]:
    quantity = int(quantity)
    if quantity <= 0:
        return {"ok": False, "error": "Quantity must be at least 1."}

    available = int(_to_number(product.get("stock"), 0))
    if available < quantity:
        return {
            "ok": False,
            "error": f"Only {available} unit(s) of {product.get('name')} are in stock.",
            "available": available,
        }

    product_id = product.get("product_id")
    unit_price = _to_number(product.get("price"), 0)
    total = round(unit_price * quantity, 2)
    record = {
        "user_id": user_id,
        "lead_id": lead_id,
        "session_id": session_id,
        "product_id": product_id,
        "product_name": product.get("name"),
        "quantity": quantity,
        "unit_price": unit_price,
        "total_price": total,
        "currency": product.get("currency") or "USD",
        "status": "confirmed",
        "customer_name": customer_name,
        "customer_contact": customer_contact,
    }

    if not _cache_on():
        try:
            # Atomic decrement via SQL function (rows affected; 0 = lost race).
            rpc = _sb().rpc("decrement_stock", {"p_product_id": product_id, "p_qty": quantity}).execute()
            affected = rpc.data if isinstance(rpc.data, int) else (rpc.data or 0)
            if not affected:
                return {"ok": False, "error": "Stock just changed — not enough units left."}
            res = _sb().table(ORDERS_TABLE).insert(record).execute()
            rows = res.data or []
            return {"ok": True, "order": rows[0] if rows else record}
        except Exception as e:
            logger.error("place_order failed: %s", e)
            _activate_cache()

    # Cache path: decrement stock + store order.
    with _cache_lock:
        prod = _cache["products"].get(product_id)
        if prod is not None:
            if int(_to_number(prod.get("stock"), 0)) < quantity:
                return {"ok": False, "error": "Not enough units left."}
            prod["stock"] = int(_to_number(prod.get("stock"), 0)) - quantity
        order = {**record, "order_id": uuid.uuid4().hex, "created_at": _now_iso()}
        _cache["orders"].append(order)
        _persist()
        return {"ok": True, "order": dict(order)}


def list_orders(user_id: str) -> List[Dict[str, Any]]:
    if not _cache_on():
        try:
            res = (
                _sb().table(ORDERS_TABLE).select("*").eq("user_id", user_id)
                .order("created_at", desc=True).execute()
            )
            return res.data or []
        except Exception as e:
            logger.error("list_orders failed: %s", e)
            _activate_cache()
    with _cache_lock:
        rows = [dict(o) for o in _cache["orders"] if o.get("user_id") == user_id]
    return list(reversed(rows))


def get_metrics(user_id: str) -> Dict[str, Any]:
    orders = list_orders(user_id)
    total_sales = round(sum(_to_number(o.get("total_price"), 0) for o in orders), 2)
    units_sold = sum(int(_to_number(o.get("quantity"), 0)) for o in orders)

    calls: List[Dict[str, Any]] = []
    if not _cache_on():
        try:
            res = _sb().table(CALLS_TABLE).select("*").eq("user_id", user_id).execute()
            calls = res.data or []
        except Exception as e:
            logger.error("get_metrics calls failed: %s", e)
            _activate_cache()
    if _cache_on():
        with _cache_lock:
            calls = [dict(c) for c in _cache["calls"].values() if c.get("user_id") == user_id]

    total_calls = len(calls)
    escalated_calls = sum(1 for c in calls if c.get("escalated"))
    sentiments = [_to_number(c.get("final_sentiment"), 0) for c in calls if c.get("final_sentiment") is not None]
    avg_sentiment = round(sum(sentiments) / len(sentiments), 1) if sentiments else None

    leads = 0
    try:
        lr = _sb().table(MAPPED_TABLE).select("Id", count="exact").eq("User_id", str(user_id)).execute()
        leads = lr.count if getattr(lr, "count", None) is not None else len(lr.data or [])
    except Exception:
        pass

    conversion_rate = round((len(orders) / total_calls) * 100, 1) if total_calls else 0.0
    return {
        "total_sales": total_sales,
        "total_orders": len(orders),
        "units_sold": units_sold,
        "total_calls": total_calls,
        "escalated_calls": escalated_calls,
        "avg_sentiment": avg_sentiment,
        "leads": leads,
        "conversion_rate": conversion_rate,
    }


# ---------------------------------------------------------------------
# Lead lookup (Mapped_Dataset exists — always real) + call records
# ---------------------------------------------------------------------
def get_lead(user_id: str, lead_id: Any) -> Dict[str, Any]:
    try:
        res = _sb().table(MAPPED_TABLE).select("*").eq("User_id", str(user_id)).execute()
        rows = res.data or []
        if not rows:
            return {}
        try:
            idx = int(lead_id)
            row = rows[idx] if 0 <= idx < len(rows) else rows[0]
        except (TypeError, ValueError):
            row = rows[0]
        return {
            "customer_name": row.get("Name") or "there",
            "customer_contact": row.get("Contact") or row.get("Phone") or "",
            "customer_email": row.get("Email") or "",
            "customer_company": row.get("Organization") or row.get("Location") or "",
        }
    except Exception as e:
        logger.error("get_lead failed: %s", e)
        return {}


def record_call(session) -> None:
    outcome = "escalated" if session.escalated else None
    if any(session.orders):
        outcome = "order_placed"
    record = {
        "user_id": session.user_id,
        "lead_id": session.lead_id,
        "session_id": session.session_id,
        "way_of_interaction": "voice",
        "end_time": _now_iso(),
        "transcript": session.transcript,
        "final_sentiment": session.sentiment_score,
        "min_sentiment": session.min_sentiment,
        "escalated": session.escalated,
        "outcome": outcome,
        "status": "completed",
    }
    if not _cache_on():
        try:
            _sb().table(CALLS_TABLE).upsert(record, on_conflict="session_id").execute()
            return
        except Exception as e:
            logger.error("record_call failed: %s", e)
            _activate_cache()
    with _cache_lock:
        _cache["calls"][session.session_id] = record
        _persist()


# ---------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------
def _to_number(value: Any, default: float) -> float:
    if value is None or value == "":
        return default
    try:
        return float(str(value).replace("$", "").replace(",", "").strip())
    except (TypeError, ValueError):
        return default


def _now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime())
