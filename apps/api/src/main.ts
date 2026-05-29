import "dotenv/config";
import { serve } from "@hono/node-server";
import { createApp } from "./server.js";
import { env } from "./env.js";

const app = createApp();

serve({ fetch: app.fetch, port: env.PORT }, () => {
  console.log(`API server running on port ${env.PORT}`);
});
