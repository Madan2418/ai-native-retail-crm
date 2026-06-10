# Xeno Mini CRM — System Architecture

> AI-Native campaign platform for D2C brands to reach, segment, and engage shoppers at scale.

---

## Table of Contents

1. [Overview](#overview)
2. [High-Level Architecture](#high-level-architecture)
3. [Service Breakdown](#service-breakdown)
4. [Async Callback Loop](#async-callback-loop)
5. [Database Schema](#database-schema)
6. [AI Layer — Gemini Integration](#ai-layer--gemini-integration)
7. [API Reference](#api-reference)
8. [RFM Segmentation Engine](#rfm-segmentation-engine)
9. [Queue & Retry Architecture](#queue--retry-architecture)
10. [Tech Stack](#tech-stack)
11. [Project Structure](#project-structure)
12. [Campaign Execution Flow](#campaign-execution-flow)
13. [Channel Simulation Logic](#channel-simulation-logic)
14. [Deployment Architecture](#deployment-architecture)
15. [Scale Assumptions & Tradeoffs](#scale-assumptions--tradeoffs)

---

## Overview

This system is a **two-service, AI-native Mini CRM** built for a D2C or retail brand to:

- Ingest and store customer + order data
- Segment audiences by behavior and attributes (including AI-assisted NL segmentation)
- Send personalized campaigns via WhatsApp, SMS, Email, and RCS
- Track full communication lifecycle via an async callback loop
- Surface campaign analytics and AI-generated performance insights

The two services are:

| Service | Role |
|---|---|
| **CRM Backend** | Core API, AI, DB, queue, analytics |
| **Channel Service** | Stubbed delivery + async callback dispatcher |

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
│   Next.js App (Vercel)                                      │
│   ┌──────────────┐ ┌───────────────┐ ┌──────────────────┐  │
│   │  Dashboard   │ │ AI Chat UI    │ │ Analytics Views  │  │
│   │  + RFM Cards │ │ NL Campaigns  │ │ Funnel / Stats   │  │
│   └──────────────┘ └───────────────┘ └──────────────────┘  │
└───────────────────────────┬─────────────────────────────────┘
                            │ REST / JSON
┌───────────────────────────▼─────────────────────────────────┐
│                     CRM BACKEND (Service 1)                 │
│   Node.js + Express (Railway)                               │
│                                                             │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────────────┐ │
│  │ Express API │ │Gemini Service│ │  Receipt Handler     │ │
│  │ 14 routes   │ │ 6 AI endpoints│ │  Idempotent callbacks│ │
│  └─────────────┘ └──────────────┘ └──────────────────────┘ │
│                                                             │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────────────┐ │
│  │ RFM Engine  │ │  BullMQ      │ │  Channel Client      │ │
│  │ Auto-labels │ │  Job Queues  │ │  POST /send caller   │ │
│  └─────────────┘ └──────────────┘ └──────────────────────┘ │
└─────────────┬──────────────────────────────┬────────────────┘
              │ SQL                           │ POST /send
┌─────────────▼───────────┐     ┌────────────▼───────────────┐
│      DATA LAYER         │     │   CHANNEL SERVICE (Svc 2)  │
│                         │     │   Node.js + Express         │
│  PostgreSQL (Supabase)  │     │                             │
│  Redis     (Upstash)    │     │  ┌──────────────────────┐  │
│  Gemini API (Google)    │     │  │  Outcome Simulator   │  │
│                         │     │  │  Per-channel rates   │  │
└─────────────────────────┘     │  └──────────────────────┘  │
                                │  ┌──────────────────────┐  │
                                │  │  Callback Dispatcher │  │
                                │  │  Async → CRM/receipts│  │
                                │  └──────────────────────┘  │
                                └────────────────────────────┘
```

---

## Service Breakdown

### Service 1 — CRM Backend

**Responsibilities:**
- Customer and order ingestion + storage
- Segment creation (manual filters + AI-generated rules)
- Campaign creation, scheduling, and launch
- Calling the Channel Service with personalized messages
- Ingesting async delivery callbacks (idempotent)
- Serving analytics and AI insights to the frontend
- Running the RFM engine on demand

**Key modules:**

| Module | File | Purpose |
|---|---|---|
| Express API | `routes/` | All HTTP endpoints |
| Gemini Service | `services/gemini.js` | All AI calls |
| RFM Engine | `services/rfm.js` | Score + label customers |
| BullMQ Queue | `services/queue.js` | Async jobs, retries |
| Channel Client | `services/channelClient.js` | Calls Channel Service |
| DB Layer | `db/` | Schema, migrations, seed |

---

### Service 2 — Channel Service (Stubbed)

**Responsibilities:**
- Accept `POST /send` requests from CRM
- Simulate delivery outcomes with realistic per-channel probabilities
- Dispatch async callbacks back to CRM `POST /receipts`
- Handle retry simulation (simulate transient failures)

**Key modules:**

| Module | File | Purpose |
|---|---|---|
| Send Handler | `routes/send.js` | Accept messages from CRM |
| Simulator | `services/simulator.js` | Random outcome generation |
| Callback Queue | `services/callbackQueue.js` | Async dispatch with delays |

---

## Async Callback Loop

This is the core system-design centerpiece. The full lifecycle of every communication is:

```
CRM Backend                        Channel Service
     │                                   │
     │── POST /send ──────────────────►  │
     │   { recipient, message, channel,  │
     │     communicationId, metadata }   │
     │                                   │
     │                    [simulate outcome with delay]
     │                                   │
     │◄── POST /receipts ────────────────│
     │   { communicationId,              │
     │     event: "delivered",           │
     │     timestamp }                   │
     │                                   │
     │   [update communications table]   │
     │                                   │
     │◄── POST /receipts ────────────────│
     │   { event: "opened" }             │
     │                                   │
     │◄── POST /receipts ────────────────│
     │   { event: "clicked" }            │
     │                                   │
```

**Event types dispatched:**

| Event | Timing | Meaning |
|---|---|---|
| `delivered` | +2–5s | Message reached recipient |
| `failed` | +1–3s | Delivery failed |
| `opened` | +10–60s | Recipient opened message |
| `read` | +15–90s | Recipient read message |
| `clicked` | +30–180s | Recipient clicked a link |
| `converted` | +1–7 days | Order placed post-click |

**Idempotency:** Every `POST /receipts` call includes a unique `eventId`. The CRM stores processed event IDs in Redis and ignores duplicates — ensuring no double-counting even if the callback fires twice.

**Retry logic:** If the CRM `/receipts` endpoint returns non-2xx, the Channel Service retries with exponential backoff:

```
Attempt 1 → immediate
Attempt 2 → +2s
Attempt 3 → +8s
Max 3 retries, then mark as permanently failed
```

---

## Database Schema

### `customers`
```sql
CREATE TABLE customers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(255) NOT NULL,
  email          VARCHAR(255) UNIQUE,
  phone          VARCHAR(20),
  city           VARCHAR(100),
  tier           VARCHAR(50),          -- bronze / silver / gold / platinum
  tags           JSONB DEFAULT '[]',
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_city  ON customers(city);
```

### `orders`
```sql
CREATE TABLE orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id      UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  amount           NUMERIC(10,2) NOT NULL,
  product_category VARCHAR(100),
  product_name     VARCHAR(255),
  ordered_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_ordered_at  ON orders(ordered_at);
```

### `customer_rfm` (derived, auto-computed)
```sql
CREATE TABLE customer_rfm (
  customer_id    UUID PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
  recency_days   INTEGER NOT NULL,
  frequency      INTEGER NOT NULL,
  monetary       NUMERIC(10,2) NOT NULL,
  rfm_score      INTEGER NOT NULL,      -- 1–5 composite score
  segment_label  VARCHAR(50) NOT NULL,  -- Champions / At-Risk / Lost / etc.
  updated_at     TIMESTAMPTZ DEFAULT now()
);
```

### `segments`
```sql
CREATE TABLE segments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(255) NOT NULL,
  description    TEXT,
  filter_rules   JSONB NOT NULL,   -- structured filter object (see below)
  customer_count INTEGER DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT now()
);
```

**`filter_rules` JSON shape:**
```json
{
  "operator": "AND",
  "conditions": [
    { "field": "monetary", "op": "gte", "value": 5000 },
    { "field": "recency_days", "op": "gte", "value": 60 },
    { "field": "city", "op": "in", "value": ["Mumbai", "Delhi"] }
  ]
}
```

### `segment_customers`
```sql
CREATE TABLE segment_customers (
  segment_id  UUID REFERENCES segments(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  PRIMARY KEY (segment_id, customer_id)
);
```

### `campaigns`
```sql
CREATE TABLE campaigns (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(255) NOT NULL,
  segment_id   UUID REFERENCES segments(id),
  channel      VARCHAR(20) NOT NULL,  -- whatsapp / sms / email / rcs
  status       VARCHAR(20) DEFAULT 'draft', -- draft / scheduled / running / done
  scheduled_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now()
);
```

### `campaign_variants` (A/B testing)
```sql
CREATE TABLE campaign_variants (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id      UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  variant_label    VARCHAR(10) NOT NULL,   -- 'A' or 'B'
  message_template TEXT NOT NULL,
  recipient_count  INTEGER DEFAULT 0
);
```

### `communications` (one row per recipient per campaign)
```sql
CREATE TABLE communications (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id          UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  variant_id           UUID REFERENCES campaign_variants(id),
  customer_id          UUID REFERENCES customers(id),
  channel              VARCHAR(20) NOT NULL,
  personalized_message TEXT,
  status               VARCHAR(20) DEFAULT 'pending',
  sent_at              TIMESTAMPTZ,
  delivered_at         TIMESTAMPTZ,
  opened_at            TIMESTAMPTZ,
  read_at              TIMESTAMPTZ,
  clicked_at           TIMESTAMPTZ,
  converted_at         TIMESTAMPTZ
);

CREATE INDEX idx_comms_campaign_id  ON communications(campaign_id);
CREATE INDEX idx_comms_customer_id  ON communications(customer_id);
CREATE INDEX idx_comms_status       ON communications(status);
```

### `conversions`
```sql
CREATE TABLE conversions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id UUID REFERENCES communications(id),
  order_id         UUID REFERENCES orders(id),
  attributed_at    TIMESTAMPTZ DEFAULT now()
);
```

### Entity Relationship Summary

```
customers ──< orders
customers ──< customer_rfm (1:1)
customers >──< segments (via segment_customers)
segments  ──< campaigns
campaigns ──< campaign_variants
campaigns ──< communications
campaign_variants ──< communications
customers ──< communications
communications ──< conversions
orders ──< conversions
```

---

## AI Layer — Gemini Integration

All AI calls go through `services/gemini.js`. Model selection:

| Endpoint | Model | Why |
|---|---|---|
| NL campaign builder | `gemini-1.5-flash` | Low latency, interactive |
| Segment suggester | `gemini-1.5-flash` | Batch, fast enough |
| Message personalizer | `gemini-1.5-flash` | Per-recipient, high volume |
| Channel recommender | `gemini-1.5-flash` | Simple classification |
| Performance explainer | `gemini-1.5-pro` | Nuanced analysis |
| RFM insights | `gemini-1.5-flash` | Structured output |

### AI Endpoints

#### `POST /ai/build-campaign`
Natural language → full campaign spec.

**Input:**
```json
{
  "prompt": "Reach customers who spent over ₹5000 but haven't ordered in 60 days with a win-back offer"
}
```

**Output:**
```json
{
  "segment": {
    "name": "High-value lapsed customers",
    "filter_rules": {
      "operator": "AND",
      "conditions": [
        { "field": "monetary", "op": "gte", "value": 5000 },
        { "field": "recency_days", "op": "gte", "value": 60 }
      ]
    }
  },
  "message_template": "Hi {name}, we miss you! It's been a while since your last order. Here's 20% off to welcome you back — use code WINBACK20. Valid for 7 days.",
  "channel": "whatsapp",
  "reasoning": "WhatsApp recommended for this segment due to higher engagement rates vs email for lapsed customers."
}
```

#### `POST /ai/suggest-segments`
Scans customer data patterns and returns proactive suggestions.

**Output:**
```json
[
  {
    "label": "At-Risk Champions",
    "description": "47 customers who were top spenders but haven't ordered in 45+ days",
    "urgency": "high",
    "filter_rules": { ... },
    "suggested_action": "Win-back campaign with exclusive offer"
  }
]
```

#### `POST /ai/personalize`
Generates a personalized message for a single recipient.

**Input:**
```json
{
  "template": "Hi {name}, we miss you! ...",
  "customer": {
    "name": "Priya Sharma",
    "last_product": "Floral Kurta Set",
    "last_order_days_ago": 72,
    "total_spent": 8400
  }
}
```

**Output:**
```json
{
  "message": "Hi Priya, it's been 72 days since your last order — we hope you're loving your Floral Kurta Set! Here's 20% off our new summer collection just for you. Use PRIYA20 at checkout."
}
```

#### `POST /ai/recommend-channel`
Returns the best channel for a customer based on their behavior.

#### `POST /ai/explain-performance`
Takes campaign stats, returns a plain-English summary with actionable insights.

#### `GET /ai/rfm-insights`
Returns all RFM segments with AI-generated descriptions and one-click campaign buttons.

---

## API Reference

### CRM Backend Routes

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/customers` | Ingest single or bulk customers |
| `GET` | `/api/customers` | List with filters + RFM labels |
| `GET` | `/api/customers/:id` | Single customer with order history |
| `POST` | `/api/orders` | Ingest orders (triggers RFM recalc) |
| `POST` | `/api/segments` | Create segment with filter rules |
| `GET` | `/api/segments` | List all segments |
| `GET` | `/api/segments/:id/preview` | Live customer count for filter rules |
| `POST` | `/api/campaigns` | Create and launch campaign |
| `GET` | `/api/campaigns` | List all campaigns |
| `GET` | `/api/campaigns/:id/stats` | Full funnel stats for campaign |
| `POST` | `/api/receipts` | **Idempotent** callback from Channel Service |
| `POST` | `/ai/build-campaign` | NL → segment + message + channel |
| `POST` | `/ai/suggest-segments` | Proactive audience suggestions |
| `POST` | `/ai/personalize` | Per-recipient message personalization |
| `POST` | `/ai/recommend-channel` | Channel recommendation |
| `POST` | `/ai/explain-performance` | Campaign stats → insights |
| `GET` | `/ai/rfm-insights` | RFM cards with AI summaries |

### Channel Service Routes

| Method | Path | Description |
|---|---|---|
| `POST` | `/send` | Receive communication from CRM |
| `GET` | `/health` | Health check |

---

## RFM Segmentation Engine

RFM (Recency, Frequency, Monetary) is auto-computed for all customers.

### Scoring

Each dimension is scored 1–5:

```
Recency (days since last order):
  1-7   days  → score 5
  8-30  days  → score 4
  31-60 days  → score 3
  61-90 days  → score 2
  90+   days  → score 1

Frequency (number of orders):
  10+   orders → score 5
  6-9   orders → score 4
  3-5   orders → score 3
  2     orders → score 2
  1     order  → score 1

Monetary (total spend ₹):
  20000+ → score 5
  10000+ → score 4
  5000+  → score 3
  2000+  → score 2
  <2000  → score 1
```

### Segment Labels

| Label | RFM Criteria | Description |
|---|---|---|
| Champions | R≥4, F≥4, M≥4 | Best customers, buy often, spend big |
| Loyal | F≥4, M≥3 | Frequent buyers, not necessarily recent |
| Potential Loyalists | R≥4, F≤3 | Recent buyers with potential |
| At Risk | R=2-3, F≥3, M≥3 | Were good customers, losing them |
| Can't Lose | R≤2, F≥4, M≥4 | Made big purchases, haven't returned |
| Hibernating | R≤2, F≤2 | Low recency and frequency |
| Lost | R=1, F=1, M=1 | Lowest engagement across all dimensions |

### Trigger Points

RFM is recalculated:
- On demand via `GET /api/rfm/recalculate`
- Automatically when a new order is ingested
- Via a scheduled job (every 24h)

---

## Queue & Retry Architecture

### BullMQ Setup

Two queues managed by BullMQ (backed by Redis/Upstash):

```
campaign-send-queue
  └── One job per recipient per campaign
  └── Calls Channel Service POST /send
  └── Concurrency: 10 workers

receipt-process-queue
  └── One job per incoming callback
  └── Updates communications table
  └── Ensures idempotency via Redis key check
  └── Concurrency: 20 workers
```

### Retry Policy

```javascript
defaultJobOptions: {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000   // 2s, 4s, 8s
  },
  removeOnComplete: 100,
  removeOnFail: 500
}
```

### Idempotency

Every receipt callback carries an `eventId`. Before processing:

```javascript
const key = `receipt:processed:${eventId}`;
const already = await redis.get(key);
if (already) return; // silently skip duplicate

await processReceipt(payload);
await redis.set(key, '1', 'EX', 86400); // TTL 24h
```

---

## Tech Stack

| Layer | Technology | Hosting |
|---|---|---|
| Frontend | Next.js 14 + Tailwind CSS | Vercel |
| CRM Backend | Node.js + Express | Railway |
| Channel Service | Node.js + Express | Railway |
| Primary Database | PostgreSQL | Supabase |
| Job Queue | BullMQ + Redis | Upstash |
| AI | Gemini 1.5 Flash / Pro | Google AI |
| Charts | Recharts | — |
| ORM / Query | pg (node-postgres) | — |

---

## Project Structure

```
xeno-crm/
│
├── frontend/                    # Next.js App
│   ├── app/
│   │   ├── dashboard/           # RFM cards, key metrics
│   │   ├── customers/           # Customer list, detail view
│   │   ├── segments/            # Segment builder + AI assist
│   │   ├── campaigns/           # Campaign creator + launcher
│   │   └── analytics/           # Funnel charts, performance
│   ├── components/
│   │   ├── ui/                  # Button, Card, Badge, etc.
│   │   ├── AIChat.jsx           # NL campaign builder chat UI
│   │   ├── SegmentBuilder.jsx   # Filter rule builder
│   │   ├── CampaignFunnel.jsx   # Animated funnel chart
│   │   └── RFMDashboard.jsx     # RFM segment cards
│   └── lib/
│       └── api.js               # Typed API client
│
├── backend/                     # CRM API (Service 1)
│   ├── routes/
│   │   ├── customers.js
│   │   ├── orders.js
│   │   ├── segments.js
│   │   ├── campaigns.js
│   │   ├── receipts.js          # Idempotent callback handler
│   │   └── ai.js                # All Gemini endpoints
│   ├── services/
│   │   ├── gemini.js            # Gemini API wrapper
│   │   ├── rfm.js               # RFM scoring engine
│   │   ├── queue.js             # BullMQ setup + workers
│   │   └── channelClient.js     # Calls Channel Service
│   ├── db/
│   │   ├── schema.sql           # Full schema
│   │   ├── seed.js              # 100 customers, 400 orders
│   │   └── index.js             # pg pool
│   └── index.js                 # Express app entry
│
└── channel-service/             # Stubbed Channel (Service 2)
    ├── routes/
    │   └── send.js              # Accept from CRM
    ├── services/
    │   ├── simulator.js         # Outcome probabilities
    │   └── callbackQueue.js     # Async dispatch to CRM
    └── index.js
```

---

## Campaign Execution Flow

```
1. MARKETER INPUT
   Marketer types: "Reach high-value customers inactive 60+ days with a win-back"
         │
         ▼
2. GEMINI BUILDS CAMPAIGN
   POST /ai/build-campaign
   → filter_rules JSON
   → message template
   → channel recommendation
         │
         ▼
3. SEGMENT PREVIEW
   GET /api/segments/:id/preview
   → Live SQL query → customer count shown in UI
         │
         ▼
4. CAMPAIGN CREATED + LAUNCHED
   POST /api/campaigns
   → status: 'running'
   → Jobs enqueued in BullMQ (one per recipient)
         │
         ▼
5. PERSONALIZATION (per recipient)
   POST /ai/personalize
   → Gemini generates unique message per customer
   → Uses name, last product, days since order
         │
         ▼
6. CHANNEL SERVICE CALLED
   POST /channel/send
   → { communicationId, recipient, message, channel }
   → communications row: status = 'sent'
         │
         ▼
7. ASYNC SIMULATION
   Channel Service simulates outcome
   Fires callbacks with realistic delays:
   → delivered (+3s), opened (+30s), clicked (+90s)
         │
         ▼
8. CALLBACKS INGESTED
   POST /api/receipts (idempotent)
   → Redis idempotency check
   → Update communications timestamps
   → Aggregate campaign stats
         │
         ▼
9. ANALYTICS SURFACED
   GET /api/campaigns/:id/stats
   → Real-time funnel: sent → delivered → opened → clicked → converted
         │
         ▼
10. AI EXPLAINS PERFORMANCE
    POST /ai/explain-performance
    → Gemini reads stats → plain English insight
    → "Click rate 8% — above average. Recommend A/B test next."
```

---

## Channel Simulation Logic

Realistic per-channel delivery simulation in `services/simulator.js`:

| Channel | Delivered | Opened | Clicked |
|---|---|---|---|
| WhatsApp | 85% | 65% | 18% |
| SMS | 78% | 45% | 8% |
| Email | 72% | 38% | 6% |
| RCS | 80% | 55% | 14% |

**Failure modes simulated:**
- Random delivery failures (15–28% depending on channel)
- Occasional callback delivery failure (5%) → triggers retry
- Delayed callbacks (randomized within realistic windows)

**Conversion attribution:**
- If a customer places an order within 7 days of clicking, it is attributed as a conversion
- `conversions` table links `communication_id` → `order_id`

---

## Deployment Architecture

```
                    Vercel (Frontend)
                         │
                    DNS + CDN
                         │
                  Next.js App
                    /api proxy
                         │
              ┌──────────┴──────────┐
              │                     │
         Railway App 1         Railway App 2
         (CRM Backend)         (Channel Service)
         :3000                 :4000
              │
         Supabase              Upstash Redis
         PostgreSQL            (BullMQ + idempotency)
              │
         Google AI
         Gemini API
```

**Environment variables required:**

```env
# CRM Backend
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
GEMINI_API_KEY=...
CHANNEL_SERVICE_URL=https://channel.railway.app
CRM_RECEIPTS_URL=https://crm.railway.app/api/receipts

# Channel Service
CRM_RECEIPTS_URL=https://crm.railway.app/api/receipts

# Frontend
NEXT_PUBLIC_API_URL=https://crm.railway.app
```

---

## Scale Assumptions & Tradeoffs

### What this assignment assumes

| Assumption | Value |
|---|---|
| Customers | ~100 seed, ~10k max demo |
| Orders | ~400 seed, ~50k max demo |
| Campaigns | < 100 concurrent |
| Recipients per campaign | < 5,000 |
| Callback volume | < 500/min |

### Conscious tradeoffs made

| Decision | What was chosen | What would change at scale |
|---|---|---|
| Auth | No auth (single tenant) | JWT + multi-tenant RLS in Supabase |
| Queue | BullMQ (in-process) | Separate worker service, horizontal scaling |
| Personalization | Per-recipient Gemini call | Batch prompting, caching, fallback templates |
| RFM | On-demand + scheduled | Materialized view, streaming updates via CDC |
| Stats | Direct SQL aggregation | Pre-aggregated stats table updated by queue worker |
| Idempotency | Redis key (24h TTL) | Persistent idempotency log table |
| Retries | Exponential backoff (3x) | Dead-letter queue + alerting |
| CSV import | In-memory parse | Streaming CSV parse, background job |

### What I'd do at 10x scale

- Separate the receipt processor into its own stateless service behind a load balancer
- Use a materialized view for campaign stats (avoid COUNT queries per request)
- Cache Gemini personalization results for identical customer profiles
- Use Supabase realtime for live stat updates instead of polling
- Add a proper dead-letter queue and alerting for failed callbacks

---

*Built for the Xeno SDE Internship Assignment 2026 · AI-native from the ground up*
