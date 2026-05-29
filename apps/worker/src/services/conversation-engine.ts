import { eq, and, inArray } from "drizzle-orm";
import type { Db } from "@pharma-shopper/db";
import {
  conversations,
  messages,
  pharmacies,
  personas,
  products,
  campaignProducts,
  priceRecords,
  waSessions,
} from "@pharma-shopper/db";
import { AiClient, type PersonaProfile, type ConversationContext } from "@pharma-shopper/ai";
import { WaClient } from "@pharma-shopper/wa-client";

const MAX_FOLLOW_UPS = 2;
const RESPONSE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export interface EngineConfig {
  db: Db;
  ai: AiClient;
  wa: WaClient;
}

export async function runConversationStep(
  config: EngineConfig,
  conversationId: string,
): Promise<void> {
  const { db, ai, wa } = config;

  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!conv) return;

  const [pharmacy] = await db
    .select()
    .from(pharmacies)
    .where(eq(pharmacies.id, conv.pharmacyId))
    .limit(1);
  if (!pharmacy) return;

  const [session] = conv.waSessionId
    ? await db.select().from(waSessions).where(eq(waSessions.id, conv.waSessionId)).limit(1)
    : [null];

  const [persona] = conv.personaId
    ? await db.select().from(personas).where(eq(personas.id, conv.personaId)).limit(1)
    : [null];

  const campaignProds = await db
    .select({ name: products.name })
    .from(campaignProducts)
    .innerJoin(products, eq(campaignProducts.productId, products.id))
    .where(eq(campaignProducts.campaignId, conv.campaignId));
  const productNames = campaignProds.map((p) => p.name);

  const prevMsgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.sentAt);

  switch (conv.status) {
    case "pending":
    case "initial": {
      if (!session || !persona) {
        await updateStatus(db, conversationId, "failed");
        return;
      }

      const personaProfile: PersonaProfile = {
        name: persona.name,
        ageRange: persona.ageRange,
        gender: persona.gender,
        occupation: persona.occupation,
        communicationStyle: persona.communicationStyle,
        scenarioTemplates: persona.scenarioTemplates as string[],
      };

      const ctx: ConversationContext = {
        pharmacyName: pharmacy.name,
        pharmacyCity: pharmacy.city,
        pharmacyState: pharmacy.state,
        productNames,
      };

      const generated = await ai.generateMessage(personaProfile, ctx, "greeting");

      await wa.sendText(
        session.waGatewaySessionId,
        pharmacy.whatsappNumber,
        generated.text,
      );

      const now = new Date();
      await db.insert(messages).values({
        conversationId,
        direction: "outbound",
        contentType: "text",
        content: generated.text,
        aiGenerated: "true",
        sentAt: now,
      });

      await db
        .update(conversations)
        .set({
          status: "awaiting_response",
          startedAt: conv.startedAt || now,
          lastMessageAt: now,
        })
        .where(eq(conversations.id, conversationId));

      break;
    }

    case "follow_up": {
      if (!session || !persona) {
        await updateStatus(db, conversationId, "failed");
        return;
      }

      const followUpCount = prevMsgs.filter(
        (m) => m.direction === "outbound" && m.aiGenerated === "true",
      ).length - 1; // subtract greeting

      if (followUpCount >= MAX_FOLLOW_UPS) {
        await updateStatus(db, conversationId, "completed");
        return;
      }

      const personaProfile: PersonaProfile = {
        name: persona.name,
        ageRange: persona.ageRange,
        gender: persona.gender,
        occupation: persona.occupation,
        communicationStyle: persona.communicationStyle,
        scenarioTemplates: persona.scenarioTemplates as string[],
      };

      const ctx: ConversationContext = {
        pharmacyName: pharmacy.name,
        pharmacyCity: pharmacy.city,
        pharmacyState: pharmacy.state,
        productNames,
        previousMessages: prevMsgs.map((m) => ({
          role: m.direction === "outbound" ? "assistant" as const : "user" as const,
          content: m.content || "",
        })),
      };

      const generated = await ai.generateMessage(personaProfile, ctx, "follow_up");

      await wa.sendText(
        session.waGatewaySessionId,
        pharmacy.whatsappNumber,
        generated.text,
      );

      const now = new Date();
      await db.insert(messages).values({
        conversationId,
        direction: "outbound",
        contentType: "text",
        content: generated.text,
        aiGenerated: "true",
        sentAt: now,
      });

      await db
        .update(conversations)
        .set({ status: "awaiting_response", lastMessageAt: now })
        .where(eq(conversations.id, conversationId));

      break;
    }

    case "awaiting_response": {
      if (
        conv.lastMessageAt &&
        Date.now() - conv.lastMessageAt.getTime() > RESPONSE_TIMEOUT_MS
      ) {
        await updateStatus(db, conversationId, "timeout");
      }
      break;
    }

    default:
      break;
  }
}

export async function handleIncomingMessage(
  config: EngineConfig,
  conversationId: string,
  incomingText: string,
): Promise<void> {
  const { db, ai } = config;

  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!conv) return;

  await db
    .update(conversations)
    .set({ status: "parsing" })
    .where(eq(conversations.id, conversationId));

  const campaignProds = await db
    .select({ id: products.id, name: products.name })
    .from(campaignProducts)
    .innerJoin(products, eq(campaignProducts.productId, products.id))
    .where(eq(campaignProducts.campaignId, conv.campaignId));

  const result = await ai.parseResponse(
    incomingText,
    campaignProds.map((p) => p.name),
  );

  await db
    .update(messages)
    .set({ parsedData: result })
    .where(
      and(
        eq(messages.conversationId, conversationId),
        eq(messages.content, incomingText),
      ),
    );

  for (const price of result.prices) {
    const matchedProduct = campaignProds.find(
      (p) => p.name.toLowerCase().includes(price.productName.toLowerCase()) ||
             price.productName.toLowerCase().includes(p.name.toLowerCase()),
    );

    if (matchedProduct) {
      await db.insert(priceRecords).values({
        conversationId,
        productId: matchedProduct.id,
        pharmacyId: conv.pharmacyId,
        price: price.price != null ? String(price.price) : null,
        availability: price.availability,
        brand: price.brand,
        isGeneric: price.isGeneric ?? false,
        notes: price.notes,
      });
    }
  }

  if (result.needsFollowUp) {
    await updateStatus(db, conversationId, "follow_up");
  } else {
    await updateStatus(db, conversationId, "completed");
  }
}

async function updateStatus(
  db: Db,
  conversationId: string,
  status: "completed" | "failed" | "timeout" | "follow_up",
): Promise<void> {
  await db
    .update(conversations)
    .set({
      status,
      ...(["completed", "failed", "timeout"].includes(status)
        ? { completedAt: new Date() }
        : {}),
    })
    .where(eq(conversations.id, conversationId));
}
