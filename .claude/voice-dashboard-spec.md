# Spec — Live Voice Agent in Dashboard + Realtime Data, Sentiment & Orders

**Project:** AI Automation for Sales and Customer Care (FYP F24-160, NUCES Lahore)
**Spec owner:** (you)
**Status:** DRAFT for review — implementation has **not** started.
**Scope of this document:** a complete, implementation-ready plan. Read §13 (Open Decisions) before coding — a few forks need your call.

---

## 0. TL;DR — What we are building

Turn the *demo-only* browser voice agent into a **dashboard-native, business-aware sales/support agent** that:

1. Launches **in the dashboard** from a per-lead **Call** button (browser voice, no telephony).
2. Is **trained per business** at signup/onboarding (company + products + pricing + details).
3. Has **realtime access to the business's live data** (stock counts + prices) and can **answer queries and place real orders** during the call via LLM **tool calling**.
4. Runs **realtime sentiment analysis** on every call turn and **escalates to a human** when sentiment drops below **30%**.
5. Shows a **live call panel** (transcript + dialogue exchanges + realtime sentiment graph + "Human join" button) during the call.
6. Persists orders in a new **Orders** dashboard page.
7. Uses **redesigned system prompts** that pitch/convince/solve-the-problem and **adapt to vocal/emotional cues** (angry, crying, confused).

All aligned to F24-160 functional requirements §4.2.2–4.2.7 (CRM data + lead scoring, AI-driven calls + product pitching, **order placement during calls**, **call feedback + sentiment analysis**, automated reporting) and the ER model in §4.9 (`Users`, `Products`, `AI_Calls`, `CRM_Integration`, `Reports`).

---

## 1. Goals & Non-Goals

### Goals
- G1. A logged-in business can press **Call** on any lead and immediately talk to the AI agent in the browser.
- G2. The agent's knowledge is **scoped to that business** (company profile + product catalog with live price/stock), not a global demo config.
- G3. The agent can **check stock** and **place an order** mid-call against the business's live data; the order appears in the **Orders** page in realtime.
- G4. **Realtime sentiment** is computed per turn, displayed live, and **auto-escalates to a human at <30%**.
- G5. A human operator can **take over / join** an in-progress call from the live panel.
- G6. Redesigned prompts make the agent a convincing, problem-solving salesperson that **reacts to emotion**.
- G7. **Every dashboard page/function works** end-to-end (no dead buttons, no canned data passed off as real) and the build is **deployment-ready** (Docker Compose + Render + K8s manifests stay green).

### Non-Goals (explicitly out of scope, per your message)
- N1. Real telephony / PSTN calls (SignalWire/Twilio stays soft-disabled). Browser voice only.
- N2. Deploying *N* concurrent autonomous agents that auto-dial a list. "Number of agents" / batch auto-calling is **demoted to a non-blocking, clearly-labelled simulation** (or hidden) — pressing Call on one lead starts one browser conversation.
- N3. Multi-region scaling, full multi-tenant hardening beyond what's needed for the demo (we will still remove the global-config foot-gun — see §4).
- N4. Building custom AI models (we integrate Groq/VAPI as today).

---

## 2. Current-State Audit (what exists vs. what's stubbed)

| Area | Today | Verdict |
|---|---|---|
| Browser voice | `frontend/app/voice-demo` → VAPI Web SDK → `/vapi/assistant` → `/v1/chat/completions` (Groq stream) | **Works** — reuse as the engine |
| Agent config | `calling_agent/demo_config.py` — **single global in-memory `DemoConfig`** | **Blocker** — must become per-session |
| LLM brain | `elevenlabs_bridge.py` streams Groq tokens; LangGraph `single_agent_graph.py` | **No tool calling** — must add |
| Prompts | `utils/prompts.py` (`VOICE_SALES_AGENT`, `VOICE_SUPPORT_AGENT`, expressive variants) | Rewrite + add emotion handling |
| Sentiment | LangGraph `action` node, **post-call only**, emails `sales-team@example.com` | No realtime path — must add |
| Dashboard `/dashboard` | Lists mapped CRM rows from Supabase `Mapped_Dataset` | Works (read-only) |
| Dashboard `/sales-agent` | Start/Stop Celery batch → worker calls canned `/return_demo_api` | **Misleading** — repurpose to per-lead browser call |
| Onboarding `/onboarding` | POSTs to **nonexistent** `/api/company`; products/prices captured but discarded | **Broken** — wire to backend |
| Orders | **Does not exist** | Build new |
| Products / stock / price | **No table, no API** | Build new |
| DB schema file | `backend/docs/supabase_schema.sql` referenced in setup but **missing from repo** | Recreate as migration |
| Auth | Supabase Auth + JWT (`auth-service`) | Works; reuse `user.id` as tenant key |

