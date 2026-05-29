-- Two-phase mystery shopping: substitution behavior tracking
-- Phase 1: ask about branded product, observe spontaneous substitution
-- Phase 2: probe for generics/alternatives, observe prompted substitution

CREATE TYPE "public"."conversation_phase" AS ENUM('phase1_branded', 'phase2_alternatives');--> statement-breakpoint
CREATE TYPE "public"."substitution_type" AS ENUM('requested', 'spontaneous', 'prompted', 'not_offered');--> statement-breakpoint

ALTER TABLE "conversations" ADD COLUMN "phase" "conversation_phase" DEFAULT 'phase1_branded' NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "spontaneous_substitution" boolean;--> statement-breakpoint

ALTER TABLE "price_records" ADD COLUMN "substitution_type" "substitution_type";--> statement-breakpoint
ALTER TABLE "price_records" ADD COLUMN "dosage" text;--> statement-breakpoint
ALTER TABLE "price_records" ADD COLUMN "quantity" text;--> statement-breakpoint
ALTER TABLE "price_records" ADD COLUMN "presentation" text;--> statement-breakpoint
ALTER TABLE "price_records" ADD COLUMN "conversation_phase" text;--> statement-breakpoint
