import { Worker, type Job } from "bullmq";
import { eq, and } from "drizzle-orm";
import type { Db } from "@pharma-shopper/db";
import {
  campaigns,
  campaignProducts,
  products,
  conversationFlows,
  campaignFlows,
} from "@pharma-shopper/db";
import type { AgentRegistry, FlowTree } from "@pharma-shopper/ai";
import { QUEUE_NAMES } from "../queues.js";

export interface CalibrateJobData {
  campaignId: string;
  personaStyle: "formal" | "casual" | "anxious";
  baseFlowId: string;
}

export function createCalibrateWorker(
  redisUrl: string,
  db: Db,
  registry: AgentRegistry,
): Worker<CalibrateJobData> {
  return new Worker<CalibrateJobData>(
    QUEUE_NAMES.CALIBRATE,
    async (job: Job<CalibrateJobData>) => {
      const { campaignId, personaStyle, baseFlowId } = job.data;
      console.log(`[calibrate] Calibrating flow for campaign ${campaignId}, style ${personaStyle}`);

      // Ensure registry configs are fresh
      if (registry.needsReload) {
        const { agentConfigs } = await import("@pharma-shopper/db");
        const configs = await db.select().from(agentConfigs);
        registry.loadConfigs(configs);
      }

      const calibrator = registry.getCalibrator();

      // Load base flow
      const [baseFlow] = await db
        .select()
        .from(conversationFlows)
        .where(eq(conversationFlows.id, baseFlowId))
        .limit(1);
      if (!baseFlow) {
        console.error(`[calibrate] Base flow ${baseFlowId} not found`);
        return;
      }

      // Load campaign products
      const campaignProds = await db
        .select({
          name: products.name,
          activeIngredient: products.activeIngredient,
          presentation: products.presentation,
        })
        .from(campaignProducts)
        .innerJoin(products, eq(campaignProducts.productId, products.id))
        .where(eq(campaignProducts.campaignId, campaignId));

      if (campaignProds.length === 0) {
        console.warn(`[calibrate] No products for campaign ${campaignId}`);
        return;
      }

      // Update campaign_flow status to calibrating
      await db
        .update(campaignFlows)
        .set({ calibrationStatus: "calibrating", updatedAt: new Date() })
        .where(
          and(
            eq(campaignFlows.campaignId, campaignId),
            eq(campaignFlows.personaStyle, personaStyle),
          ),
        );

      try {
        const { calibratedTree, diff } = await calibrator.calibrateFlow(
          baseFlow.tree as unknown as FlowTree,
          campaignProds,
          personaStyle,
        );

        await db
          .update(campaignFlows)
          .set({
            calibratedTree: calibratedTree as unknown as Record<string, unknown>,
            calibrationDiff: diff as unknown as Record<string, unknown>,
            calibrationStatus: "ready",
            calibratedBy: "calibrator",
            calibratedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(campaignFlows.campaignId, campaignId),
              eq(campaignFlows.personaStyle, personaStyle),
            ),
          );

        // Check if all campaign flows are ready
        await updateCampaignCalibrationStatus(db, campaignId);

        const changeCount = Object.values(diff).reduce((sum, arr) => sum + arr.length, 0);
        console.log(
          `[calibrate] Done: campaign ${campaignId} / ${personaStyle} — ${changeCount} template(s) calibrated`,
        );
      } catch (err: any) {
        console.error(`[calibrate] Failed for campaign ${campaignId} / ${personaStyle}:`, err.message);
        await db
          .update(campaignFlows)
          .set({ calibrationStatus: "pending", updatedAt: new Date() })
          .where(
            and(
              eq(campaignFlows.campaignId, campaignId),
              eq(campaignFlows.personaStyle, personaStyle),
            ),
          );
      }
    },
    {
      connection: { url: redisUrl },
      concurrency: 3,
    },
  );
}

async function updateCampaignCalibrationStatus(db: Db, campaignId: string): Promise<void> {
  const flows = await db
    .select()
    .from(campaignFlows)
    .where(eq(campaignFlows.campaignId, campaignId));

  const allReady = flows.length > 0 && flows.every((f) => f.calibrationStatus === "ready");
  const allApproved = flows.length > 0 && flows.every((f) => f.approvedAt != null);

  const status = allApproved ? "approved" : allReady ? "ready" : "pending";

  await db
    .update(campaigns)
    .set({ calibrationStatus: status, updatedAt: new Date() })
    .where(eq(campaigns.id, campaignId));
}
