import { Worker, type Job } from "bullmq";
import { eq, sql } from "drizzle-orm";
import type { Db } from "@pharma-shopper/db";
import {
  conversations,
  messages,
  pharmacies,
  products,
  campaignProducts,
  conversationAnalyses,
  alternativeProducts,
  priceRecords,
  conversationEvents,
} from "@pharma-shopper/db";
import type { AgentRegistry } from "@pharma-shopper/ai";
import { QUEUE_NAMES } from "../queues.js";

export interface AnalystJobData {
  conversationId: string;
  triggeredBy: "auto" | "manual" | "reprocess";
}

export function createAnalystWorker(
  redisUrl: string,
  db: Db,
  registry: AgentRegistry,
): Worker<AnalystJobData> {
  return new Worker<AnalystJobData>(
    QUEUE_NAMES.ANALYST,
    async (job: Job<AnalystJobData>) => {
      const { conversationId, triggeredBy } = job.data;
      console.log(`[analyst] Analyzing conversation ${conversationId} (${triggeredBy})`);

      // Ensure registry configs are fresh
      if (registry.needsReload) {
        const { agentConfigs } = await import("@pharma-shopper/db");
        const configs = await db.select().from(agentConfigs);
        registry.loadConfigs(configs);
      }

      const analyst = registry.getAnalyst();

      // Load conversation
      const [conv] = await db
        .select()
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .limit(1);
      if (!conv) return;

      // Load pharmacy info
      const [pharmacy] = await db
        .select()
        .from(pharmacies)
        .where(eq(pharmacies.id, conv.pharmacyId))
        .limit(1);
      if (!pharmacy) return;

      // Load all messages
      const allMsgs = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(messages.sentAt);

      if (allMsgs.length === 0) {
        console.warn(`[analyst] No messages for conversation ${conversationId}`);
        return;
      }

      const history = allMsgs.map((m) => ({
        role: (m.direction === "outbound" ? "assistant" : "user") as "user" | "assistant",
        content: m.content || "",
      }));

      // Load campaign products
      const campaignProds = await db
        .select({
          id: products.id,
          name: products.name,
          activeIngredient: products.activeIngredient,
          presentation: products.presentation,
        })
        .from(campaignProducts)
        .innerJoin(products, eq(campaignProducts.productId, products.id))
        .where(eq(campaignProducts.campaignId, conv.campaignId));

      // Create analysis record
      const [analysis] = await db
        .insert(conversationAnalyses)
        .values({
          conversationId,
          agentType: "analyst",
          status: "processing",
          triggeredBy,
        })
        .returning();

      try {
        const result = await analyst.deepAnalyze(
          history,
          campaignProds.map((p) => ({
            name: p.name,
            activeIngredient: p.activeIngredient,
            presentation: p.presentation,
          })),
          {
            name: pharmacy.name,
            city: pharmacy.city,
            state: pharmacy.state,
          },
        );

        // Store analysis data
        await db
          .update(conversationAnalyses)
          .set({
            analysisData: result as unknown as Record<string, unknown>,
            status: "completed",
            processedAt: new Date(),
          })
          .where(eq(conversationAnalyses.id, analysis.id));

        // Populate alternative_products
        for (const product of result.products) {
          const matchedProduct = campaignProds.find(
            (p) =>
              p.name.toLowerCase().includes(product.productName.toLowerCase()) ||
              product.productName.toLowerCase().includes(p.name.toLowerCase()),
          );

          await db.insert(alternativeProducts).values({
            conversationId,
            pharmacyId: conv.pharmacyId,
            analysisId: analysis.id,
            productName: product.productName,
            brand: product.brand,
            price: product.price != null ? String(product.price) : null,
            availability: product.availability,
            isGeneric: product.isGeneric,
            mentionOrder: product.mentionOrder,
            mentionContext: product.mentionContext as any,
            mentionPhase: product.mentionPhase,
            rawQuote: product.rawQuote,
            matchedProductId: matchedProduct?.id,
            dosage: product.dosage,
            quantity: product.quantity,
            presentation: product.presentation,
            activeIngredient: product.activeIngredient,
            notes: product.notes,
          });

          // Also populate price_records for matched products
          if (matchedProduct && product.price != null) {
            await db.insert(priceRecords).values({
              conversationId,
              analysisId: analysis.id,
              productId: matchedProduct.id,
              pharmacyId: conv.pharmacyId,
              price: String(product.price),
              availability: product.availability,
              brand: product.brand,
              isGeneric: product.isGeneric,
              substitutionType: product.mentionContext as any,
              dosage: product.dosage,
              quantity: product.quantity,
              presentation: product.presentation,
              conversationPhase: product.mentionPhase,
              notes: product.notes,
            });
          }
        }

        // Update conversation analysis status
        await db
          .update(conversations)
          .set({ analysisStatus: "completed" })
          .where(eq(conversations.id, conversationId));

        // Emit event
        await emitEvent(db, conversationId, "analysis_completed", {
          analysisId: analysis.id,
          productCount: result.products.length,
          completeness: result.dataCompleteness.score,
          substitutionBehavior: result.substitutionBehavior,
        });

        console.log(
          `[analyst] Completed analysis for ${conversationId}: ` +
            `${result.products.length} products, ` +
            `completeness ${result.dataCompleteness.score}%`,
        );
      } catch (err: any) {
        console.error(`[analyst] Failed for ${conversationId}:`, err.message);
        await db
          .update(conversationAnalyses)
          .set({ status: "failed", errorMessage: err.message })
          .where(eq(conversationAnalyses.id, analysis.id));

        await db
          .update(conversations)
          .set({ analysisStatus: "failed" })
          .where(eq(conversations.id, conversationId));
      }
    },
    {
      connection: { url: redisUrl },
      concurrency: 5,
    },
  );
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
    agentId: "analyst",
    sequenceNumber: (maxSeq?.max || 0) + 1,
  });
}
