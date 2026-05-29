import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { createDb, type Db } from "@pharma-shopper/db";
import { env } from "./env.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { pharmacyRoutes } from "./routes/pharmacies.js";
import { productRoutes } from "./routes/products.js";
import { personaRoutes } from "./routes/personas.js";
import { waSessionRoutes } from "./routes/wa-sessions.js";
import { campaignRoutes } from "./routes/campaigns.js";
import { conversationRoutes } from "./routes/conversations.js";
import { priceRoutes } from "./routes/prices.js";
import { statsRoutes } from "./routes/stats.js";
import { settingsRoutes } from "./routes/settings.js";

export type AppEnv = {
  Variables: {
    db: Db;
    userId?: string;
  };
};

export function createApp() {
  const db = createDb(env.DATABASE_URL);

  const app = new Hono<AppEnv>()
    .use(logger())
    .use(cors())
    .use("*", async (c, next) => {
      c.set("db", db);
      await next();
    })
    .route("/", healthRoutes)
    .route("/auth", authRoutes)
    .route("/webhooks", webhookRoutes)
    .route("/pharmacies", pharmacyRoutes)
    .route("/products", productRoutes)
    .route("/personas", personaRoutes)
    .route("/wa-sessions", waSessionRoutes)
    .route("/campaigns", campaignRoutes)
    .route("/conversations", conversationRoutes)
    .route("/prices", priceRoutes)
    .route("/stats", statsRoutes)
    .route("/settings", settingsRoutes);

  return app;
}
