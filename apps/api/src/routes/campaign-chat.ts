import { Hono } from "hono";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import {
  campaignChatMessages,
  campaignFlows,
  campaignProducts,
  products,
} from "@pharma-shopper/db";
import { ChatAgent } from "@pharma-shopper/ai";
import type { FlowTree } from "@pharma-shopper/ai";
import { requireAuth } from "../middleware/auth.js";
import { env } from "../env.js";
import type { AppEnv } from "../server.js";

const messageSchema = z.object({
  message: z.string().min(1),
  personaStyle: z.enum(["formal", "casual", "anxious"]).default("casual"),
});

export const campaignChatRoutes = new Hono<AppEnv>()
  .use(requireAuth)

  // Get chat history
  .get("/:id/chat", async (c) => {
    const db = c.get("db");
    const data = await db
      .select()
      .from(campaignChatMessages)
      .where(eq(campaignChatMessages.campaignId, c.req.param("id")))
      .orderBy(campaignChatMessages.createdAt);
    return c.json({ data });
  })

  // Send message to AI chat
  .post("/:id/chat", async (c) => {
    const db = c.get("db");
    const parsed = messageSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

    const campaignId = c.req.param("id");
    const { message, personaStyle } = parsed.data;

    // Save user message
    await db.insert(campaignChatMessages).values({
      campaignId,
      role: "user",
      content: message,
    });

    // Load current campaign flow for the given style
    const [flow] = await db
      .select()
      .from(campaignFlows)
      .where(
        and(
          eq(campaignFlows.campaignId, campaignId),
          eq(campaignFlows.personaStyle, personaStyle),
        ),
      )
      .limit(1);

    if (!flow?.calibratedTree) {
      const assistantMsg = "Ainda não há um fluxo calibrado para este estilo. Calibre os templates primeiro.";
      await db.insert(campaignChatMessages).values({
        campaignId,
        role: "assistant",
        content: assistantMsg,
      });
      return c.json({ data: { response: assistantMsg, appliedChanges: null } });
    }

    // Load campaign products
    const prods = await db
      .select({ name: products.name, activeIngredient: products.activeIngredient, presentation: products.presentation })
      .from(campaignProducts)
      .innerJoin(products, eq(campaignProducts.productId, products.id))
      .where(eq(campaignProducts.campaignId, campaignId));

    // Load chat history
    const history = await db
      .select()
      .from(campaignChatMessages)
      .where(eq(campaignChatMessages.campaignId, campaignId))
      .orderBy(campaignChatMessages.createdAt);

    const chatHistory = history
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-10) // Keep last 10 messages for context
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    // Call chat agent
    if (!env.ANTHROPIC_API_KEY) {
      return c.json({ error: "ANTHROPIC_API_KEY not configured" }, 500);
    }
    const chatAgent = new ChatAgent({
      apiKey: env.ANTHROPIC_API_KEY,
      model: "claude-sonnet-4-20250514",
      maxTokens: 2048,
      temperature: 0.3,
    });

    const result = await chatAgent.chat(
      message,
      flow.calibratedTree as unknown as FlowTree,
      prods,
      personaStyle,
      chatHistory,
    );

    // Save assistant response
    await db.insert(campaignChatMessages).values({
      campaignId,
      role: "assistant",
      content: result.response,
      appliedChanges: result.appliedChanges as any,
    });

    // If changes were applied and a new tree was returned, update the campaign flow
    if (result.modifiedTree) {
      await db
        .update(campaignFlows)
        .set({
          calibratedTree: result.modifiedTree as unknown as Record<string, unknown>,
          updatedAt: new Date(),
        })
        .where(eq(campaignFlows.id, flow.id));
    }

    return c.json({
      data: {
        response: result.response,
        appliedChanges: result.appliedChanges,
      },
    });
  });
