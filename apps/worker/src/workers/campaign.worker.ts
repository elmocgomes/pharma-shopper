import { Worker, Queue, type Job } from "bullmq";
import { eq, and, sql, inArray } from "drizzle-orm";
import type { Db } from "@pharma-shopper/db";
import {
  campaigns,
  campaignPharmacies,
  pharmacies,
  conversations,
  waSessions,
} from "@pharma-shopper/db";
import { selectPersonaForSession } from "../services/persona-rotation.js";
import { QUEUE_NAMES } from "../queues.js";

export interface CampaignJobData {
  campaignId: string;
}

export function createCampaignWorker(
  redisUrl: string,
  db: Db,
): Worker<CampaignJobData> {
  const conversationQueue = new Queue(QUEUE_NAMES.CONVERSATION, {
    connection: { url: redisUrl },
  });

  return new Worker<CampaignJobData>(
    QUEUE_NAMES.CAMPAIGN,
    async (job: Job<CampaignJobData>) => {
      const { campaignId } = job.data;
      console.log(`[campaign] Processing campaign ${campaignId}`);

      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, campaignId))
        .limit(1);

      if (!campaign || campaign.status !== "running") {
        console.log(`[campaign] Campaign ${campaignId} not running, skipping`);
        return;
      }

      const targetPharmacies = await db
        .select({ pharmacy: pharmacies })
        .from(campaignPharmacies)
        .innerJoin(pharmacies, eq(campaignPharmacies.pharmacyId, pharmacies.id))
        .where(eq(campaignPharmacies.campaignId, campaignId));

      const existingConvs = await db
        .select({ pharmacyId: conversations.pharmacyId })
        .from(conversations)
        .where(eq(conversations.campaignId, campaignId));
      const existingSet = new Set(existingConvs.map((c) => c.pharmacyId));

      const availableSessions = await db
        .select()
        .from(waSessions)
        .where(eq(waSessions.status, "connected"));

      if (availableSessions.length === 0) {
        console.log(`[campaign] No connected sessions available`);
        return;
      }

      const sessionsByState = new Map<string, typeof availableSessions>();
      for (const s of availableSessions) {
        const key = s.stateCode || "__any__";
        if (!sessionsByState.has(key)) sessionsByState.set(key, []);
        sessionsByState.get(key)!.push(s);
      }

      let created = 0;
      const now = new Date();
      const hour = now.getHours();
      const startHour = parseInt(campaign.businessHoursStart || "08:00");
      const endHour = parseInt(campaign.businessHoursEnd || "18:00");

      if (hour < startHour || hour >= endHour) {
        const delayMs = hour < startHour
          ? (startHour - hour) * 3600_000
          : (24 - hour + startHour) * 3600_000;
        console.log(`[campaign] Outside business hours, re-queuing with ${Math.round(delayMs / 60000)}min delay`);
        await conversationQueue.add(
          "campaign-retry",
          { campaignId },
          { delay: delayMs },
        );
        return;
      }

      for (const { pharmacy } of targetPharmacies) {
        if (existingSet.has(pharmacy.id)) continue;

        const [camp] = await db
          .select()
          .from(campaigns)
          .where(eq(campaigns.id, campaignId))
          .limit(1);
        if (!camp || camp.status !== "running") break;

        const stateKey = pharmacy.state || "__any__";
        let candidates = sessionsByState.get(stateKey) || sessionsByState.get("__any__") || [];
        if (candidates.length === 0) candidates = availableSessions;

        const session = candidates.reduce((best, cur) =>
          cur.dailyMessageCount < best.dailyMessageCount ? cur : best,
        );

        if (session.dailyMessageCount >= session.maxDailyMessages) {
          console.log(`[campaign] Session ${session.phoneNumber} at daily limit, skipping`);
          continue;
        }

        const personaId = await selectPersonaForSession(db, session.id, pharmacy.id);
        if (!personaId) {
          console.log(`[campaign] No persona available for session ${session.id}`);
          continue;
        }

        const [conv] = await db
          .insert(conversations)
          .values({
            campaignId,
            pharmacyId: pharmacy.id,
            waSessionId: session.id,
            personaId,
            status: "pending",
          })
          .returning();

        await db
          .update(waSessions)
          .set({
            dailyMessageCount: session.dailyMessageCount + 1,
            lastActiveAt: now,
            updatedAt: now,
          })
          .where(eq(waSessions.id, session.id));

        session.dailyMessageCount += 1;

        const minDelay = 30_000;
        const maxDelay = 300_000;
        const delay = minDelay + Math.random() * (maxDelay - minDelay);

        await conversationQueue.add(
          `conv-${conv.id}`,
          { conversationId: conv.id },
          { delay: Math.round(delay) },
        );

        created++;

        if (created >= campaign.rateLimitPerHour) {
          console.log(`[campaign] Rate limit reached (${campaign.rateLimitPerHour}/batch), will continue later`);
          await conversationQueue.add(
            "campaign-continue",
            { campaignId },
            { delay: 3600_000 },
          );
          break;
        }
      }

      if (created === 0) {
        const [{ pending }] = await db
          .select({
            pending: sql<number>`count(*) filter (where ${conversations.status} in ('pending','initial','awaiting_response','parsing','follow_up'))::int`,
          })
          .from(conversations)
          .where(eq(conversations.campaignId, campaignId));

        if (pending === 0) {
          await db
            .update(campaigns)
            .set({ status: "completed", updatedAt: new Date() })
            .where(eq(campaigns.id, campaignId));
          console.log(`[campaign] Campaign ${campaignId} completed`);
        }
      }

      console.log(`[campaign] Created ${created} conversations for campaign ${campaignId}`);
    },
    {
      connection: { url: redisUrl },
      concurrency: 2,
    },
  );
}
