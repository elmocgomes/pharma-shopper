import { Hono } from "hono";
import { z } from "zod";
import { eq, ilike, and, sql, type SQL } from "drizzle-orm";
import { products } from "@pharma-shopper/db";
import { requireAuth } from "../middleware/auth.js";
import type { AppEnv } from "../server.js";

const createSchema = z.object({
  name: z.string().min(1),
  activeIngredient: z.string().optional().nullable().transform((v) => v ?? undefined),
  presentation: z.string().optional().nullable().transform((v) => v ?? undefined),
  anvisaCode: z.string().optional().nullable().transform((v) => v ?? undefined),
  category: z.string().optional().nullable().transform((v) => v ?? undefined),
  isGeneric: z.boolean().optional().nullable().transform((v) => v ?? undefined),
});

const updateSchema = createSchema.partial();

export const productRoutes = new Hono<AppEnv>()
  .use(requireAuth)

  .get("/", async (c) => {
    const db = c.get("db");
    const page = Number(c.req.query("page") || "1");
    const limit = Math.min(Number(c.req.query("limit") || "50"), 100);
    const offset = (page - 1) * limit;
    const search = c.req.query("q");
    const anvisaCode = c.req.query("anvisa");
    const category = c.req.query("category");
    const isGeneric = c.req.query("generic");

    const conditions: SQL[] = [];
    if (search) conditions.push(ilike(products.name, `%${search}%`));
    if (anvisaCode) conditions.push(ilike(products.anvisaCode, `%${anvisaCode}%`));
    if (category) conditions.push(eq(products.category, category));
    if (isGeneric !== undefined && isGeneric !== null) {
      conditions.push(eq(products.isGeneric, isGeneric === "true"));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, [{ count }]] = await Promise.all([
      db.select().from(products).where(where).limit(limit).offset(offset).orderBy(products.name),
      db.select({ count: sql<number>`count(*)::int` }).from(products).where(where),
    ]);

    return c.json({ data, total: count, page, limit });
  })

  .get("/:id", async (c) => {
    const db = c.get("db");
    const [product] = await db.select().from(products).where(eq(products.id, c.req.param("id"))).limit(1);
    if (!product) return c.json({ error: "Not found" }, 404);
    return c.json({ data: product });
  })

  .post("/", async (c) => {
    const db = c.get("db");
    const parsed = createSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

    const [product] = await db.insert(products).values(parsed.data).returning();
    return c.json({ data: product }, 201);
  })

  .post("/import", async (c) => {
    const db = c.get("db");
    const body = await c.req.json() as { rows: unknown[] };
    const rows = z.array(createSchema).safeParse(body.rows);
    if (!rows.success) return c.json({ error: rows.error.flatten() }, 400);

    const inserted = await db.insert(products).values(rows.data).returning();
    return c.json({ data: inserted, count: inserted.length }, 201);
  })

  .put("/:id", async (c) => {
    const db = c.get("db");
    const parsed = updateSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

    const [product] = await db
      .update(products)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(products.id, c.req.param("id")))
      .returning();
    if (!product) return c.json({ error: "Not found" }, 404);
    return c.json({ data: product });
  })

  .delete("/:id", async (c) => {
    const db = c.get("db");
    const [product] = await db.delete(products).where(eq(products.id, c.req.param("id"))).returning();
    if (!product) return c.json({ error: "Not found" }, 404);
    return c.json({ data: product });
  });
