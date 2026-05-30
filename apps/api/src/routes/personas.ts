import { Hono } from "hono";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { personas, personaStyleEnum } from "@pharma-shopper/db";
import { requireAuth } from "../middleware/auth.js";
import type { AppEnv } from "../server.js";

const createSchema = z.object({
  name: z.string().min(1),
  ageRange: z.string().optional().nullable().transform((v) => v ?? undefined),
  gender: z.string().optional().nullable().transform((v) => v ?? undefined),
  occupation: z.string().optional().nullable().transform((v) => v ?? undefined),
  cpf: z.string().optional().nullable().transform((v) => v ?? undefined),
  communicationStyle: z.enum(personaStyleEnum.enumValues).optional().nullable().transform((v) => v ?? undefined),
  scenarioTemplates: z.array(z.string()).optional().nullable().transform((v) => v ?? undefined),
  avatarUrl: z.string().url().optional().nullable().transform((v) => v ?? undefined).or(z.literal("")),
  isActive: z.boolean().optional().nullable().transform((v) => v ?? undefined),
});

const updateSchema = createSchema.partial();

export const personaRoutes = new Hono<AppEnv>()
  .use(requireAuth)

  .get("/", async (c) => {
    const db = c.get("db");
    const activeOnly = c.req.query("active") === "true";

    const where = activeOnly ? eq(personas.isActive, true) : undefined;

    const [data, [{ count }]] = await Promise.all([
      db.select().from(personas).where(where).orderBy(personas.name),
      db.select({ count: sql<number>`count(*)::int` }).from(personas).where(where),
    ]);

    return c.json({ data, total: count });
  })

  .get("/:id", async (c) => {
    const db = c.get("db");
    const [persona] = await db.select().from(personas).where(eq(personas.id, c.req.param("id"))).limit(1);
    if (!persona) return c.json({ error: "Not found" }, 404);
    return c.json({ data: persona });
  })

  .post("/", async (c) => {
    const db = c.get("db");
    const parsed = createSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

    const [persona] = await db.insert(personas).values(parsed.data).returning();
    return c.json({ data: persona }, 201);
  })

  .put("/:id", async (c) => {
    const db = c.get("db");
    const parsed = updateSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

    const [persona] = await db
      .update(personas)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(personas.id, c.req.param("id")))
      .returning();
    if (!persona) return c.json({ error: "Not found" }, 404);
    return c.json({ data: persona });
  })

  .delete("/:id", async (c) => {
    const db = c.get("db");
    const [persona] = await db.delete(personas).where(eq(personas.id, c.req.param("id"))).returning();
    if (!persona) return c.json({ error: "Not found" }, 404);
    return c.json({ data: persona });
  });
