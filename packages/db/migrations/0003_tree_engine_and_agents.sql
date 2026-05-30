-- Migration 0003: Decision tree engine, multi-agent architecture, campaign calibration, monitoring
-- All additive — no columns dropped or renamed.

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE "calibration_status" AS ENUM ('pending', 'calibrating', 'ready', 'rejected');
CREATE TYPE "agent_type" AS ENUM ('classifier', 'analyst', 'calibrator', 'monitor');
CREATE TYPE "analysis_status" AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE "analysis_triggered_by" AS ENUM ('auto', 'manual', 'reprocess');
CREATE TYPE "mention_context" AS ENUM ('spontaneous', 'prompted', 'requested');
CREATE TYPE "health_check_status" AS ENUM ('healthy', 'warning', 'critical');

-- ============================================================
-- NEW TABLES
-- ============================================================

-- Base decision trees per persona style
CREATE TABLE "conversation_flows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "persona_style" "persona_style" NOT NULL,
  "version" integer NOT NULL DEFAULT 1,
  "is_active" boolean NOT NULL DEFAULT false,
  "tree" jsonb NOT NULL,
  "entry_node_id" text NOT NULL DEFAULT 'greeting',
  "variables_schema" jsonb,
  "created_by" uuid REFERENCES "users"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  UNIQUE("persona_style", "version")
);

-- Campaign-calibrated copies of base flows
CREATE TABLE "campaign_flows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "campaign_id" uuid NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
  "base_flow_id" uuid NOT NULL REFERENCES "conversation_flows"("id"),
  "persona_style" "persona_style" NOT NULL,
  "calibrated_tree" jsonb,
  "calibration_status" "calibration_status" NOT NULL DEFAULT 'pending',
  "calibration_diff" jsonb,
  "calibrated_by" text,
  "calibrated_at" timestamptz,
  "approved_by" uuid REFERENCES "users"("id"),
  "approved_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  UNIQUE("campaign_id", "persona_style")
);

-- Configurable AI agent definitions
CREATE TABLE "agent_configs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "agent_type" "agent_type" NOT NULL UNIQUE,
  "display_name" text NOT NULL,
  "description" text,
  "system_prompt" text,
  "model" text NOT NULL DEFAULT 'claude-sonnet-4-20250514',
  "max_tokens" integer NOT NULL DEFAULT 1024,
  "tool_schemas" jsonb NOT NULL DEFAULT '[]',
  "is_active" boolean NOT NULL DEFAULT true,
  "config" jsonb,
  "version" integer NOT NULL DEFAULT 1,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- Versioned, repeatable conversation analysis results
CREATE TABLE "conversation_analyses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversation_id" uuid NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
  "agent_type" text NOT NULL,
  "schema_version" integer NOT NULL DEFAULT 1,
  "analysis_data" jsonb,
  "status" "analysis_status" NOT NULL DEFAULT 'pending',
  "triggered_by" "analysis_triggered_by" NOT NULL DEFAULT 'auto',
  "error_message" text,
  "processed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "conversation_analyses_conv_agent_idx" ON "conversation_analyses" ("conversation_id", "agent_type");

-- Event log for conversation lifecycle
CREATE TABLE "conversation_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversation_id" uuid NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
  "event_type" text NOT NULL,
  "event_data" jsonb,
  "agent_id" text,
  "sequence_number" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "conversation_events_conv_seq_idx" ON "conversation_events" ("conversation_id", "sequence_number");

-- Rich record of every alternative product mentioned
CREATE TABLE "alternative_products" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversation_id" uuid NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
  "pharmacy_id" uuid NOT NULL REFERENCES "pharmacies"("id"),
  "analysis_id" uuid REFERENCES "conversation_analyses"("id"),
  "product_name" text NOT NULL,
  "brand" text,
  "price" numeric(10, 2),
  "availability" "availability" DEFAULT 'unknown',
  "is_generic" boolean NOT NULL DEFAULT false,
  "mention_order" integer NOT NULL DEFAULT 1,
  "mention_context" "mention_context",
  "mention_phase" text,
  "raw_quote" text,
  "matched_product_id" uuid REFERENCES "products"("id"),
  "dosage" text,
  "quantity" text,
  "presentation" text,
  "active_ingredient" text,
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "alternative_products_conv_idx" ON "alternative_products" ("conversation_id");
CREATE INDEX "alternative_products_pharmacy_idx" ON "alternative_products" ("pharmacy_id");

-- Operator ↔ AI chat per campaign
CREATE TABLE "campaign_chat_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "campaign_id" uuid NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
  "role" text NOT NULL,
  "content" text NOT NULL,
  "applied_changes" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "campaign_chat_messages_campaign_idx" ON "campaign_chat_messages" ("campaign_id");

-- Monitoring agent health check results
CREATE TABLE "conversation_health_checks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversation_id" uuid NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
  "campaign_id" uuid NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
  "check_type" text NOT NULL,
  "status" "health_check_status" NOT NULL DEFAULT 'healthy',
  "issues" jsonb NOT NULL DEFAULT '[]',
  "action_taken" text,
  "checked_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "health_checks_campaign_idx" ON "conversation_health_checks" ("campaign_id");
CREATE INDEX "health_checks_conversation_idx" ON "conversation_health_checks" ("conversation_id");

-- ============================================================
-- COLUMN ADDITIONS TO EXISTING TABLES
-- ============================================================

-- conversations: tree engine state + analysis tracking
ALTER TABLE "conversations" ADD COLUMN "flow_id" uuid REFERENCES "conversation_flows"("id");
ALTER TABLE "conversations" ADD COLUMN "current_node_id" text;
ALTER TABLE "conversations" ADD COLUMN "node_visit_count" integer NOT NULL DEFAULT 0;
ALTER TABLE "conversations" ADD COLUMN "tree_variables" jsonb;
ALTER TABLE "conversations" ADD COLUMN "analysis_status" text NOT NULL DEFAULT 'pending';

-- price_records: link to analysis
ALTER TABLE "price_records" ADD COLUMN "analysis_id" uuid REFERENCES "conversation_analyses"("id");

-- campaigns: calibration tracking
ALTER TABLE "campaigns" ADD COLUMN "calibration_status" text NOT NULL DEFAULT 'pending';

-- ============================================================
-- SEED: Default agent configs
-- ============================================================

INSERT INTO "agent_configs" ("agent_type", "display_name", "description", "model", "max_tokens", "config") VALUES
  ('classifier', 'Classificador', 'Classifica respostas de farmácias para navegação da árvore de decisão', 'claude-haiku-3-5-20241022', 150, '{"temperature": 0}'),
  ('analyst', 'Analista', 'Análise aprofundada de conversas completas — extrai preços, produtos alternativos, comportamento de substituição', 'claude-sonnet-4-20250514', 2048, '{"temperature": 0}'),
  ('calibrator', 'Calibrador', 'Ajusta templates base para produtos/terapia específicos de cada campanha', 'claude-sonnet-4-20250514', 2048, '{"temperature": 0.3}'),
  ('monitor', 'Monitor', 'Monitora conversas em andamento e detecta anomalias', 'claude-haiku-3-5-20241022', 256, '{"temperature": 0}');
