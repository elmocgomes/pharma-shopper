import { Hono } from "hono";
import { z } from "zod";
import { eq, and, sql, inArray, type SQL } from "drizzle-orm";
import { Queue } from "bullmq";
import {
  campaigns,
  campaignProducts,
  campaignPharmacies,
  conversations,
  pharmacies,
  products,
  campaignStatusEnum,
} from "@pharma-shopper/db";
import { BR_STATES } from "@pharma-shopper/shared";
import { requireAuth } from "../middleware/auth.js";
import { env } from "../env.js";
import type { AppEnv } from "../server.js";

const campaignQueue = new Queue("campaign", {
  connection: { url: env.REDIS_URL },
});

const createSchema = z.object({
  name: z.string().min(1),
  targetStates: z.array(z.enum(BR_STATES)).default([]),
  businessHoursStart: z.string().optional(),
  businessHoursEnd: z.string().optional(),
  rateLimitPerHour: z.number().int().positive().optional(),
  productIds: z.array(z.string().uuid()).min(1),
  pharmacyIds: z.array(z.string().uuid()).min(1),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  targetStates: z.array(z.enum(BR_STATES)).optional(),
  businessHoursStart: z.string().optional(),
  businessHoursEnd: z.string().optional(),
  rateLimitPerHour: z.number().int().positive().optional(),
});

