"""
LLM tool/function definitions the voice agent can call mid-conversation, plus
the dispatcher that executes them against the business's live Supabase data.

Tools (OpenAI/Groq function-calling schema):
  - list_products()                          -> catalog (names, prices)
  - get_product_price(product_name)          -> price
  - get_product_stock(product_name)          -> live stock count
  - place_order(product_name, quantity, ...) -> creates an order, decrements stock
  - escalate_to_human(reason)                -> flags the call for human takeover

Order/stock tools mutate or read the same tables the dashboard shows, so the
effect is visible in realtime on /products and /orders.
"""
import json
from typing import Any, Dict, List

from calling_agent import business_data


def tool_schemas() -> List[Dict[str, Any]]:
    return [
        {
            "type": "function",
            "function": {
                "name": "list_products",
                "description": "List the products/services this business sells, with prices. Use when the customer asks what you offer or about pricing in general.",
                "parameters": {"type": "object", "properties": {}, "required": []},
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_product_price",
                "description": "Get the current price of one product by name.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "product_name": {"type": "string", "description": "Name of the product."}
                    },
                    "required": ["product_name"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_product_stock",
                "description": "Check how many units of a product are currently in stock before promising availability or taking an order.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "product_name": {"type": "string", "description": "Name of the product."}
                    },
                    "required": ["product_name"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "place_order",
                "description": "Place a confirmed order for the customer. ONLY call this after the customer has explicitly agreed to the product, quantity, and total price.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "product_name": {"type": "string"},
                        "quantity": {"type": "integer", "minimum": 1},
                        "customer_name": {"type": "string"},
                        "customer_contact": {"type": "string"},
                    },
                    "required": ["product_name", "quantity"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "escalate_to_human",
                "description": "Hand the call to a human agent. Call this if the customer is very upset, explicitly asks for a human, or has an issue you cannot resolve.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "reason": {"type": "string", "description": "Short reason for escalation."}
                    },
                    "required": ["reason"],
                },
            },
        },
    ]


def dispatch(name: str, args: Dict[str, Any], session) -> Dict[str, Any]:
    """Execute a tool call against the session's business data. Always returns a dict."""
    user_id = session.user_id
    try:
        if name == "list_products":
            products = session.products or business_data.list_products(user_id)
            return {
                "products": [
                    {"name": p.get("name"), "price": p.get("price"), "currency": p.get("currency", "USD")}
                    for p in products
                ]
            }

        if name == "get_product_price":
            p = business_data.find_product_by_name(user_id, args.get("product_name", ""))
            if not p:
                return {"found": False, "message": "No matching product."}
            return {"found": True, "name": p.get("name"), "price": p.get("price"),
                    "currency": p.get("currency", "USD")}

        if name == "get_product_stock":
            p = business_data.find_product_by_name(user_id, args.get("product_name", ""))
            if not p:
                return {"found": False, "message": "No matching product."}
            return {"found": True, "name": p.get("name"), "stock": p.get("stock", 0)}

        if name == "place_order":
            p = business_data.find_product_by_name(user_id, args.get("product_name", ""))
            if not p:
                return {"ok": False, "error": "That product was not found in the catalog."}
            qty = int(args.get("quantity", 1) or 1)
            result = business_data.place_order(
                user_id,
                p,
                qty,
                lead_id=session.lead_id,
                session_id=session.session_id,
                customer_name=args.get("customer_name") or session.customer.get("customer_name"),
                customer_contact=args.get("customer_contact") or session.customer.get("customer_contact"),
            )
            if result.get("ok"):
                order = result["order"]
                session.orders.append(order)
                # Reflect the stock drop in the in-memory catalog so later turns are accurate.
                for prod in session.products:
                    if prod.get("product_id") == p.get("product_id"):
                        prod["stock"] = max(0, int(prod.get("stock", 0)) - qty)
                session.publish({
                    "type": "order",
                    "order": {
                        "order_id": order.get("order_id"),
                        "product_name": order.get("product_name"),
                        "quantity": order.get("quantity"),
                        "total_price": order.get("total_price"),
                        "currency": order.get("currency", "USD"),
                    },
                })
            return result

        if name == "escalate_to_human":
            reason = args.get("reason", "Customer needs a human.")
            if not session.escalated:
                session.escalated = True
                session.publish({"type": "escalation", "reason": reason, "source": "agent"})
            return {"ok": True, "message": "A human agent is being brought in."}

    except Exception as e:
        return {"ok": False, "error": f"Tool '{name}' failed: {e}"}

    return {"ok": False, "error": f"Unknown tool: {name}"}


def serialize_tool_call(tc) -> Dict[str, Any]:
    """Convert a Groq tool_call object into the assistant-message dict shape."""
    return {
        "id": tc.id,
        "type": "function",
        "function": {"name": tc.function.name, "arguments": tc.function.arguments or "{}"},
    }
