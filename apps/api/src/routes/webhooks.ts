import { Hono } from "hono";
import type { AppEnv } from "../server.js";

export const webhookRoutes = new Hono<AppEnv>()
  .post("/whatsapp/message", async (c) => {
    const body = await c.req.json();
    console.log("[webhook] incoming message:", JSON.stringify(body));
    // TODO: Sprint 2 — match to active conversation, queue parse job
    return c.json({ received: true });
  })
  .post("/whatsapp/session", async (c) => {
    const body = await c.req.json();
    console.log("[webhook] session update:", JSON.stringify(body));
    // TODO: Sprint 1 — update wa_sessions status in DB
    return c.json({ received: true });
  });
