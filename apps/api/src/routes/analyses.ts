import { Hono } from "hono";
import { eq, and, sql } from "drizzle-orm";
import { Queue } from "bullmq";
import {
  conversationAnalyses,
  alternativeProducts,
  conversationEvents,
  conversations,
} from "@pharma-shopper/db";
import { requireAuth } from "../middleware/auth.js";
import { env } from "../env.js";
import type { AppEnv } from "../server.js";

const analystQueue = new Queue("analyst", {
  connection: { url: env.REDIS_URL },
});

export const analysisRoutes = new Hono<AppEnv>()
  .use(requireAuth)

  // Get analyses for a conversation
  .get("/conversations/:id/analyses", async (c) => {
    const db = c.get("db");
    const data = await db
      .select()
      .from(conversationAnalyses)
      .where(eq(conversationAnalyses.conversationId, c.req.param("id")))
      .orderBy(conversationAnalyses.createdAt);
    return c.json({ data });
  })

  // Get alternative products for a conversation
  .get("/conversations/:id/alternatives", async (c) => {
    const db = c.get("db");
    const data = await db
      .select()
      .from(alternativeProducts)
      .where(eq(alternativeProducts.conversationId, c.req.param("id")))
      .orderBy(alternativeProducts.mentionOrder);
    return c.json({ data });
  })

  // Get event log for a conversation
  .get("/conversations/:id/events", async (c) => {
    const db = c.get("db");
    const data = await db
      .select()
      .from(conversationEvents)
      .where(eq(conversationEvents.conversationId, c.req.param("id")))
      .orderBy(conversationEvents.sequenceNumber);
    return c.json({ data });
  })

  // Re-analyze a single conversation
  .post("/conversations/:id/reanalyze", async (c) => {
    const db = c.get("db");
    const [conv] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, c.req.param("id")))
      .limit(1);
    if (!conv) return c.json({ error: "Not found" }, 404);

    await analystQueue.add("reanalyze", {
      conversationId: conv.id,
      triggeredBy: "manual",
    });

    await db
      .update(conversations)
      .set({ analysisStatus: "pending" })
      .where(eq(conversations.id, conv.id));

    return c.json({ data: { queued: true } });
  })

  // Batch re-analyze all conversations in a campaign
  .post("/campaigns/:id/reanalyze", async (c) => {
    const db = c.get("db");
    const convs = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(
        and(
          eq(conversations.campaignId, c.req.param("id")),
          eq(conversations.status, "completed"),
        ),
      );

    for (const conv of convs) {
      await analystQueue.add("reanalyze", {
        conversationId: conv.id,
        triggeredBy: "reprocess",
      });
    }

    await db
      .update(conversations)
      .set({ analysisStatus: "pending" })
      .where(
        and(
          eq(conversations.campaignId, c.req.param("id")),
          eq(conversations.status, "completed"),
        ),
      );

    return c.json({ data: { queued: convs.length } });
  });
