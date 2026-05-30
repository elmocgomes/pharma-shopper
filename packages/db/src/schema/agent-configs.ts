import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";

export const agentTypeEnum = pgEnum("agent_type", [
  "classifier",
  "analyst",
  "calibrator",
  "monitor",
]);

export const agentConfigs = pgTable("agent_configs", {
  id: uuid("id").defaultRandom().primaryKey(),
  agentType: agentTypeEnum("agent_type").notNull().unique(),
  displayName: text("display_name").notNull(),
  description: text("description"),
  systemPrompt: text("system_prompt"),
  model: text("model").notNull().default("claude-sonnet-4-20250514"),
  maxTokens: integer("max_tokens").notNull().default(1024),
  toolSchemas: jsonb("tool_schemas").notNull().default([]).$type<unknown[]>(),
  isActive: boolean("is_active").notNull().default(true),
  config: jsonb("config").$type<Record<string, unknown>>(),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
