import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";

export const templateCategoryEnum = pgEnum("template_category", [
  "greeting",
  "inquiry",
  "follow_up",
  "thank_you",
]);

export const messageTemplates = pgTable("message_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  category: templateCategoryEnum("category").notNull(),
  contentTemplate: text("content_template").notNull(),
  personaStyle: text("persona_style"),
  language: text("language").notNull().default("pt-BR"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
