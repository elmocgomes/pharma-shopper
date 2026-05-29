import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { createDb, type Db } from "@pharma-shopper/db";
import { env } from "./env.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { webhookRoutes } from "./routes/webhooks.js";

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
    .route("/webhooks", webhookRoutes);

  return app;
}
