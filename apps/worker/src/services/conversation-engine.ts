import { eq, and, sql } from "drizzle-orm";
import type { Db } from "@pharma-shopper/db";
import {
  conversations,
  campaigns,
  messages,
  pharmacies,
  personas,
  products,
  campaignProducts,
  priceRecords,
  waSessions,
} from "@pharma-shopper/db";
import {
  AiClient,
  type PersonaProfile,
  type ConversationContext,
  type ConversationPhase,
  type MessageType,
  type ProductInfo,
} from "@pharma-shopper/ai";
import { WaClient } from "@pharma-shopper/wa-client";

const DEFAULT_MAX_FOLLOW_UPS_PER_PHASE = 3;
const RESPONSE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export interface EngineConfig {
  db: Db;
  ai: AiClient;
  wa: WaClient;
}

/**
 * Two-phase mystery shopping conversation engine.
 *
 * Phase 1 (phase1_branded):
 *   Ask about the specific branded product. Observe whether the pharmacy
 *   spontaneously offers generic/alternative products.
 *
 * Phase 2 (phase2_alternatives):
 *   If the pharmacy did NOT spontaneously offer alternatives, probe by asking
 *   "tem genérico?" or "tem opção mais em conta?". Capture prompted substitution.
 *
 * If the pharmacy spontaneously offered alternatives in phase 1, skip phase 2
 * and mark the conversation as completed.
 */
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

  // Get campaign products with pharmaceutical details
  const campaignProds = await db
    .select({
      name: products.name,
      activeIngredient: products.activeIngredient,
      presentation: products.presentation,
    })
    .from(campaignProducts)
    .innerJoin(products, eq(campaignProducts.productId, products.id))
    .where(eq(campaignProducts.campaignId, conv.campaignId));

  const productInfos: ProductInfo[] = campaignProds.map((p) => ({
    name: p.name,
    activeIngredient: p.activeIngredient,
    presentation: p.presentation,
  }));

  const prevMsgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.sentAt);

  const phase = (conv.phase as ConversationPhase) || "phase1_branded";

  switch (conv.status) {
    case "pending":
    case "initial": {
      if (!session || !persona) {
        await updateStatus(db, conversationId, "failed");
        return;
      }

      if (session.status !== "connected") {
        console.warn(
          `[conversation] Session ${session.phoneNumber} is ${session.status}, skipping send for ${conversationId}`,
        );
        return;
      }

      const personaProfile = buildPersonaProfile(persona);
      const ctx = buildContext(pharmacy, productInfos, phase, prevMsgs.length > 0 ? prevMsgs : undefined);

      // Phase 1 starts with a greeting; Phase 2 starts with a probe about alternatives
      const messageType: MessageType =
        phase === "phase2_alternatives" ? "phase2_probe" : "greeting";
      const generated = await ai.generateMessage(personaProfile, ctx, messageType);

      const sendOk = await safeSend(config, session, pharmacy, generated.text, conversationId);
      if (!sendOk) {
        await handleSendFailure(db, conv, session.id);
        return;
      }

      const now = new Date();
      await db.insert(messages).values({
        conversationId,
        direction: "outbound",
        contentType: "text",
        content: generated.text,
        aiGenerated: "true",
        sentAt: now,
      });

      await incrementDailyCount(db, session.id, now);

      await db
        .update(conversations)
        .set({
          status: "awaiting_response",
          phase: "phase1_branded",
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

      if (session.status !== "connected") {
        console.warn(
          `[conversation] Session ${session.phoneNumber} is ${session.status}, deferring follow-up for ${conversationId}`,
        );
        return;
      }

      // Get campaign-level follow-up limit
      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, conv.campaignId))
        .limit(1);
      const maxFollowUps = (campaign as any)?.maxFollowUpsPerPhase ?? DEFAULT_MAX_FOLLOW_UPS_PER_PHASE;

      if (conv.followUpCount >= maxFollowUps) {
        // Exceeded follow-ups for this phase
        if (phase === "phase1_branded") {
          await transitionToPhase2(db, conversationId, false);
        } else {
          await updateStatus(db, conversationId, "completed");
        }
        return;
      }

      const personaProfile = buildPersonaProfile(persona);
      const ctx = buildContext(pharmacy, productInfos, phase, prevMsgs);

      // Determine message type — if CPF was requested, send CPF first
      const messageType: MessageType =
        (conv as any).pendingCpfResponse ? "cpf_response" : "follow_up";
      const generated = await ai.generateMessage(personaProfile, ctx, messageType);

      const sendOk = await safeSend(config, session, pharmacy, generated.text, conversationId);
      if (!sendOk) return; // Stay in follow_up, will retry

      const now = new Date();
      await db.insert(messages).values({
        conversationId,
        direction: "outbound",
        contentType: "text",
        content: generated.text,
        aiGenerated: "true",
        sentAt: now,
      });

      await incrementDailyCount(db, session.id, now);

      await db
        .update(conversations)
        .set({
          status: "awaiting_response",
          lastMessageAt: now,
          followUpCount: sql`${conversations.followUpCount} + 1`,
        })
        .where(eq(conversations.id, conversationId));

      break;
    }

    case "awaiting_response": {
      if (
        conv.lastMessageAt &&
        Date.now() - conv.lastMessageAt.getTime() > RESPONSE_TIMEOUT_MS
      ) {
        if (phase === "phase1_branded") {
          // Timeout in phase 1 — try phase 2 anyway
          await transitionToPhase2(db, conversationId, false);
        } else {
          await updateStatus(db, conversationId, "timeout");
        }
      }
      break;
    }

    default:
      break;
  }
}

