# Xeno Mini CRM — AI-Native Campaign Platform

> AI-native campaign platform for D2C brands to reach, segment, and engage shoppers at scale.

## Quick Start

### Prerequisites
- Node.js 18+
- Supabase project (PostgreSQL)
- Upstash Redis
- Google Gemini API key

### 1. Backend Setup

```bash
cd backend
cp .env.example .env
# Fill in DATABASE_URL, REDIS_URL, GEMINI_API_KEY
npm install
node db/seed.js   # Seeds 100 customers + 400 orders + RFM scores
npm run dev       # Runs on :3000
```

### 2. Channel Service Setup

```bash
cd channel-service
cp .env.example .env
# Set CRM_RECEIPTS_URL=http://localhost:3000/api/receipts
npm install
npm run dev       # Runs on :4000
```

### 3. Frontend Setup

```bash
cd frontend
# .env.local already has NEXT_PUBLIC_API_URL=http://localhost:3000
npm install
npm run dev       # Runs on :3001
```

Open [http://localhost:3001/dashboard](http://localhost:3001/dashboard)

---

## Environment Variables

### Backend (`.env`)
| Variable | Description |
|---|---|
| `DATABASE_URL` | Supabase PostgreSQL connection string |
| `REDIS_URL` | Upstash Redis URL |
| `GEMINI_API_KEY` | Google AI Studio API key |
| `CHANNEL_SERVICE_URL` | URL of the Channel Service (default: http://localhost:4000) |
| `CRM_RECEIPTS_URL` | This service's receipts endpoint for callbacks |
| `FRONTEND_URL` | Frontend URL for CORS (default: http://localhost:3001) |

### Channel Service (`.env`)
| Variable | Description |
|---|---|
| `CRM_RECEIPTS_URL` | CRM backend receipts endpoint |

### Frontend (`.env.local`)
| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | CRM Backend base URL |

---

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full system design.

**Two-service design:**
- **CRM Backend** (`:3000`) — Core API, Gemini AI, BullMQ queues, RFM engine
- **Channel Service** (`:4000`) — Stubbed delivery with async callbacks
- **Frontend** (`:3001`) — Next.js 14 dashboard

---

## Key Features

- 🤖 **AI Campaign Builder** — Natural language → segment + message + channel via Gemini
- 📊 **RFM Segmentation** — Auto-scored, auto-labeled customer segments
- 💬 **Multi-Channel** — WhatsApp, SMS, Email, RCS (simulated)
- 🔄 **Async Callback Loop** — Full `sent → delivered → opened → clicked → converted` lifecycle
- ⚡ **BullMQ Queues** — Reliable job processing with exponential retry
- 🔑 **Idempotent Receipts** — Redis-keyed deduplication for callbacks
- 🎯 **AI Insights** — Gemini-powered campaign performance explanations

---

*Built for Xeno SDE Internship Assignment 2026*
