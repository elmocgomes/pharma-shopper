import { Hono } from "hono";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { conversationFlows, personaStyleEnum } from "@pharma-shopper/db";
import { requireAuth } from "../middleware/auth.js";
import type { AppEnv } from "../server.js";

const createSchema = z.object({
  name: z.string().min(1),
  personaStyle: z.enum(personaStyleEnum.enumValues),
  tree: z.record(z.unknown()),
  entryNodeId: z.string().default("greeting"),
  variablesSchema: z.record(z.unknown()).optional().nullable(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  tree: z.record(z.unknown()).optional(),
  entryNodeId: z.string().optional(),
  variablesSchema: z.record(z.unknown()).optional().nullable(),
});

export const flowRoutes = new Hono<AppEnv>()
  .use(requireAuth)

  .get("/", async (c) => {
    const db = c.get("db");
    const styleFilter = c.req.query("style") as typeof personaStyleEnum.enumValues[number] | undefined;
    const activeOnly = c.req.query("active") === "true";

    let where;
    if (styleFilter && activeOnly) {
      where = and(eq(conversationFlows.personaStyle, styleFilter), eq(conversationFlows.isActive, true));
    } else if (styleFilter) {
      where = eq(conversationFlows.personaStyle, styleFilter);
    } else if (activeOnly) {
      where = eq(conversationFlows.isActive, true);
    }

    const data = await db.select().from(conversationFlows).where(where).orderBy(conversationFlows.personaStyle, conversationFlows.version);
    return c.json({ data });
  })

  .get("/:id", async (c) => {
    const db = c.get("db");
    const [flow] = await db.select().from(conversationFlows).where(eq(conversationFlows.id, c.req.param("id"))).limit(1);
    if (!flow) return c.json({ error: "Not found" }, 404);
    return c.json({ data: flow });
  })

  .post("/", async (c) => {
    const db = c.get("db");
    const parsed = createSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

    const userId = c.get("userId");
    const [flow] = await db.insert(conversationFlows).values({
      ...parsed.data,
      tree: parsed.data.tree as Record<string, unknown>,
      variablesSchema: parsed.data.variablesSchema as Record<string, unknown> | undefined,
      createdBy: userId,
    }).returning();
    return c.json({ data: flow }, 201);
  })

  .put("/:id", async (c) => {
    const db = c.get("db");
    const parsed = updateSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

    const [flow] = await db
      .update(conversationFlows)
      .set({ ...parsed.data, updatedAt: new Date() } as any)
      .where(eq(conversationFlows.id, c.req.param("id")))
      .returning();
    if (!flow) return c.json({ error: "Not found" }, 404);
    return c.json({ data: flow });
  })

  .post("/:id/activate", async (c) => {
    const db = c.get("db");
    const [flow] = await db.select().from(conversationFlows).where(eq(conversationFlows.id, c.req.param("id"))).limit(1);
    if (!flow) return c.json({ error: "Not found" }, 404);

    // Deactivate other flows for the same persona style
    await db
      .update(conversationFlows)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(conversationFlows.personaStyle, flow.personaStyle));

    // Activate this one
    const [updated] = await db
      .update(conversationFlows)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(conversationFlows.id, flow.id))
      .returning();
    return c.json({ data: updated });
  })

  .post("/:id/duplicate", async (c) => {
    const db = c.get("db");
    const [flow] = await db.select().from(conversationFlows).where(eq(conversationFlows.id, c.req.param("id"))).limit(1);
    if (!flow) return c.json({ error: "Not found" }, 404);

    const [copy] = await db.insert(conversationFlows).values({
      name: `${flow.name} (cópia)`,
      personaStyle: flow.personaStyle,
      version: flow.version + 1,
      tree: flow.tree,
      entryNodeId: flow.entryNodeId,
      variablesSchema: flow.variablesSchema,
      createdBy: c.get("userId"),
    }).returning();
    return c.json({ data: copy }, 201);
  });
