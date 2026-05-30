import { Hono } from "hono";
import { eq, and, sql } from "drizzle-orm";
import {
  conversationHealthChecks,
  conversations,
} from "@pharma-shopper/db";
import { requireAuth } from "../middleware/auth.js";
import type { AppEnv } from "../server.js";

export const campaignHealthRoutes = new Hono<AppEnv>()
  .use(requireAuth)

  // Aggregated health status for a campaign
  .get("/:id/health", async (c) => {
    const db = c.get("db");
    const campaignId = c.req.param("id");

    // Get latest health check per conversation
    const stats = await db
      .select({
        status: conversationHealthChecks.status,
        count: sql<number>`count(distinct ${conversationHealthChecks.conversationId})::int`,
      })
      .from(conversationHealthChecks)
      .where(eq(conversationHealthChecks.campaignId, campaignId))
      .groupBy(conversationHealthChecks.status);

    const result = { healthy: 0, warning: 0, critical: 0 };
    for (const s of stats) {
      if (s.status in result) {
        result[s.status as keyof typeof result] = s.count;
      }
    }

    const total = result.healthy + result.warning + result.critical;
    return c.json({
      data: {
        ...result,
        total,
        healthyPct: total > 0 ? Math.round((result.healthy / total) * 100) : 100,
      },
    });
  })

  // Detailed health check log
  .get("/:id/health/checks", async (c) => {
    const db = c.get("db");
    const campaignId = c.req.param("id");
    const page = Number(c.req.query("page") || "1");
    const limit = Math.min(Number(c.req.query("limit") || "50"), 100);
    const offset = (page - 1) * limit;

    const data = await db
      .select()
      .from(conversationHealthChecks)
      .where(eq(conversationHealthChecks.campaignId, campaignId))
      .orderBy(sql`${conversationHealthChecks.checkedAt} desc`)
      .limit(limit)
      .offset(offset);

    return c.json({ data, page, limit });
  })

  // Manual pause from health dashboard
  .post("/conversations/:id/pause", async (c) => {
    const db = c.get("db");
    const [conv] = await db
      .update(conversations)
      .set({ status: "failed", completedAt: new Date() })
      .where(eq(conversations.id, c.req.param("id")))
      .returning();
    if (!conv) return c.json({ error: "Not found" }, 404);
    return c.json({ data: conv });
  });
