import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { conversations } from "./conversations.js";
import { campaigns } from "./campaigns.js";

export const healthCheckStatusEnum = pgEnum("health_check_status", [
  "healthy",
  "warning",
  "critical",
]);

export const conversationHealthChecks = pgTable(
  "conversation_health_checks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    checkType: text("check_type").notNull().$type<"periodic" | "triggered">(),
    status: healthCheckStatusEnum("status").notNull().default("healthy"),
    issues: jsonb("issues")
      .notNull()
      .default([])
      .$type<Array<{ type: string; description: string; severity: string }>>(),
    actionTaken: text("action_taken"),
    checkedAt: timestamp("checked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("health_checks_campaign_idx").on(t.campaignId),
    index("health_checks_conversation_idx").on(t.conversationId),
  ],
);
