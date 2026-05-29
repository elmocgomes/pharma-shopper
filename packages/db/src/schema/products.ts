import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    activeIngredient: text("active_ingredient"),
    presentation: text("presentation"),
    anvisaCode: text("anvisa_code"),
    category: text("category"),
    isGeneric: boolean("is_generic").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("products_anvisa_code_idx").on(t.anvisaCode)],
);
