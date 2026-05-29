import {
  pgTable,
  uuid,
  text,
  numeric,
  boolean,
  timestamp,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { conversations } from "./conversations.js";
import { products } from "./products.js";
import { pharmacies } from "./pharmacies.js";

export const availabilityEnum = pgEnum("availability", [
  "in_stock",
  "out_of_stock",
  "on_order",
  "unknown",
]);

export const priceRecords = pgTable(
  "price_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id").references(() => conversations.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    pharmacyId: uuid("pharmacy_id")
      .notNull()
      .references(() => pharmacies.id),
    price: numeric("price", { precision: 10, scale: 2 }),
    currency: text("currency").notNull().default("BRL"),
    availability: availabilityEnum("availability")
      .notNull()
      .default("unknown"),
    brand: text("brand"),
    isGeneric: boolean("is_generic").notNull().default(false),
    notes: text("notes"),
    collectedAt: timestamp("collected_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("price_records_pharmacy_product_idx").on(
      t.pharmacyId,
      t.productId,
      t.collectedAt,
    ),
  ],
);
