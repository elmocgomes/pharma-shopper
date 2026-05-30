import { Hono } from "hono";
import { eq, and, sql } from "drizzle-orm";
import {
  conversations,
  messages,
  pharmacies,
  personas,
  priceRecords,
  products,
} from "@pharma-shopper/db";
import { requireAuth } from "../middleware/auth.js";
import type { AppEnv } from "../server.js";

export const conversationRoutes = new Hono<AppEnv>()
  .use(requireAuth)

  .get("/:id", async (c) => {
    const db = c.get("db");
    const [conv] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, c.req.param("id")))
      .limit(1);
    if (!conv) return c.json({ error: "Not found" }, 404);

    const [pharmacy] = await db
      .select()
      .from(pharmacies)
      .where(eq(pharmacies.id, conv.pharmacyId))
      .limit(1);

    const persona = conv.personaId
      ? (await db.select().from(personas).where(eq(personas.id, conv.personaId)).limit(1))[0]
      : null;

    return c.json({ data: { ...conv, pharmacy, persona } });
  })

  .get("/:id/messages", async (c) => {
    const db = c.get("db");
    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, c.req.param("id")))
      .orderBy(messages.sentAt);

    return c.json({ data: msgs });
  })

  .get("/:id/prices", async (c) => {
    const db = c.get("db");
    const prices = await db
      .select({
        record: priceRecords,
        product: products,
      })
      .from(priceRecords)
      .innerJoin(products, eq(priceRecords.productId, products.id))
      .where(eq(priceRecords.conversationId, c.req.param("id")));

    const result = prices.map((r) => ({
      ...r.record,
      product: r.product,
    }));

    return c.json({ data: result });
  })

  // Reset a conversation: delete inbound messages + price records, reset status to awaiting_response
  .post("/:id/reset", async (c) => {
    const db = c.get("db");
    const id = c.req.param("id");

    const [conv] = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
    if (!conv) return c.json({ error: "Not found" }, 404);

    // Delete price records for this conversation
    await db.delete(priceRecords).where(eq(priceRecords.conversationId, id));

    // Delete inbound messages (keep outbound — those are the real sent messages)
    await db
      .delete(messages)
      .where(and(eq(messages.conversationId, id), eq(messages.direction, "inbound")));

    // Reset conversation status back to awaiting_response
    await db
      .update(conversations)
      .set({
        status: "awaiting_response",
        completedAt: null,
        spontaneousSubstitution: false,
        analysisStatus: "pending",
      })
      .where(eq(conversations.id, id));

    return c.json({ ok: true, message: "Conversation reset — fake inbound data removed" });
  });