/**
 * Handle incoming pharmacy response — parse and decide next phase.
 */
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

  const phase = (conv.phase as ConversationPhase) || "phase1_branded";

  const campaignProds = await db
    .select({ id: products.id, name: products.name })
    .from(campaignProducts)
    .innerJoin(products, eq(campaignProducts.productId, products.id))
    .where(eq(campaignProducts.campaignId, conv.campaignId));

  // Get conversation history for context-aware parsing
  const prevMsgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.sentAt);

  const conversationHistory = prevMsgs.map((m) => ({
    role: (m.direction === "outbound" ? "assistant" : "user") as "user" | "assistant",
    content: m.content || "",
  }));

  const result = await ai.parseResponse(
    incomingText,
    campaignProds.map((p) => p.name),
    phase,
    conversationHistory,
  );

  // Store parsed data on the incoming message
  await db
    .update(messages)
    .set({ parsedData: result })
    .where(
      and(
        eq(messages.conversationId, conversationId),
        eq(messages.content, incomingText),
      ),
    );

  // Record price data with substitution behavior
  for (const product of result.products) {
    const matchedProduct = campaignProds.find(
      (p) =>
        p.name.toLowerCase().includes(product.productName.toLowerCase()) ||
        product.productName.toLowerCase().includes(p.name.toLowerCase()),
    );

    if (matchedProduct) {
      await db.insert(priceRecords).values({
        conversationId,
        productId: matchedProduct.id,
        pharmacyId: conv.pharmacyId,
        price: product.price != null ? String(product.price) : null,
        availability: product.availability,
        brand: product.brand,
        isGeneric: product.isGeneric ?? false,
        substitutionType: product.substitutionType || null,
        dosage: product.dosage,
        quantity: product.quantity,
        presentation: product.presentation,
        conversationPhase: phase,
        notes: product.notes,
      });
    } else if (
      product.substitutionType === "spontaneous" ||
      product.substitutionType === "prompted"
    ) {
      // Alternative product that doesn't match a campaign product — still record it
      // Use the first campaign product as reference
      const refProduct = campaignProds[0];
      if (refProduct) {
        await db.insert(priceRecords).values({
          conversationId,
          productId: refProduct.id,
          pharmacyId: conv.pharmacyId,
          price: product.price != null ? String(product.price) : null,
          availability: product.availability,
          brand: product.brand,
          isGeneric: product.isGeneric ?? true,
          substitutionType: product.substitutionType,
          dosage: product.dosage,
          quantity: product.quantity,
          presentation: product.presentation,
          conversationPhase: phase,
          notes: `[Alt: ${product.productName}] ${product.notes || ""}`.trim(),
        });
      }
    }
  }

  // Handle CPF request — pharmacy asked for CPF, we need to respond with it
  if (result.cpfRequested) {
    console.log(
      `[conversation] ${conversationId}: Pharmacy requested CPF, queuing CPF response`,
    );
    // Don't count CPF exchange as a follow-up — it's a side interaction
    await updateStatus(db, conversationId, "follow_up");
    return;
  }

  // Decide next step based on phase and results
  if (phase === "phase1_branded") {
    // Record whether spontaneous substitution occurred
    await db
      .update(conversations)
      .set({ spontaneousSubstitution: result.spontaneousSubstitution })
      .where(eq(conversations.id, conversationId));

    if (result.needsFollowUp) {
      // Pharmacy response was incomplete — follow up in same phase
      await updateStatus(db, conversationId, "follow_up");
    } else if (result.spontaneousSubstitution) {
      // Pharmacy already offered alternatives — we have the data, done!
      console.log(
        `[conversation] ${conversationId}: Spontaneous substitution detected, completing`,
      );
      await updateStatus(db, conversationId, "completed");
    } else {
      // Phase 1 complete, pharmacy didn't offer alternatives → move to phase 2
      await transitionToPhase2(db, conversationId, false);
    }
  } else {
    // Phase 2 — alternatives
    if (result.needsFollowUp) {
      await updateStatus(db, conversationId, "follow_up");
    } else {
      await updateStatus(db, conversationId, "completed");
    }
  }
}

