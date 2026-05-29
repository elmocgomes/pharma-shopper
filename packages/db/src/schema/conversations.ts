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
import { campaigns } from "./campaigns.js";
import { pharmacies } from "./pharmacies.js";
import { waSessions } from "./wa-sessions.js";
import { personas } from "./personas.js";

export const conversationStatusEnum = pgEnum("conversation_status", [
  "pending",
  "initial",
  "awaiting_response",
  "parsing",
  "follow_up",
  "completed",
  "failed",
  "timeout",
]);

export const messageDirectionEnum = pgEnum("message_direction", [
  "outbound",
  "inbound",
]);

export const messageContentTypeEnum = pgEnum("message_content_type", [
  "text",
  "image",
  "audio",
  "document",
  "video",
]);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    pharmacyId: uuid("pharmacy_id")
      .notNull()
      .references(() => pharmacies.id),
    waSessionId: uuid("wa_session_id").references(() => waSessions.id),
    personaId: uuid("persona_id").references(() => personas.id),
    status: conversationStatusEnum("status").notNull().default("pending"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    retryCount: integer("retry_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("conversations_status_idx").on(t.status),
    index("conversations_wa_session_idx").on(t.waSessionId, t.status),
  ],
);

export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  direction: messageDirectionEnum("direction").notNull(),
  contentType: messageContentTypeEnum("content_type")
    .notNull()
    .default("text"),
  content: text("content"),
  mediaPath: text("media_path"),
  parsedData: jsonb("parsed_data"),
  aiGenerated: text("ai_generated").default("false"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  readAt: timestamp("read_at", { withTimezone: true }),
});
