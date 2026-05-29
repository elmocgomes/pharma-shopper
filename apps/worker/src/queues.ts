import { Queue } from "bullmq";

export const QUEUE_NAMES = {
  CAMPAIGN: "campaign",
  CONVERSATION: "conversation",
  PARSE: "parse",
  MAINTENANCE: "maintenance",
} as const;

export function createQueues(redisUrl: string) {
  const connection = { url: redisUrl };
  return {
    campaign: new Queue(QUEUE_NAMES.CAMPAIGN, { connection }),
    conversation: new Queue(QUEUE_NAMES.CONVERSATION, { connection }),
    parse: new Queue(QUEUE_NAMES.PARSE, { connection }),
    maintenance: new Queue(QUEUE_NAMES.MAINTENANCE, { connection }),
  };
}
