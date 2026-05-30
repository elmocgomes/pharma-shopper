import {
  pgTable,
  uuid,
  text,
  numeric,
  integer,
  boolean,
  timestamp,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { conversations } from "./conversations.js";
import { pharmacies } from "./pharmacies.js";
import { conversationAnalyses } from "./conversation-analyses.js";
import { products } from "./products.js";
import { availabilityEnum } from "./price-records.js";

export const mentionContextEnum = pgEnum("mention_context", [
  "spontaneous",
  "prompted",
  "requested",
]);

export const alternativeProducts = pgTable(
  "alternative_products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    pharmacyId: uuid("pharmacy_id")
      .notNull()
      .references(() => pharmacies.id),
    analysisId: uuid("analysis_id").references(() => conversationAnalyses.id),
    productName: text("product_name").notNull(),
    brand: text("brand"),
    price: numeric("price", { precision: 10, scale: 2 }),
    availability: availabilityEnum("availability").default("unknown"),
    isGeneric: boolean("is_generic").notNull().default(false),
    mentionOrder: integer("mention_order").notNull().default(1),
    mentionContext: mentionContextEnum("mention_context"),
    mentionPhase: text("mention_phase"),
    rawQuote: text("raw_quote"),
    matchedProductId: uuid("matched_product_id").references(() => products.id),
    dosage: text("dosage"),
    quantity: text("quantity"),
    presentation: text("presentation"),
    activeIngredient: text("active_ingredient"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("alternative_products_conv_idx").on(t.conversationId),
    index("alternative_products_pharmacy_idx").on(t.pharmacyId),
  ],
);
