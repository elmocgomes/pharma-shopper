import Anthropic from "@anthropic-ai/sdk";
import type {
  PersonaProfile,
  ConversationContext,
  MessageType,
  GeneratedMessage,
  ParseResult,
  ParsedProduct,
  ConversationPhase,
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

const PHARMACY_DATA_TOOL: Anthropic.Tool = {
  name: "extract_pharmacy_data",
  description:
    "Extract structured product, pricing, and substitution behavior data from a pharmacy response",
  input_schema: {
    type: "object" as const,
    properties: {
      products: {
        type: "array",
        description: "All products mentioned in the pharmacy response",
        items: {
          type: "object",
          properties: {
            productName: {
              type: "string",
              description: "Product name as mentioned by the pharmacy",
            },
            brand: {
              type: ["string", "null"],
              description: "Brand name if mentioned (e.g. Merck, EMS, Medley)",
            },
            price: {
              type: ["number", "null"],
              description: "Price in BRL (e.g. 25.90), null if not mentioned",
            },
            availability: {
              type: "string",
              enum: ["in_stock", "out_of_stock", "on_order", "unknown"],
            },
            isGeneric: {
              type: ["boolean", "null"],
              description: "Whether it's a generic version",
            },
            substitutionType: {
              type: "string",
              enum: ["requested", "spontaneous", "prompted", "not_offered"],
              description:
                "How this product appeared: 'requested' = the product we asked about, " +
                "'spontaneous' = pharmacy offered it without being asked, " +
                "'prompted' = pharmacy offered it after we asked for alternatives, " +
                "'not_offered' = we asked for alternatives but none were offered",
            },
            dosage: {
              type: ["string", "null"],
              description: "Dosage (e.g. '50mg', '500mg/5ml', '25mg')",
            },
            quantity: {
              type: ["string", "null"],
              description:
                "Quantity/packaging (e.g. '30 comprimidos', '60cp', '1 frasco 120ml')",
            },
            presentation: {
              type: ["string", "null"],
              description:
                "Pharmaceutical form (e.g. 'comprimido', 'cápsula', 'suspensão', 'pomada', 'creme', 'solução', 'gotas')",
            },
            activeIngredient: {
              type: ["string", "null"],
              description:
                "Active ingredient if mentioned (e.g. 'losartana potássica', 'atenolol')",
            },
            notes: {
              type: ["string", "null"],
              description: "Any additional observations",
            },
          },
          required: ["productName", "availability", "substitutionType"],
        },
      },
      spontaneousSubstitution: {
        type: "boolean",
        description:
          "Whether the pharmacy spontaneously offered generic/similar/alternative products WITHOUT being asked. " +
          "true only if the pharmacy volunteered alternatives on their own initiative.",
      },
      spontaneousDetails: {
        type: ["string", "null"],
        description:
          "If spontaneousSubstitution is true, describe what was offered and how",
      },
      needsFollowUp: {
        type: "boolean",
        description:
          "Whether the response is incomplete and needs a follow-up question (missing price or availability)",
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
    required: [
      "products",
      "spontaneousSubstitution",
      "needsFollowUp",
      "rawAnalysis",
    ],
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
    phase: ConversationPhase = "phase1_branded",
    conversationHistory?: { role: "user" | "assistant"; content: string }[],
  ): Promise<ParseResult> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: buildParseSystemPrompt(phase),
      messages: [
        {
          role: "user",
          content: buildParseUserPrompt(
            pharmacyResponse,
            requestedProducts,
            phase,
            conversationHistory,
          ),
        },
      ],
      tools: [PHARMACY_DATA_TOOL],
      tool_choice: { type: "tool", name: "extract_pharmacy_data" },
    });

    const toolBlock = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    if (!toolBlock) {
      return {
        products: [],
        spontaneousSubstitution: false,
        spontaneousDetails: null,
        needsFollowUp: true,
        followUpReason: "Could not parse response",
        rawAnalysis: "No tool output returned",
      };
    }

    const input = toolBlock.input as {
      products: ParsedProduct[];
      spontaneousSubstitution: boolean;
      spontaneousDetails?: string | null;
      needsFollowUp: boolean;
      followUpReason?: string | null;
      rawAnalysis: string;
    };

    return {
      products: input.products || [],
      spontaneousSubstitution: input.spontaneousSubstitution ?? false,
      spontaneousDetails: input.spontaneousDetails ?? null,
      needsFollowUp: input.needsFollowUp ?? false,
      followUpReason: input.followUpReason ?? null,
      rawAnalysis: input.rawAnalysis || "",
    };
  }
}
