-- CPF management on personas for pharmacy discount programs
-- Flexible follow-up limits per campaign
-- Image message tracking improvements

ALTER TABLE "personas" ADD COLUMN "cpf" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "max_follow_ups_per_phase" integer DEFAULT 3;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "follow_up_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
