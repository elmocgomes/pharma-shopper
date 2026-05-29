import { Worker, type Job } from "bullmq";
import { eq, and, lt, inArray, sql, isNotNull, ne } from "drizzle-orm";
import type { Db } from "@pharma-shopper/db";
import { conversations, waSessions, campaigns } from "@pharma-shopper/db";
import type { WaClient } from "@pharma-shopper/wa-client";

const RESPONSE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const WARMUP_DAYS = 3;
const WARMUP_DAILY_LIMIT = 10;

interface MaintenanceJobData {
  task: "daily_reset" | "timeout_check" | "warmup_enforce" | "session_health";
}

export function createMaintenanceWorker(redisUrl: string, db: Db, wa?: WaClient) {
  const worker = new Worker<MaintenanceJobData>(
    "maintenance",
    async (job: Job<MaintenanceJobData>) => {
      switch (job.data.task) {
        case "daily_reset":
          return await resetDailyCounts(db);
        case "timeout_check":
          return await checkTimeouts(db);
        case "warmup_enforce":
          return await enforceWarmupLimits(db);
        case "session_health":
          return wa ? await checkSessionHealth(db, wa) : { skipped: true };
        default:
          throw new Error(`Unknown maintenance task: ${job.data.task}`);
      }
    },
    {
      connection: { url: redisUrl },
      concurrency: 1,
    },
  );

  return worker;
}

/**
 * Reset daily message counts to 0 for all WhatsApp sessions.
 * Should run once at midnight (BRT / UTC-3).
 */
async function resetDailyCounts(db: Db): Promise<{ resetCount: number }> {
  const today = new Date().toISOString().split("T")[0];

  const result = await db
    .update(waSessions)
    .set({
      dailyMessageCount: 0,
      dailyCountResetAt: today,
      updatedAt: new Date(),
    })
    .where(
      sql`${waSessions.dailyCountResetAt} IS NULL OR ${waSessions.dailyCountResetAt} < ${today}`,
    );

  const count = (result as any).rowCount ?? 0;
  console.log(`[maintenance] Reset daily counts for ${count} sessions`);
  return { resetCount: count };
}

/**
 * Check for conversations stuck in awaiting_response beyond the timeout.
 * Marks them as "timeout" so they don't block campaigns.
 */
async function checkTimeouts(db: Db): Promise<{ timedOut: number }> {
  const cutoff = new Date(Date.now() - RESPONSE_TIMEOUT_MS);

  const staleConversations = await db
    .select({ id: conversations.id, phase: conversations.phase })
    .from(conversations)
    .where(
      and(
        eq(conversations.status, "awaiting_response"),
        isNotNull(conversations.lastMessageAt),
        lt(conversations.lastMessageAt, cutoff),
      ),
    );

  if (staleConversations.length === 0) {
    console.log("[maintenance] No timed-out conversations found");
    return { timedOut: 0 };
  }

  // Phase 1 timeouts → transition to phase 2 instead of marking as timed out
  const phase1Timeouts = staleConversations.filter((c) => c.phase === "phase1_branded");
  const phase2Timeouts = staleConversations.filter((c) => c.phase !== "phase1_branded");

  if (phase1Timeouts.length > 0) {
    const phase1Ids = phase1Timeouts.map((c) => c.id);
    await db
      .update(conversations)
      .set({
        phase: "phase2_alternatives",
        status: "initial",
        spontaneousSubstitution: false,
      })
      .where(inArray(conversations.id, phase1Ids));
    console.log(
      `[maintenance] ${phase1Ids.length} phase-1 timeouts → transitioned to phase 2`,
    );
  }

  const ids = phase2Timeouts.map((c) => c.id);

  if (ids.length > 0) {
    await db
      .update(conversations)
      .set({
        status: "timeout",
        completedAt: new Date(),
      })
      .where(inArray(conversations.id, ids));
  }

  console.log(
    `[maintenance] Marked ${ids.length} conversations as timed out (${phase1Timeouts.length} transitioned to phase 2)`,
  );

  // Check if any campaigns are now fully complete
  const affectedCampaignIds = await db
    .select({ campaignId: conversations.campaignId })
    .from(conversations)
    .where(inArray(conversations.id, ids));

  const uniqueCampaignIds = [
    ...new Set(affectedCampaignIds.map((c) => c.campaignId)),
  ];

  for (const campaignId of uniqueCampaignIds) {
    const [remaining] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(conversations)
      .where(
        and(
          eq(conversations.campaignId, campaignId),
          inArray(conversations.status, [
            "pending",
            "initial",
            "awaiting_response",
            "parsing",
            "follow_up",
          ]),
        ),
      );

    if (remaining && remaining.count === 0) {
      await db
        .update(campaigns)
        .set({ status: "completed" })
        .where(
          and(
            eq(campaigns.id, campaignId),
            eq(campaigns.status, "running"),
          ),
        );
      console.log(`[maintenance] Campaign ${campaignId} auto-completed (all conversations done)`);
    }
  }

  return { timedOut: ids.length };
}

