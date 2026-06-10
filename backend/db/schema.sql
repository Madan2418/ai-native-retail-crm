-- ============================================================
-- Xeno Mini CRM — Full Database Schema
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(255) NOT NULL,
  email          VARCHAR(255) UNIQUE,
  phone          VARCHAR(20),
  city           VARCHAR(100),
  tier           VARCHAR(50) DEFAULT 'bronze',  -- bronze / silver / gold / platinum
  tags           JSONB DEFAULT '[]',
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_city  ON customers(city);
CREATE INDEX IF NOT EXISTS idx_customers_tier  ON customers(tier);

-- ============================================================
-- ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id      UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  amount           NUMERIC(10,2) NOT NULL,
  product_category VARCHAR(100),
  product_name     VARCHAR(255),
  ordered_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_ordered_at  ON orders(ordered_at);

-- ============================================================
-- CUSTOMER RFM (derived, auto-computed)
-- ============================================================
CREATE TABLE IF NOT EXISTS customer_rfm (
  customer_id    UUID PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
  recency_days   INTEGER NOT NULL DEFAULT 0,
  frequency      INTEGER NOT NULL DEFAULT 0,
  monetary       NUMERIC(10,2) NOT NULL DEFAULT 0,
  r_score        INTEGER NOT NULL DEFAULT 1,
  f_score        INTEGER NOT NULL DEFAULT 1,
  m_score        INTEGER NOT NULL DEFAULT 1,
  rfm_score      INTEGER NOT NULL DEFAULT 1,  -- composite 1–5
  segment_label  VARCHAR(50) NOT NULL DEFAULT 'Lost',
  updated_at     TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- SEGMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS segments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(255) NOT NULL,
  description    TEXT,
  filter_rules   JSONB NOT NULL DEFAULT '{"operator":"AND","conditions":[]}',
  customer_count INTEGER DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- SEGMENT <-> CUSTOMER (junction)
-- ============================================================
CREATE TABLE IF NOT EXISTS segment_customers (
  segment_id  UUID REFERENCES segments(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  PRIMARY KEY (segment_id, customer_id)
);

-- ============================================================
-- CAMPAIGNS
-- ============================================================
CREATE TABLE IF NOT EXISTS campaigns (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(255) NOT NULL,
  segment_id   UUID REFERENCES segments(id),
  channel      VARCHAR(20) NOT NULL DEFAULT 'whatsapp', -- whatsapp / sms / email / rcs
  status       VARCHAR(20) DEFAULT 'draft',             -- draft / scheduled / running / done
  scheduled_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- CAMPAIGN VARIANTS (A/B testing)
-- ============================================================
CREATE TABLE IF NOT EXISTS campaign_variants (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id      UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  variant_label    VARCHAR(10) NOT NULL DEFAULT 'A',
  message_template TEXT NOT NULL,
  recipient_count  INTEGER DEFAULT 0
);

-- ============================================================
-- COMMUNICATIONS (one row per recipient per campaign)
-- ============================================================
CREATE TABLE IF NOT EXISTS communications (
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
  converted_at         TIMESTAMPTZ,
  failed_reason        TEXT
);

CREATE INDEX IF NOT EXISTS idx_comms_campaign_id ON communications(campaign_id);
CREATE INDEX IF NOT EXISTS idx_comms_customer_id ON communications(customer_id);
CREATE INDEX IF NOT EXISTS idx_comms_status      ON communications(status);

-- ============================================================
-- CONVERSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS conversions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id UUID REFERENCES communications(id),
  order_id         UUID REFERENCES orders(id),
  attributed_at    TIMESTAMPTZ DEFAULT now()
);
