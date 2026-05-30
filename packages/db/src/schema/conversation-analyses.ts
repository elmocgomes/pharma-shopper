import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { conversations } from "./conversations.js";

export const analysisStatusEnum = pgEnum("analysis_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);

export const analysisTriggeredByEnum = pgEnum("analysis_triggered_by", [
  "auto",
  "manual",
  "reprocess",
]);

export const conversationAnalyses = pgTable(
  "conversation_analyses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    agentType: text("agent_type").notNull(),
    schemaVersion: integer("schema_version").notNull().default(1),
    analysisData: jsonb("analysis_data").$type<Record<string, unknown>>(),
    status: analysisStatusEnum("status").notNull().default("pending"),
    triggeredBy: analysisTriggeredByEnum("triggered_by")
      .notNull()
      .default("auto"),
    errorMessage: text("error_message"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("conversation_analyses_conv_agent_idx").on(
      t.conversationId,
      t.agentType,
    ),
  ],
);
