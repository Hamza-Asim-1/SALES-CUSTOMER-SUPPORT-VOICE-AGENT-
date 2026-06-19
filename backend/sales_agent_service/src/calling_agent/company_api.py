"""
Dashboard REST API for business profile, product catalog (live price + stock),
and orders. Hosted in the sales service so the voice tools and these endpoints
share one Supabase client and one source of truth.

Tenant key = user_id (Supabase auth uid), passed by the authenticated frontend.
"""
from flask import Response, jsonify, request

from calling_agent import business_data


def _cors(resp):
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, PATCH, DELETE, OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return resp


def _require_user_id():
    """Resolve user_id from query, JSON body, or header."""
    uid = request.args.get("user_id")
    if not uid and request.is_json:
        body = request.get_json(silent=True) or {}
        uid = body.get("user_id")
    if not uid:
        uid = request.headers.get("X-User-Id")
    return (uid or "").strip() or None


def register_company_routes(app):
    # ---- Company profile -------------------------------------------------
    @app.route("/company/profile", methods=["GET", "POST", "OPTIONS"])
    def company_profile():
        if request.method == "OPTIONS":
            return _cors(Response("", status=204))
        user_id = _require_user_id()
        if not user_id:
            return _cors(jsonify({"error": "user_id is required"})), 400

        if request.method == "POST":
            body = request.get_json(force=True, silent=True) or {}
            profile = business_data.upsert_company_profile(user_id, body)
            # Optional: products supplied together at onboarding.
            products = body.get("products")
            created = []
            if isinstance(products, list) and products:
                created = business_data.create_products_bulk(user_id, products)
            return _cors(jsonify({"profile": profile, "products": created}))

        profile = business_data.get_company_profile(user_id)
        return _cors(jsonify({"profile": profile}))

    # ---- Products --------------------------------------------------------
    @app.route("/company/products", methods=["GET", "POST", "OPTIONS"])
    def company_products():
        if request.method == "OPTIONS":
            return _cors(Response("", status=204))
        user_id = _require_user_id()
        if not user_id:
            return _cors(jsonify({"error": "user_id is required"})), 400

        if request.method == "POST":
            body = request.get_json(force=True, silent=True) or {}
            if isinstance(body.get("products"), list):
                created = business_data.create_products_bulk(user_id, body["products"])
                return _cors(jsonify({"products": created}))
            product = business_data.create_product(user_id, body)
            return _cors(jsonify({"product": product}))

        return _cors(jsonify({"products": business_data.list_products(user_id)}))

    @app.route("/company/products/<product_id>", methods=["PATCH", "DELETE", "OPTIONS"])
    def company_product_item(product_id):
        if request.method == "OPTIONS":
            return _cors(Response("", status=204))
        user_id = _require_user_id()
        if not user_id:
            return _cors(jsonify({"error": "user_id is required"})), 400

        if request.method == "DELETE":
            ok = business_data.delete_product(user_id, product_id)
            return _cors(jsonify({"ok": ok}))

        body = request.get_json(force=True, silent=True) or {}
        updated = business_data.update_product(user_id, product_id, body)
        if not updated:
            return _cors(jsonify({"error": "product not found"})), 404
        return _cors(jsonify({"product": updated}))

    # ---- Orders ----------------------------------------------------------
    @app.route("/company/orders", methods=["GET", "OPTIONS"])
    def company_orders():
        if request.method == "OPTIONS":
            return _cors(Response("", status=204))
        user_id = _require_user_id()
        if not user_id:
            return _cors(jsonify({"error": "user_id is required"})), 400
        return _cors(jsonify({"orders": business_data.list_orders(user_id)}))

    # ---- Metrics (reporting dashboard) -----------------------------------
    @app.route("/company/metrics", methods=["GET", "OPTIONS"])
    def company_metrics():
        if request.method == "OPTIONS":
            return _cors(Response("", status=204))
        user_id = _require_user_id()
        if not user_id:
            return _cors(jsonify({"error": "user_id is required"})), 400
        return _cors(jsonify(business_data.get_metrics(user_id)))