// --- Helpers ---

function buildPersonaProfile(persona: any): PersonaProfile {
  return {
    name: persona.name,
    ageRange: persona.ageRange,
    gender: persona.gender,
    occupation: persona.occupation,
    communicationStyle: persona.communicationStyle,
    scenarioTemplates: persona.scenarioTemplates as string[],
    cpf: persona.cpf || null,
  };
}

function buildContext(
  pharmacy: any,
  productInfos: ProductInfo[],
  phase: ConversationPhase,
  prevMsgs?: any[],
): ConversationContext {
  return {
    pharmacyName: pharmacy.name,
    pharmacyCity: pharmacy.city,
    pharmacyState: pharmacy.state,
    products: productInfos,
    productNames: productInfos.map((p) => p.name),
    phase,
    previousMessages: prevMsgs?.map((m) => ({
      role: (m.direction === "outbound" ? "assistant" : "user") as "user" | "assistant",
      content: m.content || "",
    })),
  };
}

async function transitionToPhase2(
  db: Db,
  conversationId: string,
  spontaneous: boolean,
): Promise<void> {
  console.log(
    `[conversation] ${conversationId}: Transitioning to phase 2 (alternatives probe)`,
  );
  // Set phase to phase2 and status to initial so the engine sends the probe message
  // Reset followUpCount for the new phase
  await db
    .update(conversations)
    .set({
      phase: "phase2_alternatives",
      status: "initial",
      spontaneousSubstitution: spontaneous,
      followUpCount: 0,
    })
    .where(eq(conversations.id, conversationId));
}

async function safeSend(
  config: EngineConfig,
  session: any,
  pharmacy: any,
  text: string,
  conversationId: string,
): Promise<boolean> {
  try {
    await config.wa.sendText(
      session.waGatewaySessionId,
      pharmacy.whatsappNumber,
      text,
    );
    return true;
  } catch (sendErr: any) {
    console.error(
      `[conversation] Send failed for ${conversationId}: ${sendErr.message}`,
    );
    await config.db
      .update(waSessions)
      .set({ status: "disconnected", updatedAt: new Date() })
      .where(eq(waSessions.id, session.id));
    return false;
  }
}

async function handleSendFailure(
  db: Db,
  conv: any,
  sessionId: string,
): Promise<void> {
  const newRetry = conv.retryCount + 1;
  if (newRetry >= 3) {
    await updateStatus(db, conv.id, "failed");
  } else {
    await db
      .update(conversations)
      .set({ retryCount: newRetry })
      .where(eq(conversations.id, conv.id));
  }
}

async function incrementDailyCount(
  db: Db,
  sessionId: string,
  now: Date,
): Promise<void> {
  await db
    .update(waSessions)
    .set({
      dailyMessageCount: sql`${waSessions.dailyMessageCount} + 1`,
      lastActiveAt: now,
      updatedAt: now,
    })
    .where(eq(waSessions.id, sessionId));
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
