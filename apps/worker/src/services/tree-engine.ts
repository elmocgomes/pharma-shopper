import { eq, sql } from "drizzle-orm";
import type { Db } from "@pharma-shopper/db";
import {
  conversations,
  messages,
  pharmacies,
  personas,
  waSessions,
  campaignProducts,
  products,
  conversationFlows,
  conversationEvents,
} from "@pharma-shopper/db";
import type { ClassifierAgent } from "@pharma-shopper/ai";
import type {
  FlowTree,
  FlowNode,
  SendNode,
  ClassifyNode,
  TemplateVariables,
} from "@pharma-shopper/ai";
import type { WaClient } from "@pharma-shopper/wa-client";

const MAX_NODE_VISITS = 20; // Circuit breaker

export interface TreeEngineConfig {
  db: Db;
  classifier: ClassifierAgent;
  wa: WaClient;
}

/**
 * Executes the current node in a conversation's decision tree.
 * Returns the next action to take (or null if waiting/done).
 */
export async function executeCurrentNode(
  config: TreeEngineConfig,
  conversationId: string,
): Promise<void> {
  const { db, classifier, wa } = config;

  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!conv || !conv.flowId || !conv.currentNodeId) return;

  // Circuit breaker
  if (conv.nodeVisitCount >= MAX_NODE_VISITS) {
    console.warn(`[tree-engine] ${conversationId}: Hit circuit breaker (${MAX_NODE_VISITS} visits)`);
    await db
      .update(conversations)
      .set({ status: "failed", completedAt: new Date() })
      .where(eq(conversations.id, conversationId));
    await emitEvent(db, conversationId, "circuit_breaker", { nodeVisitCount: conv.nodeVisitCount });
    return;
  }

  // Load the flow tree — prefer campaign_flows.calibrated_tree, fall back to base flow
  const tree = await loadTree(db, conv.flowId, conversationId);
  if (!tree) return;

  const node = tree.nodes[conv.currentNodeId];
  if (!node) {
    console.error(`[tree-engine] ${conversationId}: Node "${conv.currentNodeId}" not found in tree`);
    await db
      .update(conversations)
      .set({ status: "failed", completedAt: new Date() })
      .where(eq(conversations.id, conversationId));
    return;
  }

  switch (node.type) {
    case "send":
      await handleSendNode(config, conv, node, tree);
      break;
    case "classify":
      // classify nodes are handled by the parse worker when a response arrives
      // Here we just ensure timeout is set
      break;
    case "complete":
      await handleCompleteNode(config, conv, node);
      break;
    case "fail":
      await handleFailNode(db, conv, node);
      break;
  }
}

/**
 * Handle an incoming pharmacy response for a tree-based conversation.
 * Called by parse worker instead of handleIncomingMessage().
 */
export async function classifyAndAdvance(
  config: TreeEngineConfig,
  conversationId: string,
  pharmacyResponse: string,
): Promise<void> {
  const { db, classifier } = config;

  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!conv || !conv.flowId || !conv.currentNodeId) return;

  const tree = await loadTree(db, conv.flowId, conversationId);
  if (!tree) return;

  const node = tree.nodes[conv.currentNodeId];
  if (!node || node.type !== "classify") {
    console.warn(`[tree-engine] ${conversationId}: Expected classify node, got ${node?.type}`);
    return;
  }

  // Get recent conversation history for context
  const prevMsgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.sentAt);

  const history = prevMsgs.slice(-4).map((m) => ({
    role: (m.direction === "outbound" ? "assistant" : "user") as "user" | "assistant",
    content: m.content || "",
  }));

  // Classify the response
  const result = await classifier.classify(pharmacyResponse, node.branches, history);

  await emitEvent(db, conversationId, "classified", {
    category: result.category,
    confidence: result.confidence,
    nodeId: conv.currentNodeId,
  });

  // Find the matching branch
  const branch = node.branches.find((b) => b.category === result.category);
  const nextNodeId = branch?.target || node.timeoutTarget;

  // Advance to next node
  await db
    .update(conversations)
    .set({
      currentNodeId: nextNodeId,
      nodeVisitCount: sql`${conversations.nodeVisitCount} + 1`,
      status: "initial", // Will be picked up by conversation worker
    })
    .where(eq(conversations.id, conversationId));
}

// --- Node handlers ---

