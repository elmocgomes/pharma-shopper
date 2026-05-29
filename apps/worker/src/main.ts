import "dotenv/config";
import { createQueues, QUEUE_NAMES } from "./queues.js";
import { createPingWorker } from "./workers/ping.worker.js";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

const queues = createQueues(redisUrl);
const pingWorker = createPingWorker(redisUrl);

pingWorker.on("completed", (job) => {
  console.log(`[ping] job ${job.id} completed`);
});

console.log(`Worker started. Queues: ${Object.values(QUEUE_NAMES).join(", ")}`);

async function shutdown() {
  console.log("Shutting down workers...");
  await pingWorker.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