/**
 * Enforce warmup limits on new WhatsApp sessions.
 * Sessions created within the warmup period have a lower daily message cap.
 */
async function enforceWarmupLimits(db: Db): Promise<{ adjusted: number }> {
  const warmupCutoff = new Date();
  warmupCutoff.setDate(warmupCutoff.getDate() - WARMUP_DAYS);

  // Sessions still in warmup period: created after the cutoff
  const result = await db
    .update(waSessions)
    .set({
      maxDailyMessages: WARMUP_DAILY_LIMIT,
      updatedAt: new Date(),
    })
    .where(
      and(
        sql`${waSessions.createdAt} > ${warmupCutoff.toISOString()}`,
        sql`${waSessions.maxDailyMessages} > ${WARMUP_DAILY_LIMIT}`,
      ),
    );

  const count = (result as any).rowCount ?? 0;
  console.log(`[maintenance] Enforced warmup limits on ${count} sessions`);
  return { adjusted: count };
}

/**
 * Active health check: polls wa-gateway for real session status,
 * reconciles with DB, and attempts auto-reconnect for disconnected sessions.
 * Runs every 2 minutes.
 */
async function checkSessionHealth(
  db: Db,
  wa: WaClient,
): Promise<{ checked: number; reconnected: number; stale: number }> {
  // Get all sessions that aren't banned (banned = manual intervention needed)
  const dbSessions = await db
    .select()
    .from(waSessions)
    .where(ne(waSessions.status, "banned"));

  let checked = 0;
  let reconnected = 0;
  let stale = 0;

  for (const session of dbSessions) {
    checked++;
    try {
      const detail = await wa.getSession(session.waGatewaySessionId);
      const isConnected = detail?.connection?.isConnected === true;

      if (isConnected && session.status !== "connected") {
        // Gateway says connected but DB says otherwise — sync DB
        await db
          .update(waSessions)
          .set({ status: "connected", updatedAt: new Date() })
          .where(eq(waSessions.id, session.id));
        console.log(`[session-health] ${session.phoneNumber} synced → connected`);
      } else if (!isConnected && session.status === "connected") {
        // DB says connected but gateway says not — mark stale
        stale++;
        console.log(
          `[session-health] ${session.phoneNumber} detected stale (DB=connected, gateway=disconnected)`,
        );
        await db
          .update(waSessions)
          .set({ status: "disconnected", updatedAt: new Date() })
          .where(eq(waSessions.id, session.id));

        // Attempt auto-reconnect: startSession triggers re-auth with stored credentials
        try {
          await wa.startSession(session.waGatewaySessionId);
          console.log(
            `[session-health] ${session.phoneNumber} auto-reconnect triggered`,
          );
          reconnected++;
        } catch (reconnectErr: any) {
          console.warn(
            `[session-health] ${session.phoneNumber} auto-reconnect failed: ${reconnectErr.message}`,
          );
        }
      }
    } catch (err: any) {
      // Session doesn't exist in gateway at all — try to re-create it
      if (session.status === "connected" || session.status === "qr_pending") {
        stale++;
        await db
          .update(waSessions)
          .set({ status: "disconnected", updatedAt: new Date() })
          .where(eq(waSessions.id, session.id));
        console.warn(
          `[session-health] ${session.phoneNumber} not found in gateway, marked disconnected`,
        );

        // Try starting a new session — if credentials exist in the volume, it reconnects
        try {
          await wa.startSession(session.waGatewaySessionId);
          console.log(
            `[session-health] ${session.phoneNumber} re-created in gateway, awaiting auth`,
          );
          reconnected++;
        } catch (startErr: any) {
          console.warn(
            `[session-health] ${session.phoneNumber} re-create failed: ${startErr.message}`,
          );
        }
      }
    }
  }

  console.log(
    `[session-health] Checked ${checked} sessions: ${stale} stale, ${reconnected} reconnect attempts`,
  );
  return { checked, reconnected, stale };
}
