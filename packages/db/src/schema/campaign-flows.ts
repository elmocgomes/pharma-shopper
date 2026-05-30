import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  unique,
  pgEnum,
} from "drizzle-orm/pg-core";
import { campaigns } from "./campaigns.js";
import { conversationFlows } from "./conversation-flows.js";
import { personaStyleEnum } from "./personas.js";
import { users } from "./users.js";

export const calibrationStatusEnum = pgEnum("calibration_status", [
  "pending",
  "calibrating",
  "ready",
  "rejected",
]);

export const campaignFlows = pgTable(
  "campaign_flows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    baseFlowId: uuid("base_flow_id")
      .notNull()
      .references(() => conversationFlows.id),
    personaStyle: personaStyleEnum("persona_style").notNull(),
    calibratedTree: jsonb("calibrated_tree").$type<Record<string, unknown>>(),
    calibrationStatus: calibrationStatusEnum("calibration_status")
      .notNull()
      .default("pending"),
    calibrationDiff: jsonb("calibration_diff").$type<Record<string, unknown>>(),
    calibratedBy: text("calibrated_by"),
    calibratedAt: timestamp("calibrated_at", { withTimezone: true }),
    approvedBy: uuid("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("campaign_flows_campaign_style_idx").on(t.campaignId, t.personaStyle)],
);
