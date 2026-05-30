import { Worker, type Job } from "bullmq";
import { eq, and, inArray, sql } from "drizzle-orm";
import type { Db } from "@pharma-shopper/db";
import {
  campaigns,
  conversations,
  messages,
  conversationHealthChecks,
  conversationEvents,
} from "@pharma-shopper/db";
import type { AgentRegistry } from "@pharma-shopper/ai";
import { QUEUE_NAMES } from "../queues.js";

export interface MonitorJobData {
  campaignId: string;
}

const SAMPLE_SIZE = 20;
const CRITICAL_THRESHOLD = 0.3; // 30% critical → alert

export function createMonitorWorker(
  redisUrl: string,
  db: Db,
  registry: AgentRegistry,
): Worker<MonitorJobData> {
  return new Worker<MonitorJobData>(
    QUEUE_NAMES.MONITOR,
    async (job: Job<MonitorJobData>) => {
      const { campaignId } = job.data;

      // Check campaign is still running
      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(
          and(
            eq(campaigns.id, campaignId),
            eq(campaigns.status, "running"),
          ),
        )
        .limit(1);

      if (!campaign) {
        console.log(`[monitor] Campaign ${campaignId} no longer running, skipping`);
        return;
      }

      // Ensure registry configs are fresh
      if (registry.needsReload) {
        const { agentConfigs } = await import("@pharma-shopper/db");
        const configs = await db.select().from(agentConfigs);
        registry.loadConfigs(configs);
      }

      const monitor = registry.getMonitor();

      // Sample active conversations
      const activeConvs = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.campaignId, campaignId),
            inArray(conversations.status, ["awaiting_response", "follow_up", "initial"]),
          ),
        )
        .limit(SAMPLE_SIZE);

      if (activeConvs.length === 0) {
        console.log(`[monitor] No active conversations for campaign ${campaignId}`);
        return;
      }

      let healthyCount = 0;
      let warningCount = 0;
      let criticalCount = 0;

      for (const conv of activeConvs) {
        // Load recent messages
        const recentMsgs = await db
          .select()
          .from(messages)
          .where(eq(messages.conversationId, conv.id))
          .orderBy(messages.sentAt);

        if (recentMsgs.length === 0) continue;

        const history = recentMsgs.slice(-4).map((m) => ({
          role: (m.direction === "outbound" ? "assistant" : "user") as "user" | "assistant",
          content: m.content || "",
        }));

        const result = await monitor.checkConversation(
          history,
          conv.currentNodeId,
          conv.nodeVisitCount,
        );

        // Store health check
        await db.insert(conversationHealthChecks).values({
          conversationId: conv.id,
          campaignId,
          checkType: "periodic",
          status: result.status,
          issues: result.issues as any,
          actionTaken: result.recommendedAction === "pause" ? "paused" : null,
        });

        // Take action on critical issues
        if (result.status === "critical" && result.recommendedAction === "pause") {
          await db
            .update(conversations)
            .set({ status: "failed", completedAt: new Date() })
            .where(eq(conversations.id, conv.id));

          await emitEvent(db, conv.id, "monitor_paused", {
            issues: result.issues,
            campaignId,
          });

          criticalCount++;
        } else if (result.status === "warning") {
          warningCount++;
        } else {
          healthyCount++;
        }
      }

      const total = healthyCount + warningCount + criticalCount;
      console.log(
        `[monitor] Campaign ${campaignId}: ${healthyCount}/${total} healthy, ` +
          `${warningCount} warnings, ${criticalCount} critical`,
      );

      // If too many critical, log a campaign-level warning
      if (total > 0 && criticalCount / total >= CRITICAL_THRESHOLD) {
        console.warn(
          `[monitor] ⚠️ Campaign ${campaignId}: ${Math.round((criticalCount / total) * 100)}% critical — ` +
            `consider pausing campaign`,
        );
      }
    },
    {
      connection: { url: redisUrl },
      concurrency: 1,
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
    agentId: "monitor",
    sequenceNumber: (maxSeq?.max || 0) + 1,
  });
}
