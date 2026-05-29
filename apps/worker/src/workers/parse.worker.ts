import { Worker, type Job } from "bullmq";
import type { Db } from "@pharma-shopper/db";
import type { AiClient } from "@pharma-shopper/ai";
import type { WaClient } from "@pharma-shopper/wa-client";
import { QUEUE_NAMES } from "../queues.js";
import { handleIncomingMessage } from "../services/conversation-engine.js";

export interface ParseJobData {
  conversationId: string;
  messageText: string;
}

export function createParseWorker(
  redisUrl: string,
  db: Db,
  ai: AiClient,
  wa: WaClient,
): Worker<ParseJobData> {
  return new Worker<ParseJobData>(
    QUEUE_NAMES.PARSE,
    async (job: Job<ParseJobData>) => {
      const { conversationId, messageText } = job.data;
      console.log(`[parse] Parsing response for conversation ${conversationId}`);
      await handleIncomingMessage({ db, ai, wa }, conversationId, messageText);
    },
    {
      connection: { url: redisUrl },
      concurrency: 10,
    },
  );
}
