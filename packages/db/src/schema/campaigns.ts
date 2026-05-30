import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  time,
  pgEnum,
  primaryKey,
} from "drizzle-orm/pg-core";
import { pharmacies } from "./pharmacies.js";
import { products } from "./products.js";
import { users } from "./users.js";

export const campaignStatusEnum = pgEnum("campaign_status", [
  "draft",
  "scheduled",
  "running",
  "paused",
  "completed",
  "cancelled",
]);

export const campaigns = pgTable("campaigns", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  status: campaignStatusEnum("status").notNull().default("draft"),
  scheduleStart: timestamp("schedule_start", { withTimezone: true }),
  scheduleEnd: timestamp("schedule_end", { withTimezone: true }),
  businessHoursStart: time("business_hours_start").default("08:00"),
  businessHoursEnd: time("business_hours_end").default("18:00"),
  rateLimitPerHour: integer("rate_limit_per_hour").notNull().default(10),
  maxFollowUpsPerPhase: integer("max_follow_ups_per_phase").notNull().default(3),
  targetStates: text("target_states")
    .array()
    .notNull()
    .default([]),
  calibrationStatus: text("calibration_status").notNull().default("pending"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const campaignProducts = pgTable(
  "campaign_products",
  {
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.campaignId, t.productId] })],
);

export const campaignPharmacies = pgTable(
  "campaign_pharmacies",
  {
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    pharmacyId: uuid("pharmacy_id")
      .notNull()
      .references(() => pharmacies.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.campaignId, t.pharmacyId] })],
);
