CREATE TYPE "public"."campaign_status" AS ENUM('draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."conversation_status" AS ENUM('pending', 'initial', 'awaiting_response', 'parsing', 'follow_up', 'completed', 'failed', 'timeout');--> statement-breakpoint
CREATE TYPE "public"."message_content_type" AS ENUM('text', 'image', 'audio', 'document', 'video');--> statement-breakpoint
CREATE TYPE "public"."message_direction" AS ENUM('outbound', 'inbound');--> statement-breakpoint
CREATE TYPE "public"."template_category" AS ENUM('greeting', 'inquiry', 'follow_up', 'thank_you');--> statement-breakpoint
CREATE TYPE "public"."persona_style" AS ENUM('formal', 'casual', 'anxious');--> statement-breakpoint
CREATE TYPE "public"."availability" AS ENUM('in_stock', 'out_of_stock', 'on_order', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'operator');--> statement-breakpoint
CREATE TYPE "public"."wa_session_status" AS ENUM('disconnected', 'qr_pending', 'connected', 'banned');--> statement-breakpoint
CREATE TABLE "campaign_pharmacies" (
	"campaign_id" uuid NOT NULL,
	"pharmacy_id" uuid NOT NULL,
	CONSTRAINT "campaign_pharmacies_campaign_id_pharmacy_id_pk" PRIMARY KEY("campaign_id","pharmacy_id")
);
--> statement-breakpoint
CREATE TABLE "campaign_products" (
	"campaign_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	CONSTRAINT "campaign_products_campaign_id_product_id_pk" PRIMARY KEY("campaign_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"status" "campaign_status" DEFAULT 'draft' NOT NULL,
	"schedule_start" timestamp with time zone,
	"schedule_end" timestamp with time zone,
	"business_hours_start" time DEFAULT '08:00',
	"business_hours_end" time DEFAULT '18:00',
	"rate_limit_per_hour" integer DEFAULT 10 NOT NULL,
	"target_states" text[] DEFAULT '{}' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"pharmacy_id" uuid NOT NULL,
	"wa_session_id" uuid,
	"persona_id" uuid,
	"status" "conversation_status" DEFAULT 'pending' NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"last_message_at" timestamp with time zone,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"direction" "message_direction" NOT NULL,
	"content_type" "message_content_type" DEFAULT 'text' NOT NULL,
	"content" text,
	"media_path" text,
	"parsed_data" jsonb,
	"ai_generated" text DEFAULT 'false',
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "message_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" "template_category" NOT NULL,
	"content_template" text NOT NULL,
	"persona_style" text,
	"language" text DEFAULT 'pt-BR' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"age_range" text,
	"gender" text,
	"occupation" text,
	"communication_style" "persona_style" DEFAULT 'casual' NOT NULL,
	"scenario_templates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"avatar_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pharmacies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"city" text,
	"state" text,
	"zip_code" text,
	"phone" text,
	"whatsapp_number" text NOT NULL,
	"chain" text,
	"lat" numeric(10, 7),
	"lng" numeric(10, 7),
	"source" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid,
	"product_id" uuid NOT NULL,
	"pharmacy_id" uuid NOT NULL,
	"price" numeric(10, 2),
	"currency" text DEFAULT 'BRL' NOT NULL,
	"availability" "availability" DEFAULT 'unknown' NOT NULL,
	"brand" text,
	"is_generic" boolean DEFAULT false NOT NULL,
	"notes" text,
	"collected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"active_ingredient" text,
	"presentation" text,
	"anvisa_code" text,
	"category" text,
	"is_generic" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"role" "user_role" DEFAULT 'operator' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "wa_session_personas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wa_session_id" uuid NOT NULL,
	"persona_id" uuid NOT NULL,
	"used_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "wa_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_number" text NOT NULL,
	"wa_gateway_session_id" text NOT NULL,
	"display_name" text,
	"state_code" text,
	"status" "wa_session_status" DEFAULT 'disconnected' NOT NULL,
	"current_persona_id" uuid,
	"persona_rotation_count" integer DEFAULT 0 NOT NULL,
	"daily_message_count" integer DEFAULT 0 NOT NULL,
	"max_daily_messages" integer DEFAULT 50 NOT NULL,
	"daily_count_reset_at" date,
	"last_active_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wa_sessions_phone_number_unique" UNIQUE("phone_number"),
	CONSTRAINT "wa_sessions_wa_gateway_session_id_unique" UNIQUE("wa_gateway_session_id")
);
--> statement-breakpoint
ALTER TABLE "campaign_pharmacies" ADD CONSTRAINT "campaign_pharmacies_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_pharmacies" ADD CONSTRAINT "campaign_pharmacies_pharmacy_id_pharmacies_id_fk" FOREIGN KEY ("pharmacy_id") REFERENCES "public"."pharmacies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_products" ADD CONSTRAINT "campaign_products_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_products" ADD CONSTRAINT "campaign_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_pharmacy_id_pharmacies_id_fk" FOREIGN KEY ("pharmacy_id") REFERENCES "public"."pharmacies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_wa_session_id_wa_sessions_id_fk" FOREIGN KEY ("wa_session_id") REFERENCES "public"."wa_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_persona_id_personas_id_fk" FOREIGN KEY ("persona_id") REFERENCES "public"."personas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_records" ADD CONSTRAINT "price_records_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_records" ADD CONSTRAINT "price_records_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_records" ADD CONSTRAINT "price_records_pharmacy_id_pharmacies_id_fk" FOREIGN KEY ("pharmacy_id") REFERENCES "public"."pharmacies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wa_session_personas" ADD CONSTRAINT "wa_session_personas_wa_session_id_wa_sessions_id_fk" FOREIGN KEY ("wa_session_id") REFERENCES "public"."wa_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wa_session_personas" ADD CONSTRAINT "wa_session_personas_persona_id_personas_id_fk" FOREIGN KEY ("persona_id") REFERENCES "public"."personas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wa_sessions" ADD CONSTRAINT "wa_sessions_current_persona_id_personas_id_fk" FOREIGN KEY ("current_persona_id") REFERENCES "public"."personas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversations_status_idx" ON "conversations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "conversations_wa_session_idx" ON "conversations" USING btree ("wa_session_id","status");--> statement-breakpoint
CREATE INDEX "pharmacies_city_state_idx" ON "pharmacies" USING btree ("city","state");--> statement-breakpoint
CREATE INDEX "pharmacies_state_idx" ON "pharmacies" USING btree ("state");--> statement-breakpoint
CREATE INDEX "price_records_pharmacy_product_idx" ON "price_records" USING btree ("pharmacy_id","product_id","collected_at");--> statement-breakpoint
CREATE INDEX "products_anvisa_code_idx" ON "products" USING btree ("anvisa_code");--> statement-breakpoint
CREATE INDEX "wa_sessions_state_status_idx" ON "wa_sessions" USING btree ("state_code","status");