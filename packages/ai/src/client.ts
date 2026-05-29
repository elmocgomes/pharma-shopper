import Anthropic from "@anthropic-ai/sdk";
import type {
  PersonaProfile,
  ConversationContext,
  MessageType,
  GeneratedMessage,
  ParseResult,
  ParsedPrice,
} from "./types.js";
import {
  buildPersonaSystemPrompt,
  buildMessagePrompt,
  buildParseSystemPrompt,
  buildParseUserPrompt,
  pickScenario,
} from "./prompts.js";

export interface AiClientConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
}

const PRICE_TOOL: Anthropic.Tool = {
  name: "extract_prices",
  description: "Extract structured price and availability data from a pharmacy response",
  input_schema: {
    type: "object" as const,
    properties: {
      prices: {
        type: "array",
        items: {
          type: "object",
          properties: {
            productName: { type: "string", description: "Product name as mentioned" },
            brand: { type: ["string", "null"], description: "Brand name if mentioned" },
            price: { type: ["number", "null"], description: "Price in BRL (e.g. 25.90), null if not mentioned" },
            availability: {
              type: "string",
              enum: ["in_stock", "out_of_stock", "on_order", "unknown"],
            },
            isGeneric: { type: ["boolean", "null"], description: "Whether it's a generic version" },
            notes: { type: ["string", "null"], description: "Any additional notes" },
          },
          required: ["productName", "availability"],
        },
      },
      needsFollowUp: {
        type: "boolean",
        description: "Whether the response is incomplete and needs follow-up",
      },
      followUpReason: {
        type: ["string", "null"],
        description: "Why follow-up is needed, if applicable",
      },
      rawAnalysis: {
        type: "string",
        description: "Brief analysis of what was understood from the response",
      },
    },
    required: ["prices", "needsFollowUp", "rawAnalysis"],
  },
};

export class AiClient {
  private client: Anthropic;
  private model: string;
  private maxTokens: number;

  constructor(config: AiClientConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey });
    this.model = config.model || "claude-sonnet-4-20250514";
    this.maxTokens = config.maxTokens || 300;
  }

  async generateMessage(
    persona: PersonaProfile,
    ctx: ConversationContext,
    type: MessageType,
  ): Promise<GeneratedMessage> {
    const scenario = pickScenario(persona);
    const systemPrompt = buildPersonaSystemPrompt(persona, scenario);
    const userPrompt = buildMessagePrompt(type, ctx);

    const messages: Anthropic.MessageParam[] = [];

    if (ctx.previousMessages) {
      for (const msg of ctx.previousMessages) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    messages.push({ role: "user", content: userPrompt });

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system: systemPrompt,
      messages,
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    return { text, messageType: type };
  }

  async parseResponse(
    pharmacyResponse: string,
    requestedProducts: string[],
  ): Promise<ParseResult> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: buildParseSystemPrompt(),
      messages: [
        {
          role: "user",
          content: buildParseUserPrompt(pharmacyResponse, requestedProducts),
        },
      ],
      tools: [PRICE_TOOL],
      tool_choice: { type: "tool", name: "extract_prices" },
    });

    const toolBlock = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    if (!toolBlock) {
      return {
        prices: [],
        needsFollowUp: true,
        followUpReason: "Could not parse response",
        rawAnalysis: "No tool output returned",
      };
    }

    const input = toolBlock.input as {
      prices: ParsedPrice[];
      needsFollowUp: boolean;
      followUpReason?: string | null;
      rawAnalysis: string;
    };

    return {
      prices: input.prices || [],
      needsFollowUp: input.needsFollowUp ?? false,
      followUpReason: input.followUpReason ?? null,
      rawAnalysis: input.rawAnalysis || "",
    };
  }
}