---

## 3. Target Architecture

### 3.1 Call data flow (browser → agent → business data)
```
Dashboard (Call on Lead X)
   │  POST /voice/session  {user_id, lead_id, mode}
   ▼
sales_agent_service (Flask)
   │  creates call_session, returns {session_id, vapi_public_key, assistant}
   │  assistant.model.url = PUBLIC_URL/v1/chat/completions?session_id=...
   ▼
Browser starts VAPI Web SDK  ──audio──▶ VAPI Cloud (STT + TTS)
                                          │ per turn → POST /v1/chat/completions?session_id=...
                                          ▼
                              sales_agent_service custom-LLM
                                 │ loads session (business profile + products)
                                 │ Groq streaming + TOOL CALLING:
                                 │   • get_product_stock(name)
                                 │   • get_product_price(name)
                                 │   • place_order(product, qty, customer)
                                 │   • escalate_to_human(reason)
                                 ▼
                       Supabase (products, orders, company_profile)
   ▲                                       │
   │ VAPI events (transcript/role)         │ tool results streamed back as assistant speech
   ▼                                       ▼
Live Call Panel  ◀── WebSocket/SSE ── sentiment worker (per user turn)
  (transcript, dialogue, sentiment %, Human-join)
```

### 3.2 Realtime channels
- **Transcript**: already delivered client-side by VAPI `message`/`transcript` events (see `voice-demo/page.tsx`). Reuse.
- **Sentiment + escalation + tool/order events**: backend → browser via **SSE** stream `GET /voice/session/{id}/events` (simpler than WebSockets on Render; matches existing SSE usage in the bridge). The browser already holds the transcript; the backend scores each *final user transcript* the browser forwards via `POST /voice/session/{id}/turn`.

> **Why the browser forwards turns:** VAPI's STT result lands in the browser first. Rather than parsing VAPI's own server-webhooks (extra config, fragile on free tier), the browser POSTs each final user utterance to the backend, which scores sentiment, appends to the transcript store, and pushes results down the SSE channel. The custom-LLM endpoint independently sees the full message list from VAPI for generating replies. (See §13-D for the alternative.)

---

## 4. The per-session refactor (foundation — do this first)

**Problem:** `demo_config.current()` is one global object. Two businesses (or two leads) calling would clobber each other, and there is nowhere to attach lead context.

**Solution:** introduce a **session registry** keyed by `session_id`, carrying the resolved business + lead context. The global `demo_config` stays only as the unauthenticated `/voice-demo` fallback.

