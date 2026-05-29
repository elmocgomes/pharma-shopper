import { Worker, type Job } from "bullmq";

export function createPingWorker(redisUrl: string) {
  return new Worker(
    "ping",
    async (job: Job) => {
      console.log(`[ping] processing job ${job.id}: ${JSON.stringify(job.data)}`);
      return { pong: true, timestamp: new Date().toISOString() };
    },
    { connection: { url: redisUrl } },
  );
}
