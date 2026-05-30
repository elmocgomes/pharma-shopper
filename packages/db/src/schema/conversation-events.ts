import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { conversations } from "./conversations.js";

export const conversationEvents = pgTable(
  "conversation_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    eventData: jsonb("event_data").$type<Record<string, unknown>>(),
    agentId: text("agent_id"),
    sequenceNumber: integer("sequence_number").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("conversation_events_conv_seq_idx").on(
      t.conversationId,
      t.sequenceNumber,
    ),
  ],
);
