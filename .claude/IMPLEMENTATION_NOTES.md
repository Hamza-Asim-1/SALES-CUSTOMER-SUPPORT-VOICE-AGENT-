# Implementation Notes — Voice Agent in Dashboard (built against voice-dashboard-spec.md)

Status: implemented. Decisions taken (from spec §13, all recommended defaults):
- **D-A** Products are Supabase-native (entered at onboarding + `/products` page). No external DB link.
- **D-B** Sentiment = Groq JSON classifier (`calling_agent/sentiment.py`).
- **D-C** REST routes for company/products/orders live in **`sales_agent_service`** (not crm) — so the
  voice tools and the dashboard share one Supabase client with zero cross-service latency during a call.
- **D-D** Browser forwards each final transcript to `/voice/session/<id>/turn` for scoring.
- **D-E** "Human joins" = dashboard operator takeover on the same call (`/handoff` + `vapi.say`).
- **D-F** Batch "N agents" UI relabelled as a **simulation**; real calls are per-lead **Call** buttons.

## What changed

### Database (`backend/docs/supabase_schema.sql` — recreate-and-run in Supabase)
New tables: `company_profile`, `products` (live price+stock), `orders`, `ai_calls`; plus a
`decrement_stock(product_id, qty)` SQL function for atomic, oversell-safe ordering. Also (re)creates the
previously-missing `users`, `Mapped_Dataset`, `users_data` tables referenced by LOCAL_SETUP.
**Action required:** paste this file into Supabase → SQL Editor → Run.

### Backend — `backend/sales_agent_service/src/calling_agent/`
- `session_store.py` — per-call `CallSession` registry + SSE pub/sub + rolling sentiment EMA + TTL sweep.
- `business_data.py` — Supabase data layer (lazy client), atomic order placement.
- `sentiment.py` — per-turn 0..100 score + emotion (angry/sad/confused/…).
- `voice_tools.py` — LLM tools: list_products / get_product_price / get_product_stock / place_order / escalate_to_human.
- `voice_session_api.py` — `POST /voice/session`, `/turn`, `GET /events` (SSE), `/handoff`, `/end`.
- `company_api.py` — `GET/POST /company/profile`, `GET/POST /company/products`, `PATCH/DELETE /company/products/<id>`, `GET /company/orders`.
- `elevenlabs_bridge.py` — `/v1/chat/completions` now reads `?session_id`, loads the business session, and uses
  **tool calling** + injects company catalog + detected emotion + escalation note. Anonymous `/voice-demo` path unchanged.
- `vapi_config.py` — `build_vapi_assistant(session=...)` binds the assistant to a session (LLM url carries `?session_id`).
- `main.py` — registers the two new route groups.
- `utils/prompts.py` — redesigned consultative sales prompts + tool/order awareness + `EMOTION_ADAPTATION`.

### Backend — crm
- `crm_integration_service/app/api/helper_function.py` — hardcoded DB password removed; now `os.getenv("PSQL_URL")`.

### Frontend
- `lib/apis/salesApi.ts` — client for voice lifecycle + company/products/orders.
- `components/voice/LiveCall.tsx` — VAPI call + live transcript + sentiment gauge/sparkline + escalation banner + human-takeover + order toasts.
- `app/sales-agent/page.tsx` — per-lead **Call** button opens LiveCall; sales/support mode toggle; batch UI relabelled simulation; removed fabricated lead data.
- `app/orders/page.tsx`, `app/products/page.tsx` — new pages (orders poll live; products CRUD with stock/price).
- `app/onboarding/page.tsx` — wired to `saveCompanyProfile` (was a dead `/api/company`); added Stock, pitch details, mode; redirects to dashboard.
- `app/login/page.tsx` — first-time businesses (no profile) routed to `/onboarding`.
- `components/dashboard-sidebar.tsx` — added Products + Orders nav.

## Env vars
Existing: `SUPABASE_URL`, `SERVICE_ROLE`, `GROQ_API_KEY`, `VAPI_PUBLIC_KEY`, `PUBLIC_URL` (= `https://fyp-sales.onrender.com` on Render).
New (optional): `SENTIMENT_ESCALATION_THRESHOLD` (default `30`), `SENTIMENT_LLM_MODEL` (defaults to `VOICE_LLM_MODEL`).
Frontend: `NEXT_PUBLIC_SALES_URL` (defaults to the Render sales URL).

## Demo flow
Sign up → onboarding (company + products with stock) → dashboard → Sales Agent → **Call** a lead →
ask price / "I'll take 3" → agent confirms total → order lands on `/orders`, stock drops on `/products` →
speak angrily → sentiment gauge drops below 30% → escalation banner → **Take over as human**.

## Not done in this pass (follow-ups)
- `reporting_service` Total Sales / Calls / Conversion cards still read their existing source — not yet
  wired to the new `orders`/`ai_calls` tables.
- Supabase RLS policies (tenant isolation is enforced in queries by `user_id`; RLS is a hardening follow-up).
