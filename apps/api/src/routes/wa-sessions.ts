import { Hono } from "hono";
import { z } from "zod";
import { eq, and, sql, type SQL } from "drizzle-orm";
import { waSessions, waSessionPersonas, personas, waSessionStatusEnum } from "@pharma-shopper/db";
import { BR_STATES } from "@pharma-shopper/shared";
import { WaClient } from "@pharma-shopper/wa-client";
import { requireAuth } from "../middleware/auth.js";
import { env } from "../env.js";
import type { AppEnv } from "../server.js";

const waClient = new WaClient({
  baseUrl: env.WA_GATEWAY_URL,
  apiKey: env.WA_GATEWAY_KEY,
});

const createSchema = z.object({
  phoneNumber: z.string().min(1),
  waGatewaySessionId: z.string().min(1),
  displayName: z.string().optional(),
  stateCode: z.enum(BR_STATES).optional(),
  maxDailyMessages: z.number().int().positive().optional(),
});

const updateSchema = z.object({
  displayName: z.string().optional(),
  stateCode: z.enum(BR_STATES).nullable().optional(),
  currentPersonaId: z.string().uuid().nullable().optional(),
  maxDailyMessages: z.number().int().positive().optional(),
  status: z.enum(waSessionStatusEnum.enumValues).optional(),
});

export const waSessionRoutes = new Hono<AppEnv>()
  .use(requireAuth)

  .get("/", async (c) => {
    const db = c.get("db");
    const stateFilter = c.req.query("state");
    const statusFilter = c.req.query("status") as typeof waSessionStatusEnum.enumValues[number] | undefined;

    const conditions: SQL[] = [];
    if (stateFilter) conditions.push(eq(waSessions.stateCode, stateFilter));
    if (statusFilter) conditions.push(eq(waSessions.status, statusFilter));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const data = await db
      .select({
        session: waSessions,
        persona: personas,
      })
      .from(waSessions)
      .leftJoin(personas, eq(waSessions.currentPersonaId, personas.id))
      .where(where)
      .orderBy(waSessions.phoneNumber);

    const result = data.map((row) => ({
      ...row.session,
      currentPersona: row.persona,
    }));

    return c.json({ data: result });
  })

  .get("/:id", async (c) => {
    const db = c.get("db");
    const [row] = await db
      .select({ session: waSessions, persona: personas })
      .from(waSessions)
      .leftJoin(personas, eq(waSessions.currentPersonaId, personas.id))
      .where(eq(waSessions.id, c.req.param("id")))
      .limit(1);
    if (!row) return c.json({ error: "Not found" }, 404);
    return c.json({ data: { ...row.session, currentPersona: row.persona } });
  })

  .get("/:id/personas", async (c) => {
    const db = c.get("db");
    const history = await db
      .select({
        rotation: waSessionPersonas,
        persona: personas,
      })
      .from(waSessionPersonas)
      .innerJoin(personas, eq(waSessionPersonas.personaId, personas.id))
      .where(eq(waSessionPersonas.waSessionId, c.req.param("id")))
      .orderBy(waSessionPersonas.lastUsedAt);

    const result = history.map((row) => ({
      ...row.rotation,
      persona: row.persona,
    }));

    return c.json({ data: result });
  })

  .post("/", async (c) => {
    const db = c.get("db");
    const parsed = createSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

    const [session] = await db.insert(waSessions).values(parsed.data).returning();
    return c.json({ data: session }, 201);
  })

  .put("/:id", async (c) => {
    const db = c.get("db");
    const parsed = updateSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

    const [session] = await db
      .update(waSessions)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(waSessions.id, c.req.param("id")))
      .returning();
    if (!session) return c.json({ error: "Not found" }, 404);
    return c.json({ data: session });
  })

  .delete("/:id", async (c) => {
    const db = c.get("db");
    const [session] = await db.select().from(waSessions).where(eq(waSessions.id, c.req.param("id"))).limit(1);
    if (!session) return c.json({ error: "Not found" }, 404);

    try {
      await waClient.deleteSession(session.waGatewaySessionId);
    } catch {
      // wa-gateway session may already be gone
    }

    const [deleted] = await db.delete(waSessions).where(eq(waSessions.id, c.req.param("id"))).returning();
    return c.json({ data: deleted });
  })

  // --- wa-gateway proxy routes ---

  .post("/:id/start", async (c) => {
    const db = c.get("db");
    const [session] = await db.select().from(waSessions).where(eq(waSessions.id, c.req.param("id"))).limit(1);
    if (!session) return c.json({ error: "Not found" }, 404);

    let result;
    try {
      result = await waClient.startSession(session.waGatewaySessionId);
    } catch (err: any) {
      // If session already exists in wa-gateway, delete it and retry
      if (err.message?.includes("already exist")) {
        try {
          await waClient.deleteSession(session.waGatewaySessionId);
        } catch {
          // Ignore delete errors
        }
        result = await waClient.startSession(session.waGatewaySessionId);
      } else {
        return c.json({ error: err.message || "Failed to start session" }, 500);
      }
    }

    await db
      .update(waSessions)
      .set({ status: "qr_pending", updatedAt: new Date() })
      .where(eq(waSessions.id, session.id));

    return c.json({ data: result });
  })

  .post("/:id/logout", async (c) => {
    const db = c.get("db");
    const [session] = await db.select().from(waSessions).where(eq(waSessions.id, c.req.param("id"))).limit(1);
    if (!session) return c.json({ error: "Not found" }, 404);

    await waClient.logoutSession(session.waGatewaySessionId);

    await db
      .update(waSessions)
      .set({ status: "disconnected", updatedAt: new Date() })
      .where(eq(waSessions.id, session.id));

    return c.json({ data: { ok: true } });
  })

  .get("/:id/status", async (c) => {
    const db = c.get("db");
    const [session] = await db.select().from(waSessions).where(eq(waSessions.id, c.req.param("id"))).limit(1);
    if (!session) return c.json({ error: "Not found" }, 404);

    try {
      const detail = await waClient.getSession(session.waGatewaySessionId);
      const newStatus = detail.connection?.isConnected ? "connected" : "disconnected";

      if (newStatus !== session.status) {
        await db
          .update(waSessions)
          .set({ status: newStatus, updatedAt: new Date() })
          .where(eq(waSessions.id, session.id));
      }

      return c.json({ data: { ...detail, dbStatus: newStatus } });
    } catch {
      return c.json({ data: { status: session.status } });
    }
  })

  .get("/gateway/sessions", async (c) => {
    const sessions = await waClient.listSessions();
    return c.json({ data: sessions });
  })

  .get("/stats/by-state", async (c) => {
    const db = c.get("db");
    const stats = await db
      .select({
        stateCode: waSessions.stateCode,
        total: sql<number>`count(*)::int`,
        connected: sql<number>`count(*) filter (where ${waSessions.status} = 'connected')::int`,
      })
      .from(waSessions)
      .groupBy(waSessions.stateCode);

    return c.json({ data: stats });
  });
