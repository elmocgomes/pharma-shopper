import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";

export const personaStyleEnum = pgEnum("persona_style", [
  "formal",
  "casual",
  "anxious",
]);

export const personas = pgTable("personas", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  ageRange: text("age_range"),
  gender: text("gender"),
  occupation: text("occupation"),
  communicationStyle: personaStyleEnum("communication_style")
    .notNull()
    .default("casual"),
  scenarioTemplates: jsonb("scenario_templates")
    .notNull()
    .$type<string[]>()
    .default([]),
  cpf: text("cpf"),
  avatarUrl: text("avatar_url"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
