import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { agentConfigs, agentTypeEnum } from "@pharma-shopper/db";
import { requireAuth } from "../middleware/auth.js";
import type { AppEnv } from "../server.js";

const updateSchema = z.object({
  displayName: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  systemPrompt: z.string().optional().nullable(),
  model: z.string().optional(),
  maxTokens: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
  config: z.record(z.unknown()).optional().nullable(),
});

export const agentRoutes = new Hono<AppEnv>()
  .use(requireAuth)

  .get("/", async (c) => {
    const db = c.get("db");
    const data = await db.select().from(agentConfigs).orderBy(agentConfigs.agentType);
    return c.json({ data });
  })

  .get("/:type", async (c) => {
    const db = c.get("db");
    const [agent] = await db
      .select()
      .from(agentConfigs)
      .where(eq(agentConfigs.agentType, c.req.param("type") as any))
      .limit(1);
    if (!agent) return c.json({ error: "Not found" }, 404);
    return c.json({ data: agent });
  })

  .put("/:type", async (c) => {
    const db = c.get("db");
    const parsed = updateSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

    const [agent] = await db
      .update(agentConfigs)
      .set({
        ...parsed.data,
        config: parsed.data.config as Record<string, unknown> | undefined,
        version: eq(agentConfigs.agentType, c.req.param("type") as any) ? undefined : undefined,
        updatedAt: new Date(),
      })
      .where(eq(agentConfigs.agentType, c.req.param("type") as any))
      .returning();
    if (!agent) return c.json({ error: "Not found" }, 404);

    // Bump version
    await db
      .update(agentConfigs)
      .set({ version: agent.version + 1 })
      .where(eq(agentConfigs.id, agent.id));

    return c.json({ data: { ...agent, version: agent.version + 1 } });
  });