async function handleSendNode(
  config: TreeEngineConfig,
  conv: any,
  node: SendNode,
  tree: FlowTree,
): Promise<void> {
  const { db, wa } = config;
  const conversationId = conv.id;

  const [pharmacy] = await db
    .select()
    .from(pharmacies)
    .where(eq(pharmacies.id, conv.pharmacyId))
    .limit(1);
  if (!pharmacy) return;

  const [session] = conv.waSessionId
    ? await db.select().from(waSessions).where(eq(waSessions.id, conv.waSessionId)).limit(1)
    : [null];
  if (!session || session.status !== "connected") return;

  const [persona] = conv.personaId
    ? await db.select().from(personas).where(eq(personas.id, conv.personaId)).limit(1)
    : [null];

  // Build template variables
  const campaignProds = await db
    .select({ name: products.name, activeIngredient: products.activeIngredient, presentation: products.presentation })
    .from(campaignProducts)
    .innerJoin(products, eq(campaignProducts.productId, products.id))
    .where(eq(campaignProducts.campaignId, conv.campaignId));

  const vars: TemplateVariables = {
    product_name: campaignProds.map((p) => p.name).join(", "),
    active_ingredient: campaignProds[0]?.activeIngredient || "",
    presentation: campaignProds[0]?.presentation || "",
    pharmacy_name: pharmacy.name,
    persona_name: persona?.name || "",
    cpf: persona?.cpf || "não tenho em mãos no momento",
  };

  // Pick a random template and interpolate variables
  const template = node.templates[Math.floor(Math.random() * node.templates.length)];
  const text = interpolateTemplate(template, vars);

  // Send via WhatsApp
  try {
    await wa.sendText(session.waGatewaySessionId, pharmacy.whatsappNumber, text);
  } catch (err: any) {
    console.error(`[tree-engine] Send failed for ${conversationId}: ${err.message}`);
    return;
  }

  const now = new Date();
  await db.insert(messages).values({
    conversationId,
    direction: "outbound",
    contentType: "text",
    content: text,
    aiGenerated: "false", // Template-based, not AI-generated
    sentAt: now,
  });

  // Update daily count
  await db
    .update(waSessions)
    .set({
      dailyMessageCount: sql`${waSessions.dailyMessageCount} + 1`,
      lastActiveAt: now,
      updatedAt: now,
    })
    .where(eq(waSessions.id, session.id));

  // Advance to next node (which should be a classify node — waiting for response)
  await db
    .update(conversations)
    .set({
      currentNodeId: node.next,
      nodeVisitCount: sql`${conversations.nodeVisitCount} + 1`,
      status: "awaiting_response",
      startedAt: conv.startedAt || now,
      lastMessageAt: now,
    })
    .where(eq(conversations.id, conversationId));

  await emitEvent(db, conversationId, "message_sent", {
    nodeId: conv.currentNodeId,
    template,
    text,
  });
}

async function handleCompleteNode(
  config: TreeEngineConfig,
  conv: any,
  node: { type: "complete"; thankYouTemplates?: string[] },
): Promise<void> {
  const { db, wa } = config;
  const conversationId = conv.id;

  // Optionally send thank-you message
  if (node.thankYouTemplates?.length) {
    const [pharmacy] = await db.select().from(pharmacies).where(eq(pharmacies.id, conv.pharmacyId)).limit(1);
    const [session] = conv.waSessionId
      ? await db.select().from(waSessions).where(eq(waSessions.id, conv.waSessionId)).limit(1)
      : [null];

    if (pharmacy && session?.status === "connected") {
      const thankYou = node.thankYouTemplates[Math.floor(Math.random() * node.thankYouTemplates.length)];
      try {
        await wa.sendText(session.waGatewaySessionId, pharmacy.whatsappNumber, thankYou);
        await db.insert(messages).values({
          conversationId,
          direction: "outbound",
          contentType: "text",
          content: thankYou,
          aiGenerated: "false",
          sentAt: new Date(),
        });
      } catch {
        // Non-fatal — we still complete the conversation
      }
    }
  }

  await db
    .update(conversations)
    .set({ status: "completed", completedAt: new Date() })
    .where(eq(conversations.id, conversationId));

  await emitEvent(db, conversationId, "completed", { nodeId: conv.currentNodeId });
}

async function handleFailNode(db: Db, conv: any, node: { type: "fail"; reason: string }): Promise<void> {
  await db
    .update(conversations)
    .set({ status: "failed", completedAt: new Date() })
    .where(eq(conversations.id, conv.id));

  await emitEvent(db, conv.id, "failed", { nodeId: conv.currentNodeId, reason: node.reason });
}

// --- Helpers ---

function interpolateTemplate(template: string, vars: TemplateVariables): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    return vars[key] ?? `{${key}}`;
  });
}

async function loadTree(db: Db, flowId: string, conversationId: string): Promise<FlowTree | null> {
  // Try to load from campaign_flows first (calibrated), then fall back to base flow
  // For now, load the base flow — campaign_flows integration happens in step 9
  const [flow] = await db
    .select()
    .from(conversationFlows)
    .where(eq(conversationFlows.id, flowId))
    .limit(1);

  if (!flow) {
    console.error(`[tree-engine] Flow ${flowId} not found for conversation ${conversationId}`);
    return null;
  }

  return flow.tree as unknown as FlowTree;
}

async function emitEvent(
  db: Db,
  conversationId: string,
  eventType: string,
  eventData: Record<string, unknown>,
): Promise<void> {
  const [maxSeq] = await db
    .select({ max: sql<number>`coalesce(max(${conversationEvents.sequenceNumber}), 0)` })
    .from(conversationEvents)
    .where(eq(conversationEvents.conversationId, conversationId));

  await db.insert(conversationEvents).values({
    conversationId,
    eventType,
    eventData,
    agentId: "tree-engine",
    sequenceNumber: (maxSeq?.max || 0) + 1,
  });
}