New module `calling_agent/session_store.py`:
```python
@dataclass
class CallSession:
    session_id: str
    user_id: str            # business (tenant) — Supabase auth uid
    lead_id: str | None      # the contact being called (from Mapped_Dataset)
    mode: str                # "sales" | "support"
    company_profile: dict    # from company_profile table
    products: list[dict]     # [{name, price, stock, description}]
    customer: dict           # lead name/contact/email
    transcript: list[dict]   # [{role, text, ts, sentiment?}]
    sentiment_score: float   # rolling 0..100, starts 70
    escalated: bool
    created_at, updated_at
```
- In-memory `dict[str, CallSession]` + `threading.Lock` (same pattern as `demo_config`), with a TTL sweep (e.g. 1h) so Render dynos don't leak. Persistence of the *summary* goes to `ai_calls` table on call end (durable record per ER diagram).
- `_build_system_prompt(session)` and `_compact_product(session)` take the session instead of reading the global.
- `/v1/chat/completions` reads `?session_id=` (passed in the assistant's `model.url`); if absent, falls back to global demo config (keeps `/voice-demo` working).

**Acceptance:** two browser tabs, two different businesses, simultaneous calls → each agent only knows its own company/products. No cross-talk.

---

## 5. Data Model (Supabase / Postgres)

New migration `backend/docs/supabase_schema.sql` (recreate the missing file) — additive, keyed by `user_id` (Supabase auth uid) for tenant isolation. Enable RLS later (§11).

```sql
-- 5.1 Business profile (one row per business user) — trains the agent
create table if not exists company_profile (
  user_id uuid primary key,
  company_name text not null,
  description text,
  website text,
  social_links jsonb default '[]',
  mode text default 'sales',            -- default agent mode
  agent_name text default 'Alex',
  pitch_details text,                   -- pricing/proof/target — fed to prompt
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 5.2 Products with LIVE price + stock — agent reads these in realtime
create table if not exists products (
  product_id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  description text,
  price numeric(12,2) not null default 0,
  currency text default 'USD',
  stock integer not null default 0,     -- realtime count
  sku text,
  updated_at timestamptz default now()
);
create index on products(user_id);

-- 5.3 Orders placed by the agent during calls
create table if not exists orders (
  order_id uuid primary key default gen_random_uuid(),
  user_id uuid not null,                -- business
  lead_id text,                         -- customer/contact
  session_id text,                      -- originating call
  product_id uuid references products(product_id),
  product_name text,
  quantity integer not null,
  unit_price numeric(12,2),
  total_price numeric(12,2),
  status text default 'pending',        -- pending|confirmed|cancelled|fulfilled
  customer_name text,
  customer_contact text,
  created_at timestamptz default now()
);
create index on orders(user_id);

-- 5.4 Call records (matches ER "AI_Calls") + realtime analytics
create table if not exists ai_calls (
  call_id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  lead_id text,
  session_id text unique,
  way_of_interaction text default 'voice',
  start_time timestamptz default now(),
  end_time timestamptz,
  transcript jsonb,                     -- [{role,text,ts,sentiment}]
  final_sentiment numeric,              -- 0..100
  min_sentiment numeric,
  escalated boolean default false,
  outcome text,                         -- interested|order_placed|not_interested|escalated
  conversion text,
  status text default 'in_progress'
);
create index on ai_calls(user_id);
```

> If you opt to **link an external database** instead of uploading products (§13-A), `products` becomes a *view/cache* synced from the external source, and `get_product_stock` queries the external DB through an adapter. Default plan = Supabase-native table populated at onboarding + editable in the Products page.

---

## 6. Backend changes

### 6.1 `sales_agent_service` (the core work)

**A. Session lifecycle**
- `POST /voice/session` → body `{user_id, lead_id?, mode?}`. Resolves `company_profile` + `products` + lead (from CRM service or Supabase `Mapped_Dataset`), creates `CallSession`, returns `{session_id, public_key, assistant}` where `assistant.model.url = {PUBLIC_URL}/v1/chat/completions?session_id={id}`. (Generalizes today's `/vapi/assistant`.)
- `POST /voice/session/{id}/turn` → body `{role, text}`; backend scores sentiment for user turns, appends to transcript, pushes SSE event.
- `GET /voice/session/{id}/events` → **SSE** stream of `{type: sentiment|escalation|order|tool|status, ...}`.
- `POST /voice/session/{id}/end` → finalize, persist `ai_calls` row, sweep session.
- `POST /voice/session/{id}/handoff` → mark `escalated=true`, set agent to "human present" mode (LLM yields / goes silent), broadcast SSE so any second viewer joins.

**B. Tool calling in `/v1/chat/completions`** (the order/stock capability)
- Switch the Groq call from plain streaming to **tool-enabled** chat completions. Define OpenAI-style tools:
  - `get_product_price(product_name)` → reads `products`.
  - `get_product_stock(product_name)` → reads `products.stock`.
  - `list_products()` → catalog for "what do you sell?".
  - `place_order(product_name, quantity, customer_name?, customer_contact?)` → validates stock ≥ qty, **decrements stock atomically**, inserts `orders`, returns confirmation + order_id; emits SSE `order` event.
  - `escalate_to_human(reason)` → sets escalation, emits SSE.
- **Streaming + tools reconciliation:** Groq supports tool calls in streaming. Implementation: run a **first non-streamed completion with `tools=`**; if the model returns `tool_calls`, execute them, append tool results, then **stream the final natural-language reply** to VAPI. (Keeps voice latency acceptable: only the rare order/stock turn pays the extra round-trip.) Tools are injected only when the session has products (sales mode); pure chit-chat turns skip them.
- Tool results must be **spoken cleanly** — run through existing `_clean_voice_reply`.

**C. Realtime sentiment scoring** (`sentiment.py`)
- Per user turn: fast Groq call (`llama-3.1-8b-instant`, low max_tokens) returning JSON `{sentiment: -1..1, emotion: angry|sad|confused|neutral|positive, intensity}`; map to **0..100** and update a **rolling EMA** on the session (so one bad sentence doesn't trip escalation; sustained negativity does).
- **Escalation rule:** when rolling score `< 30`, set `escalated`, emit SSE `escalation`, inject a system note into the next LLM turn ("Customer is upset — a human is joining; de-escalate, stop selling"), and surface the **Human-join** CTA. (Configurable threshold via `SENTIMENT_ESCALATION_THRESHOLD`, default 30.)
- Detected `emotion` is also passed into the prompt so the agent adapts tone (ties to §7).

**D. Per-business prompt build** — `_build_system_prompt(session)` injects `company_profile.pitch_details`, product catalog (names + prices, **not** raw stock — stock is tool-gated), agent name, and **current detected emotion**.

### 6.2 `auth-service` / onboarding API
- `POST /company/profile` (auth'd) → upsert `company_profile` for `user.id`.
- `GET /company/profile` → read for prefill + dashboard.
- `POST /company/products` / `GET /company/products` / `PATCH /company/products/{id}` / `DELETE` → CRUD for products (price/stock editable). Decide host service in §13-C (recommend: new lightweight routes in `crm_integration_service`, which already owns Supabase data; or a tiny `company` router).

### 6.3 `crm_integration_service`
- Add `GET /lead/{user_id}/{lead_id}` to fetch a single lead's name/contact/email for call context (sales_agent_service calls this when building a session). Reuses existing `Mapped_Dataset`.
- **Security fix (pre-deploy):** replace hardcoded `PSQL_URL` in `app/api/helper_function.py:10` with `os.getenv("PSQL_URL")` (called out in LOCAL_SETUP troubleshooting). Rotate the leaked DB password.

### 6.4 `reporting_service`
- Add `orders` + `ai_calls` to the metrics the dashboard reads (Total Sales, Total Calls, Conversion Rate cards in F24-160 Fig 4.3 become real instead of static).

---

## 7. System Prompt Redesign (Req #3)

Rewrite `utils/prompts.py` voice templates. Requirements:
- **Consultative sales**: open with the customer's likely pain, tie ONE product benefit to it, drive to a close; convince by problem-solving, not pushiness. Pitch ONLY the business's real products (from session catalog) — never invent.
- **Order capability awareness**: tell the model it *can* check price/stock and place orders via tools, and must confirm product + quantity + price with the customer before calling `place_order`.
- **Emotion adaptation** (new block, fed the detected `emotion`):
  - *Angry/shouting* → lower energy, short sentences, acknowledge + apologize, stop selling, offer human handoff.
  - *Crying/sad* → warm, slow, empathetic; no pitch; reassure.
  - *Confused* → simplify, one idea per turn, check understanding, slow down.
  - *Positive* → mirror enthusiasm, advance to close/order.
- Keep TTS hygiene rules already present (no markdown, 2–3 sentences, one question, expressive `[chuckles]` only in expressive mode).
- Mirror the same structure for `VOICE_SUPPORT_AGENT` (support never sells, but can still check order status + escalate).

Deliver: updated `VOICE_SALES_AGENT(_EXPRESSIVE)`, `VOICE_SUPPORT_AGENT(_EXPRESSIVE)`, plus a shared `EMOTION_ADAPTATION` snippet appended by `_build_system_prompt`.

---

## 8. Frontend changes

### 8.1 Signup → Onboarding (Req: "new business signs up… asked business/product/details")
- After signup, **redirect to `/onboarding`** (currently reachable but orphaned).
- Fix `/onboarding/page.tsx`: replace the dead `POST /api/company` with real calls — `POST /company/profile` (name, description, website, socials, mode, pitch details) and `POST /company/products` (name, price, description, **stock**). Add a **stock** field to each product row.
- On success → route to `/dashboard`. Persist nothing client-only.
- Add a **"Connect a database (optional)"** affordance per §13-A decision (default: skip; products come from this form + Products page).

### 8.2 Dashboard `/sales-agent` (Req #1, #4, #5) — the centerpiece
- Keep lead table. Repurpose the **Call** action on each lead row to open a **Live Call modal/drawer** (no telephony):
  1. `POST /voice/session {user_id, lead_id, mode}` → get `{session_id, public_key, assistant}`.
  2. Start VAPI Web SDK (reuse the `VoiceCall` logic from `voice-demo/page.tsx`, extracted into `components/voice/LiveCall.tsx`).
  3. Render the **Live Call Panel** (§8.4) beside the orb.
- **Demote "Number of agents / Start Calling" batch UI**: either hide it or relabel it clearly as a non-functional simulation (per N2). Default: hide behind a "Batch (simulation)" tab so the page isn't misleading.
- Replace `priorityScore: Math.random()` and the placeholder email/contact generation with real fields (or a deterministic score) — no fake data presented as real (G7).

### 8.3 New page `/orders` (Req: "orders shown in another page; create if not exists")
- Table of `orders` for the business: product, qty, unit/total price, customer, status, time. Live-updates (poll every few s or subscribe to the same SSE) so an order placed mid-call appears immediately.
- Add **Orders** + **Products** entries to `dashboard-sidebar.tsx`.
- New `/products` page: CRUD on catalog (edit price/stock) so "realtime stock/price" is demonstrably live.

### 8.4 Live Call Panel (Req #5) — `components/voice/CallAnalyticsPanel.tsx`
- **Transcript / dialogue exchanges**: from VAPI events (already implemented) — user vs agent bubbles.
- **Realtime sentiment**: subscribe to `GET /voice/session/{id}/events` SSE; render a **live sentiment gauge + sparkline** (recharts is already a dep) and current detected **emotion** chip.
- **Escalation banner**: when score `<30` or `escalation` event arrives → red banner + **"Join as human" / "Take over"** button.
- **Human join/takeover**: `POST /voice/session/{id}/handoff` → agent goes quiet; the human types replies (rendered as agent turns) or speaks. (Browser-single-user reality: "human" = the dashboard operator taking the wheel. See §13-E for a 2-device variant.)
- **Order toasts**: `order`/`tool` SSE events show "Order #… placed: 2× ServiceFlow AI" inline.

### 8.5 Make every page work (G7)
- `/dashboard`: ensure CRM cards (Total Contacts/Customers/Prospects/Leads) compute from real rows (currently the count tiles in Fig 4.2 are static `0`).
- `/reporting`: keep RAG chat; wire the Business Dashboard cards (Total Sales/Calls/Conversion) to `reporting_service` metrics from `orders`+`ai_calls`.
- Remove/disable any button with no handler; fix hardcoded auth/reporting URLs noted in LOCAL_SETUP for local dev via env.

---

## 9. Realtime Sentiment & Escalation (Req #2) — detail

- **Trigger:** every final **user** transcript (forwarded via `/turn`).
- **Score:** Groq JSON classification → normalize to 0–100; maintain `EMA(score, α=0.5)` on the session.
- **Display:** push `{type:'sentiment', score, emotion}` over SSE each turn.
- **Escalate when** `ema < 30` (env-tunable) **and not already escalated** → `{type:'escalation', reason}`; persist `ai_calls.escalated=true`, `min_sentiment`.
- **Agent reaction:** next system prompt gains "Customer is upset; a human is joining — de-escalate, stop pitching."
- **Human path:** operator clicks **Take over** → `/handoff`; optionally email/notify (reuse `EmailSender`).
- **Acceptance:** scripted angry call drives gauge below 30 within ~2–3 negative turns, banner appears, takeover silences the agent.

---

## 10. Tool-Calling & Order Placement (Req #1) — detail

- **Stock/price queries** (`get_product_stock`, `get_product_price`, `list_products`): read-only Supabase; sub-200ms; results spoken naturally.
- **Order** (`place_order`): server-side validation — product exists for this `user_id`, `qty>0`, `stock>=qty`; **atomic decrement** (`update products set stock=stock-:q where product_id=:id and stock>=:q` and check affected rows) to prevent overselling; insert `orders`; emit SSE `order`. The agent must **read back product + qty + total price and get a yes** before calling the tool (enforced in prompt).
- **Out-of-stock / insufficient stock:** tool returns a typed error; agent offers alternatives or backorder, never fabricates availability.
- **Acceptance:** "I'll take 3 of X" → agent confirms price/total → on "yes" → order row appears on `/orders` and stock drops by 3 on `/products`, all without refresh.

---

## 11. Security & Deployment Readiness (G7)

- Remove hardcoded `PSQL_URL` (`crm_integration_service/app/api/helper_function.py:10`); use env; rotate password.
- Replace hardcoded user fallback `6921`; require real JWT-derived `user.id` as tenant key everywhere.
- Tenant isolation: every new query filters by `user_id`; plan Supabase **RLS** policies (post-MVP toggle).
- CORS: keep `*` for demo but document the production allow-list tightening (already noted in LOCAL_SETUP).
- New env vars: `SENTIMENT_ESCALATION_THRESHOLD` (default 30), reuse `VAPI_PUBLIC_KEY`, `PUBLIC_URL`, `GROQ_API_KEY`.
- Keep **Docker Compose**, **render.yaml**, and **k8s** manifests building; add the new env vars + any new routes to all three. New tables via the recreated `supabase_schema.sql`.
- No secrets committed (`backend/.env` stays gitignored).

---

## 12. Phased Implementation Plan (with acceptance gates)

> Each phase is independently demoable. Order chosen so the foundation lands first and nothing half-wires.

- **Phase 0 — DB & cleanup (0.5d):** recreate `supabase_schema.sql` (§5), apply in Supabase; remove hardcoded `PSQL_URL`/`6921`. *Gate:* tables exist; CRM still works.
- **Phase 1 — Per-session refactor (1–1.5d):** `session_store.py`; `/voice/session*` endpoints; `/v1/chat/completions?session_id`; global config kept as fallback. *Gate:* two businesses, no cross-talk (§4).
- **Phase 2 — Onboarding wiring (1d):** `company_profile` + `products` APIs; fix `/onboarding` (add stock); signup→onboarding→dashboard. *Gate:* a new business's data persists and prefills.
- **Phase 3 — Prompts + emotion (0.5–1d):** rewrite voice prompts (§7); inject company/products + emotion. *Gate:* agent pitches the business's real product convincingly; tone shifts on scripted angry/sad/confused input.
- **Phase 4 — Realtime sentiment + SSE (1–1.5d):** `sentiment.py`; `/turn` + `/events` SSE; rolling EMA + escalation. *Gate:* gauge moves live, escalates <30.
- **Phase 5 — Tool calling + orders (1.5–2d):** Groq tools; stock/price/list/place_order/escalate; atomic stock decrement. *Gate:* order placed by voice appears on `/orders`, stock decrements (§10).
- **Phase 6 — Dashboard call UX (1.5–2d):** extract `LiveCall`, per-lead **Call** modal, **CallAnalyticsPanel** (transcript+sentiment+human-join+order toasts), demote batch UI. *Gate:* Req #5 fully visible.
- **Phase 7 — New pages + real metrics (1d):** `/orders`, `/products`, real dashboard/reporting cards, sidebar entries. *Gate:* G7 — no dead buttons / fake-as-real data.
- **Phase 8 — Hardening & deploy (1d):** env wiring across Compose/Render/K8s, smoke-test the LOCAL_SETUP walkthrough checklist, end-to-end demo script. *Gate:* clean deploy + full happy-path demo.

**Rough total:** ~9–12 working days.

---

## 13. Open Decisions — NEED YOUR INPUT before/early in coding

- **D-A. Product data source:** (1) **Upload/enter products in onboarding + Products page** (Supabase-native, simplest, fully realtime via the Products page) — *recommended*; or (2) **link an external database** (you provide connection string; we build a read adapter + sync). Linking is more "realtime DB" but adds connector complexity and credentials handling. **Which?**
- **D-B. Sentiment engine:** (1) **Groq LLM JSON classifier** (no new dep, ~300–500ms/turn) — *recommended*; or (2) a dedicated sentiment model/service. **OK with Groq?**
- **D-C. Where do `company`/`products`/`orders` REST routes live:** `crm_integration_service` (owns Supabase data) vs `sales_agent_service` vs `auth-service`. *Recommend crm_integration_service.* **Preference?**
- **D-D. Turn capture for sentiment:** browser forwards final transcripts to `/turn` (*recommended, simplest*) vs configuring VAPI server-webhooks to the backend. **OK with browser-forward?**
- **D-E. "Human agent joins" semantics:** (1) **dashboard operator takes over** the same browser call (single-machine, demo-friendly) — *recommended*; or (2) **second device/operator** joins via a shared session link (needs VAPI multi-participant or a relay). **Which fidelity do you need for the FYP demo?**
- **D-F. Batch "N agents / Start Calling" UI:** hide entirely, or keep as a clearly-labelled "simulation" tab? *Recommend hide for the graded demo.*

---

## 14. Risks & Mitigations
- **R1 Voice latency with tools** → only sales turns load tools; stock/price are single fast reads; order confirm is a deliberate two-step. Mitigate with `llama-3.1-8b-instant` for chat, tool round-trip only when needed.
- **R2 Render free-tier cold starts / SSE drops** → reuse existing cold-start retry; SSE auto-reconnect on the client; session TTL + persist-on-end so a dropped socket doesn't lose the call record.
- **R3 Overselling stock** → atomic conditional UPDATE with affected-row check (§10).
- **R4 VAPI custom-llm path quirks** (already handled with multiple route aliases) → keep aliases; pass `session_id` as query param (survives all path variants).
- **R5 Multi-tenant leakage** → every query filtered by `user_id`; global config only for anonymous `/voice-demo`.
- **R6 Groq rate limits during demo** → cache catalog per session; keep prompts compact (existing `_compact_*` helpers).

---

## 15. Test / Demo Script (acceptance)
1. Sign up new business "Acme Coffee" → onboarding: company + 2 products (Beans $20/stock 10, Mug $8/stock 5) → land on dashboard.
2. `/products` shows both; edit Beans stock to 3.
3. `/sales-agent` → press **Call** on a lead → talk: "What do you sell and how much are the beans?" → agent lists products + $20 (tool).
4. "I'll take 5 bags" → agent: only 3 in stock → offers 3 → "ok, 3" → confirms $60 → "yes" → order placed.
5. `/orders` shows the order; `/products` Beans stock now 0 — **no refresh**.
6. New call → speak angrily ("this is useless, I'm furious") → sentiment gauge drops <30 → escalation banner → **Take over** → agent goes quiet, operator replies.
7. Switch a call to **support** mode → agent helps, never pitches, can check order status.
8. `/dashboard` + `/reporting` cards reflect the new call + order (real metrics).
9. `docker compose up --build` + Render deploy green; LOCAL_SETUP walkthrough checklist all pass.

---

*End of spec. Implementation begins only after §13 decisions are confirmed.*