export const campaignRoutes = new Hono<AppEnv>()
  .use(requireAuth)

  .get("/", async (c) => {
    const db = c.get("db");
    const statusFilter = c.req.query("status") as typeof campaignStatusEnum.enumValues[number] | undefined;

    const where = statusFilter ? eq(campaigns.status, statusFilter) : undefined;

    const data = await db.select().from(campaigns).where(where).orderBy(campaigns.createdAt);

    const withCounts = await Promise.all(
      data.map(async (camp) => {
        const [{ total, completed, failed }] = await db
          .select({
            total: sql<number>`count(*)::int`,
            completed: sql<number>`count(*) filter (where ${conversations.status} = 'completed')::int`,
            failed: sql<number>`count(*) filter (where ${conversations.status} in ('failed', 'timeout'))::int`,
          })
          .from(conversations)
          .where(eq(conversations.campaignId, camp.id));

        const [{ productCount }] = await db
          .select({ productCount: sql<number>`count(*)::int` })
          .from(campaignProducts)
          .where(eq(campaignProducts.campaignId, camp.id));

        const [{ pharmacyCount }] = await db
          .select({ pharmacyCount: sql<number>`count(*)::int` })
          .from(campaignPharmacies)
          .where(eq(campaignPharmacies.campaignId, camp.id));

        return {
          ...camp,
          stats: { total, completed, failed, productCount, pharmacyCount },
        };
      }),
    );

    return c.json({ data: withCounts });
  })

  .get("/:id", async (c) => {
    const db = c.get("db");
    const [camp] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, c.req.param("id")))
      .limit(1);
    if (!camp) return c.json({ error: "Not found" }, 404);

    const prods = await db
      .select({ product: products })
      .from(campaignProducts)
      .innerJoin(products, eq(campaignProducts.productId, products.id))
      .where(eq(campaignProducts.campaignId, camp.id));

    const pharms = await db
      .select({ pharmacy: pharmacies })
      .from(campaignPharmacies)
      .innerJoin(pharmacies, eq(campaignPharmacies.pharmacyId, pharmacies.id))
      .where(eq(campaignPharmacies.campaignId, camp.id));

    const convStats = await db
      .select({
        status: conversations.status,
        count: sql<number>`count(*)::int`,
      })
      .from(conversations)
      .where(eq(conversations.campaignId, camp.id))
      .groupBy(conversations.status);

    const stateStats = await db
      .select({
        state: pharmacies.state,
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter (where ${conversations.status} = 'completed')::int`,
      })
      .from(conversations)
      .innerJoin(pharmacies, eq(conversations.pharmacyId, pharmacies.id))
      .where(eq(conversations.campaignId, camp.id))
      .groupBy(pharmacies.state);

    return c.json({
      data: {
        ...camp,
        products: prods.map((r) => r.product),
        pharmacies: pharms.map((r) => r.pharmacy),
        conversationStats: convStats,
        stateStats,
      },
    });
  })

  .get("/:id/conversations", async (c) => {
    const db = c.get("db");
    const statusFilter = c.req.query("status");
    const page = Number(c.req.query("page") || "1");
    const limit = Math.min(Number(c.req.query("limit") || "50"), 100);
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [eq(conversations.campaignId, c.req.param("id"))];
    if (statusFilter) {
      conditions.push(eq(conversations.status, statusFilter as any));
    }

    const [data, [{ count }]] = await Promise.all([
      db
        .select({ conversation: conversations, pharmacy: pharmacies })
        .from(conversations)
        .innerJoin(pharmacies, eq(conversations.pharmacyId, pharmacies.id))
        .where(and(...conditions))
        .limit(limit)
        .offset(offset)
        .orderBy(conversations.createdAt),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(conversations)
        .where(and(...conditions)),
    ]);

    const result = data.map((r) => ({
      ...r.conversation,
      pharmacy: r.pharmacy,
    }));

    return c.json({ data: result, total: count, page, limit });
  })

  .post("/", async (c) => {
    const db = c.get("db");
    const parsed = createSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

    const { productIds, pharmacyIds, ...campaignData } = parsed.data;
    const userId = c.get("userId");

    const [camp] = await db
      .insert(campaigns)
      .values({ ...campaignData, createdBy: userId })
      .returning();

    await db.insert(campaignProducts).values(
      productIds.map((productId) => ({ campaignId: camp.id, productId })),
    );

    await db.insert(campaignPharmacies).values(
      pharmacyIds.map((pharmacyId) => ({ campaignId: camp.id, pharmacyId })),
    );

    return c.json({ data: camp }, 201);
  })

  .put("/:id", async (c) => {
    const db = c.get("db");
    const parsed = updateSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

    const [camp] = await db
      .update(campaigns)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(
        and(
          eq(campaigns.id, c.req.param("id")),
          eq(campaigns.status, "draft"),
        ),
      )
      .returning();
    if (!camp) return c.json({ error: "Not found or not in draft status" }, 404);
    return c.json({ data: camp });
  })

  .post("/:id/start", async (c) => {
    const db = c.get("db");
    const [camp] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, c.req.param("id")))
      .limit(1);
    if (!camp) return c.json({ error: "Not found" }, 404);
    if (!["draft", "paused"].includes(camp.status)) {
      return c.json({ error: `Cannot start campaign in ${camp.status} status` }, 400);
    }

    await db
      .update(campaigns)
      .set({ status: "running", updatedAt: new Date() })
      .where(eq(campaigns.id, camp.id));

    await campaignQueue.add("start-campaign", { campaignId: camp.id });

    return c.json({ data: { ...camp, status: "running" } });
  })

  .post("/:id/pause", async (c) => {
    const db = c.get("db");
    const [camp] = await db
      .update(campaigns)
      .set({ status: "paused", updatedAt: new Date() })
      .where(
        and(
          eq(campaigns.id, c.req.param("id")),
          eq(campaigns.status, "running"),
        ),
      )
      .returning();
    if (!camp) return c.json({ error: "Not found or not running" }, 404);
    return c.json({ data: camp });
  })

  .post("/:id/resume", async (c) => {
    const db = c.get("db");
    const [camp] = await db
      .update(campaigns)
      .set({ status: "running", updatedAt: new Date() })
      .where(
        and(
          eq(campaigns.id, c.req.param("id")),
          eq(campaigns.status, "paused"),
        ),
      )
      .returning();
    if (!camp) return c.json({ error: "Not found or not paused" }, 404);

    await campaignQueue.add("resume-campaign", { campaignId: camp.id });

    return c.json({ data: camp });
  })

  .post("/:id/cancel", async (c) => {
    const db = c.get("db");
    const [camp] = await db
      .update(campaigns)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(
        and(
          eq(campaigns.id, c.req.param("id")),
          inArray(campaigns.status, ["draft", "scheduled", "running", "paused"]),
        ),
      )
      .returning();
    if (!camp) return c.json({ error: "Not found or already completed/cancelled" }, 404);

    await db
      .update(conversations)
      .set({ status: "failed", completedAt: new Date() })
      .where(
        and(
          eq(conversations.campaignId, camp.id),
          inArray(conversations.status, ["pending", "initial", "awaiting_response", "follow_up"]),
        ),
      );

    return c.json({ data: camp });
  })

  .delete("/:id", async (c) => {
    const db = c.get("db");
    const [camp] = await db
      .delete(campaigns)
      .where(
        and(
          eq(campaigns.id, c.req.param("id")),
          eq(campaigns.status, "draft"),
        ),
      )
      .returning();
    if (!camp) return c.json({ error: "Not found or not in draft status" }, 404);
    return c.json({ data: camp });
  });
