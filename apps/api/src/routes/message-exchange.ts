import { Hono } from "hono";
import { desc, eq, and, like, inArray, sql } from "drizzle-orm";
import { messages, conversations, pharmacies, personas } from "@pharma-shopper/db";
import { requireAuth } from "../middleware/auth.js";
import type { AppEnv } from "../server.js";

export const messageExchangeRoutes = new Hono<AppEnv>()
  .use(requireAuth)

  .get("/", async (c) => {
    const db = c.get("db");
    const direction = c.req.query("direction"); // inbound | outbound
    const contentType = c.req.query("contentType"); // text | image | audio
    const campaignId = c.req.query("campaignId");
    const pharmacyId = c.req.query("pharmacyId");
    const search = c.req.query("search");
    const limit = Math.min(Number(c.req.query("limit") || "50"), 200);
    const offset = Number(c.req.query("offset") || "0");

    const conditions = [];
    if (direction) {
      conditions.push(eq(messages.direction, direction as "inbound" | "outbound"));
    }
    if (contentType) {
      conditions.push(eq(messages.contentType, contentType as any));
    }
    if (campaignId) {
      conditions.push(eq(conversations.campaignId, campaignId));
    }
    if (pharmacyId) {
      conditions.push(eq(conversations.pharmacyId, pharmacyId));
    }
    if (search) {
      conditions.push(like(messages.content, `%${search}%`));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        message: messages,
        conversationId: conversations.id,
        conversationStatus: conversations.status,
        conversationPhase: conversations.phase,
        campaignId: conversations.campaignId,
        pharmacyId: conversations.pharmacyId,
        pharmacyName: pharmacies.name,
        pharmacyCity: pharmacies.city,
        pharmacyState: pharmacies.state,
        pharmacyWhatsapp: pharmacies.whatsappNumber,
        personaName: personas.name,
      })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .innerJoin(pharmacies, eq(conversations.pharmacyId, pharmacies.id))
      .leftJoin(personas, eq(conversations.personaId, personas.id))
      .where(where)
      .orderBy(desc(messages.sentAt))
      .limit(limit)
      .offset(offset);

    const data = rows.map((r) => ({
      ...r.message,
      conversation: {
        id: r.conversationId,
        status: r.conversationStatus,
        phase: r.conversationPhase,
        campaignId: r.campaignId,
      },
      pharmacy: {
        id: r.pharmacyId,
        name: r.pharmacyName,
        city: r.pharmacyCity,
        state: r.pharmacyState,
        whatsappNumber: r.pharmacyWhatsapp,
      },
      personaName: r.personaName,
    }));

    // Get total count for pagination
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .innerJoin(pharmacies, eq(conversations.pharmacyId, pharmacies.id))
      .leftJoin(personas, eq(conversations.personaId, personas.id))
      .where(where);

    return c.json({
      data,
      total: countResult?.count || 0,
      limit,
      offset,
    });
  });
