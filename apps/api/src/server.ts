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
import { flowRoutes } from "./routes/flows.js";
import { agentRoutes } from "./routes/agents.js";
import { analysisRoutes } from "./routes/analyses.js";
import { campaignFlowRoutes } from "./routes/campaign-flows.js";
import { campaignChatRoutes } from "./routes/campaign-chat.js";
import { campaignHealthRoutes } from "./routes/campaign-health.js";

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
    .route("/settings", settingsRoutes)
    .route("/flows", flowRoutes)
    .route("/agents", agentRoutes)
    .route("/", analysisRoutes) // Mounted at root: /conversations/:id/analyses, /campaigns/:id/reanalyze
    .route("/campaigns", campaignFlowRoutes) // /campaigns/:id/flows, /campaigns/:id/calibrate
    .route("/campaigns", campaignChatRoutes) // /campaigns/:id/chat
    .route("/", campaignHealthRoutes); // /campaigns/:id/health, /conversations/:id/pause

  return app;
}
