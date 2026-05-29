import { Hono } from "hono";
import { z } from "zod";
import { eq, ilike, and, sql, type SQL } from "drizzle-orm";
import { pharmacies } from "@pharma-shopper/db";
import { BR_STATES } from "@pharma-shopper/shared";
import { requireAuth } from "../middleware/auth.js";
import type { AppEnv } from "../server.js";

const createSchema = z.object({
  name: z.string().min(1),
  address: z.string().nullish(),
  city: z.string().nullish(),
  state: z.enum(BR_STATES).nullish(),
  zipCode: z.string().nullish(),
  phone: z.string().nullish(),
  whatsappNumber: z.string().min(1),
  chain: z.string().nullish(),
  lat: z.string().nullish(),
  lng: z.string().nullish(),
  source: z.string().nullish(),
  notes: z.string().nullish(),
});

const updateSchema = createSchema.partial();

export const pharmacyRoutes = new Hono<AppEnv>()
  .use(requireAuth)

  .get("/", async (c) => {
    const db = c.get("db");
    const page = Number(c.req.query("page") || "1");
    const limit = Math.min(Number(c.req.query("limit") || "50"), 100);
    const offset = (page - 1) * limit;
    const stateFilter = c.req.query("state");
    const cityFilter = c.req.query("city");
    const chainFilter = c.req.query("chain");
    const search = c.req.query("q");

    const conditions: SQL[] = [];
    if (stateFilter) conditions.push(eq(pharmacies.state, stateFilter));
    if (cityFilter) conditions.push(ilike(pharmacies.city, `%${cityFilter}%`));
    if (chainFilter) conditions.push(ilike(pharmacies.chain, `%${chainFilter}%`));
    if (search) conditions.push(ilike(pharmacies.name, `%${search}%`));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, [{ count }]] = await Promise.all([
      db.select().from(pharmacies).where(where).limit(limit).offset(offset).orderBy(pharmacies.name),
      db.select({ count: sql<number>`count(*)::int` }).from(pharmacies).where(where),
    ]);

    return c.json({ data, total: count, page, limit });
  })

  .get("/:id", async (c) => {
    const db = c.get("db");
    const [pharmacy] = await db.select().from(pharmacies).where(eq(pharmacies.id, c.req.param("id"))).limit(1);
    if (!pharmacy) return c.json({ error: "Not found" }, 404);
    return c.json({ data: pharmacy });
  })

  .post("/", async (c) => {
    const db = c.get("db");
    const parsed = createSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

    const [pharmacy] = await db.insert(pharmacies).values(parsed.data).returning();
    return c.json({ data: pharmacy }, 201);
  })

  .post("/import", async (c) => {
    const db = c.get("db");
    const body = await c.req.json() as { rows: unknown[] };
    const rows = z.array(createSchema).safeParse(body.rows);
    if (!rows.success) return c.json({ error: rows.error.flatten() }, 400);

    const inserted = await db.insert(pharmacies).values(rows.data).returning();
    return c.json({ data: inserted, count: inserted.length }, 201);
  })

  .put("/:id", async (c) => {
    const db = c.get("db");
    const parsed = updateSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

    const [pharmacy] = await db
      .update(pharmacies)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(pharmacies.id, c.req.param("id")))
      .returning();
    if (!pharmacy) return c.json({ error: "Not found" }, 404);
    return c.json({ data: pharmacy });
  })

  .delete("/:id", async (c) => {
    const db = c.get("db");
    const [pharmacy] = await db.delete(pharmacies).where(eq(pharmacies.id, c.req.param("id"))).returning();
    if (!pharmacy) return c.json({ error: "Not found" }, 404);
    return c.json({ data: pharmacy });
  });
