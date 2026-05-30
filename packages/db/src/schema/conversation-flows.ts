import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";
import { personaStyleEnum } from "./personas.js";
import { users } from "./users.js";

export const conversationFlows = pgTable(
  "conversation_flows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    personaStyle: personaStyleEnum("persona_style").notNull(),
    version: integer("version").notNull().default(1),
    isActive: boolean("is_active").notNull().default(false),
    tree: jsonb("tree").notNull().$type<Record<string, unknown>>(),
    entryNodeId: text("entry_node_id").notNull().default("greeting"),
    variablesSchema: jsonb("variables_schema").$type<Record<string, unknown>>(),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("conversation_flows_style_version_idx").on(t.personaStyle, t.version)],
);
