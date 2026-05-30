import { Worker, type Job } from "bullmq";
import type { Db } from "@pharma-shopper/db";
import type { AiClient } from "@pharma-shopper/ai";
import type { WaClient } from "@pharma-shopper/wa-client";
import { QUEUE_NAMES } from "../queues.js";
import { handleIncomingMessage } from "../services/conversation-engine.js";

export interface ParseJobData {
  conversationId: string;
  messageText: string;
  imageUrl?: string | null;
  hasImage?: boolean;
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
      const { conversationId, messageText, imageUrl, hasImage } = job.data;
      console.log(
        `[parse] Parsing response for conversation ${conversationId}` +
          (hasImage ? " (with image)" : ""),
      );

      let textForParsing = messageText;

      // If the pharmacy sent an image, use Claude Vision to describe it
      if (hasImage && imageUrl) {
        try {
          console.log(`[parse] Downloading image from wa-gateway: ${imageUrl}`);
          const { buffer, contentType } = await wa.downloadMedia(imageUrl);

          const mediaType = contentType.startsWith("image/")
            ? (contentType as "image/jpeg" | "image/png" | "image/webp" | "image/gif")
            : "image/jpeg";

          const imageBase64 = buffer.toString("base64");

          console.log(`[parse] Describing image via Claude Vision (${buffer.length} bytes)`);
          const imageDescription = await ai.describeImage(
            imageBase64,
            mediaType,
            "Foto enviada por farmácia sobre medicamentos/produtos",
          );

          // Combine text caption (if any) with image description
          textForParsing = messageText
            ? `${messageText}\n\n[Imagem: ${imageDescription}]`
            : `[Imagem: ${imageDescription}]`;

          console.log(`[parse] Image described: ${imageDescription.substring(0, 100)}...`);
        } catch (err: any) {
          console.warn(`[parse] Failed to process image: ${err.message}`);
          // Fall back to text-only parsing
          textForParsing = messageText || "[Imagem não processada]";
        }
      }

      await handleIncomingMessage({ db, ai, wa }, conversationId, textForParsing);
    },
    {
      connection: { url: redisUrl },
      concurrency: 10,
    },
  );
}
