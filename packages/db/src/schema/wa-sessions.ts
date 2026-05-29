import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  date,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { personas } from "./personas.js";

export const waSessionStatusEnum = pgEnum("wa_session_status", [
  "disconnected",
  "qr_pending",
  "connected",
  "banned",
]);

export const waSessions = pgTable(
  "wa_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    phoneNumber: text("phone_number").notNull().unique(),
    waGatewaySessionId: text("wa_gateway_session_id").notNull().unique(),
    displayName: text("display_name"),
    stateCode: text("state_code"),
    status: waSessionStatusEnum("status").notNull().default("disconnected"),
    currentPersonaId: uuid("current_persona_id").references(() => personas.id),
    personaRotationCount: integer("persona_rotation_count")
      .notNull()
      .default(0),
    dailyMessageCount: integer("daily_message_count").notNull().default(0),
    maxDailyMessages: integer("max_daily_messages").notNull().default(50),
    dailyCountResetAt: date("daily_count_reset_at"),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("wa_sessions_state_status_idx").on(t.stateCode, t.status)],
);

export const waSessionPersonas = pgTable("wa_session_personas", {
  id: uuid("id").defaultRandom().primaryKey(),
  waSessionId: uuid("wa_session_id")
    .notNull()
    .references(() => waSessions.id, { onDelete: "cascade" }),
  personaId: uuid("persona_id")
    .notNull()
    .references(() => personas.id, { onDelete: "cascade" }),
  usedCount: integer("used_count").notNull().default(0),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
});
