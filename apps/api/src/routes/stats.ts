import { Hono } from "hono";
import { eq, sql, and, gte } from "drizzle-orm";
import {
  campaigns,
  conversations,
  pharmacies,
  waSessions,
  priceRecords,
} from "@pharma-shopper/db";
import { requireAuth } from "../middleware/auth.js";
import type { AppEnv } from "../server.js";

export const statsRoutes = new Hono<AppEnv>()
  .use(requireAuth)

  .get("/dashboard", async (c) => {
    const db = c.get("db");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      [campaignStats],
      [pharmacyStats],
      [sessionStats],
      [convStats],
      [priceStats],
    ] = await Promise.all([
      db
        .select({
          total: sql<number>`count(*)::int`,
          running: sql<number>`count(*) filter (where ${campaigns.status} = 'running')::int`,
          completed: sql<number>`count(*) filter (where ${campaigns.status} = 'completed')::int`,
        })
        .from(campaigns),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(pharmacies),
      db
        .select({
          total: sql<number>`count(*)::int`,
          connected: sql<number>`count(*) filter (where ${waSessions.status} = 'connected')::int`,
        })
        .from(waSessions),
      db
        .select({
          total: sql<number>`count(*)::int`,
          today: sql<number>`count(*) filter (where ${conversations.createdAt} >= ${today})::int`,
          completed: sql<number>`count(*) filter (where ${conversations.status} = 'completed')::int`,
          awaiting: sql<number>`count(*) filter (where ${conversations.status} = 'awaiting_response')::int`,
        })
        .from(conversations),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(priceRecords),
    ]);

    const responseRate =
      convStats.total > 0
        ? Math.round((convStats.completed / convStats.total) * 100)
        : 0;

    return c.json({
      data: {
        campaigns: campaignStats,
        pharmacies: pharmacyStats,
        sessions: sessionStats,
        conversations: { ...convStats, responseRate },
        priceRecords: priceStats,
      },
    });
  })

  .get("/sessions-health", async (c) => {
    const db = c.get("db");

    const sessions = await db
      .select({
        id: waSessions.id,
        phoneNumber: waSessions.phoneNumber,
        displayName: waSessions.displayName,
        stateCode: waSessions.stateCode,
        status: waSessions.status,
        dailyMessageCount: waSessions.dailyMessageCount,
        maxDailyMessages: waSessions.maxDailyMessages,
        lastActiveAt: waSessions.lastActiveAt,
      })
      .from(waSessions)
      .orderBy(waSessions.phoneNumber);

    return c.json({ data: sessions });
  });
