import { Worker, type Job } from "bullmq";
import type { Db } from "@pharma-shopper/db";
import type { AiClient } from "@pharma-shopper/ai";
import type { WaClient } from "@pharma-shopper/wa-client";
import { QUEUE_NAMES } from "../queues.js";
import { runConversationStep } from "../services/conversation-engine.js";

export interface ConversationJobData {
  conversationId: string;
}

export function createConversationWorker(
  redisUrl: string,
  db: Db,
  ai: AiClient,
  wa: WaClient,
): Worker<ConversationJobData> {
  return new Worker<ConversationJobData>(
    QUEUE_NAMES.CONVERSATION,
    async (job: Job<ConversationJobData>) => {
      const { conversationId } = job.data;
      console.log(`[conversation] Processing ${conversationId}`);
      await runConversationStep({ db, ai, wa }, conversationId);
    },
    {
      connection: { url: redisUrl },
      concurrency: 5,
      limiter: { max: 10, duration: 60_000 },
    },
  );
}
