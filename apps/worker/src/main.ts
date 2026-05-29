import "dotenv/config";
import { createDb } from "@pharma-shopper/db";
import { AiClient } from "@pharma-shopper/ai";
import { WaClient } from "@pharma-shopper/wa-client";
import { createQueues, QUEUE_NAMES } from "./queues.js";
import { createPingWorker } from "./workers/ping.worker.js";
import { createCampaignWorker } from "./workers/campaign.worker.js";
import { createConversationWorker } from "./workers/conversation.worker.js";
import { createParseWorker } from "./workers/parse.worker.js";
import { createMaintenanceWorker } from "./workers/maintenance.worker.js";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const databaseUrl = process.env.DATABASE_URL || "";
const anthropicKey = process.env.ANTHROPIC_API_KEY || "";
const waGatewayUrl = process.env.WA_GATEWAY_URL || "http://localhost:5001";
const waGatewayKey = process.env.WA_GATEWAY_KEY || "";

const db = createDb(databaseUrl);
const ai = new AiClient({ apiKey: anthropicKey });
const wa = new WaClient({ baseUrl: waGatewayUrl, apiKey: waGatewayKey });

const queues = createQueues(redisUrl);
const pingWorker = createPingWorker(redisUrl);
const campaignWorker = createCampaignWorker(redisUrl, db);
const conversationWorker = createConversationWorker(redisUrl, db, ai, wa);
const parseWorker = createParseWorker(redisUrl, db, ai, wa);
const maintenanceWorker = createMaintenanceWorker(redisUrl, db, wa);

// Schedule repeatable maintenance jobs
async function scheduleMaintenanceJobs() {
  const maintenanceQueue = queues.maintenance;

  // Daily count reset — every day at 03:00 UTC (00:00 BRT)
  await maintenanceQueue.upsertJobScheduler(
    "daily-reset",
    { pattern: "0 3 * * *" },
    { name: "daily-reset", data: { task: "daily_reset" } },
  );

  // Timeout checker — every 5 minutes
  await maintenanceQueue.upsertJobScheduler(
    "timeout-check",
    { every: 5 * 60 * 1000 },
    { name: "timeout-check", data: { task: "timeout_check" } },
  );

  // Warmup limit enforcer — every hour
  await maintenanceQueue.upsertJobScheduler(
    "warmup-enforce",
    { pattern: "0 * * * *" },
    { name: "warmup-enforce", data: { task: "warmup_enforce" } },
  );

  // Session health check — every 2 minutes
  await maintenanceQueue.upsertJobScheduler(
    "session-health",
    { every: 2 * 60 * 1000 },
    { name: "session-health", data: { task: "session_health" } },
  );

  console.log("[maintenance] Scheduled repeatable jobs: daily-reset, timeout-check (5min), warmup-enforce (hourly), session-health (2min)");
}

scheduleMaintenanceJobs().catch((err) => {
  console.error("[maintenance] Failed to schedule jobs:", err.message);
});

// Event handlers
pingWorker.on("completed", (job) => {
  console.log(`[ping] job ${job.id} completed`);
});

campaignWorker.on("completed", (job) => {
  console.log(`[campaign] job ${job.id} completed`);
});
campaignWorker.on("failed", (job, err) => {
  console.error(`[campaign] job ${job?.id} failed:`, err.message);
});

conversationWorker.on("completed", (job) => {
  console.log(`[conversation] job ${job.id} completed`);
});
conversationWorker.on("failed", (job, err) => {
  console.error(`[conversation] job ${job?.id} failed:`, err.message);
});

parseWorker.on("completed", (job) => {
  console.log(`[parse] job ${job.id} completed`);
});
parseWorker.on("failed", (job, err) => {
  console.error(`[parse] job ${job?.id} failed:`, err.message);
});

maintenanceWorker.on("completed", (job) => {
  console.log(`[maintenance] job ${job.id} (${job.data.task}) completed`);
});
maintenanceWorker.on("failed", (job, err) => {
  console.error(`[maintenance] job ${job?.id} failed:`, err.message);
});

console.log(`Worker started. Queues: ${Object.values(QUEUE_NAMES).join(", ")}`);

async function shutdown() {
  console.log("Shutting down workers...");
  await Promise.all([
    pingWorker.close(),
    campaignWorker.close(),
    conversationWorker.close(),
    parseWorker.close(),
    maintenanceWorker.close(),
  ]);
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
