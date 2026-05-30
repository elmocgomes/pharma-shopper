import { Hono } from "hono";
import { eq, and, inArray } from "drizzle-orm";
import { Queue } from "bullmq";
import {
  conversations,
  messages,
  waSessions,
} from "@pharma-shopper/db";
import type { WaWebhookMessage, WaWebhookSession } from "@pharma-shopper/wa-client";
import { env } from "../env.js";
import type { AppEnv } from "../server.js";

const parseQueue = new Queue("parse", {
  connection: { url: env.REDIS_URL },
});

const conversationQueue = new Queue("conversation", {
  connection: { url: env.REDIS_URL },
});

export const webhookRoutes = new Hono<AppEnv>()
  .post("/whatsapp/message", async (c) => {
    const body = (await c.req.json()) as WaWebhookMessage;
    const db = c.get("db");

    console.log(`[webhook] message from ${body.from} on session ${body.session}`);

    // Accept messages with text content OR image media
    const hasText = !!body.message;
    const hasImage = !!body.media?.image;

    if (!body.from || (!hasText && !hasImage)) {
      return c.json({ received: true, matched: false });
    }

    const sender = body.from.replace(/@s\.whatsapp\.net$/, "");

    const [session] = await db
      .select()
      .from(waSessions)
      .where(eq(waSessions.waGatewaySessionId, body.session))
      .limit(1);

    if (!session) {
      console.log(`[webhook] no matching wa_session for gateway session ${body.session}`);
      return c.json({ received: true, matched: false });
    }

    const activeConvs = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.waSessionId, session.id),
          inArray(conversations.status, ["initial", "awaiting_response", "follow_up", "timeout"]),
        ),
      );

    const { pharmacies } = await import("@pharma-shopper/db");
    let matchedConv = null;
    for (const conv of activeConvs) {
      const [pharmacy] = await db
        .select()
        .from(pharmacies)
        .where(eq(pharmacies.id, conv.pharmacyId))
        .limit(1);

      if (pharmacy && pharmacy.whatsappNumber.replace(/\D/g, "") === sender.replace(/\D/g, "")) {
        matchedConv = conv;
        break;
      }
    }

    if (!matchedConv) {
      console.log(`[webhook] no active conversation for sender ${sender}`);
      return c.json({ received: true, matched: false });
    }

    const now = new Date();
    const contentType = hasImage ? "image" : "text";
    const content = body.message || (hasImage ? "[Imagem recebida]" : "");

    await db.insert(messages).values({
      conversationId: matchedConv.id,
      direction: "inbound",
      contentType,
      content,
      mediaPath: body.media?.image || null,
      sentAt: now,
    });

    // If conversation was timed out, reactivate it
    const updateFields: Record<string, unknown> = { lastMessageAt: now };
    if (matchedConv.status === "timeout") {
      updateFields.status = "awaiting_response";
      console.log(`[webhook] reactivating timed-out conversation ${matchedConv.id}`);
    }

    await db
      .update(conversations)
      .set(updateFields)
      .where(eq(conversations.id, matchedConv.id));

    await parseQueue.add("parse-response", {
      conversationId: matchedConv.id,
      messageText: content,
      imageUrl: body.media?.image || null,
      // Also pass any caption text alongside the image
      hasImage,
    });

    console.log(`[webhook] matched conversation ${matchedConv.id} (${contentType}), queued parse job`);
    return c.json({ received: true, matched: true, conversationId: matchedConv.id });
  })

  .post("/whatsapp/session", async (c) => {
    const body = (await c.req.json()) as WaWebhookSession;
    const db = c.get("db");

    console.log(`[webhook] session ${body.session} → ${body.status}`);

    const statusMap: Record<string, "connected" | "disconnected"> = {
      connected: "connected",
      connecting: "disconnected",
      disconnected: "disconnected",
    };
    const newStatus = statusMap[body.status] || "disconnected";

    await db
      .update(waSessions)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(waSessions.waGatewaySessionId, body.session));

    return c.json({ received: true });
  });
