import Anthropic from "@anthropic-ai/sdk";
import { BaseAgent, type AgentConfig } from "./base-agent.js";
import type { ClassifyBranch, ClassificationResult } from "../flow-types.js";

const CLASSIFY_TOOL: Anthropic.Tool = {
  name: "classify_response",
  description: "Classify a pharmacy WhatsApp response into one of the predefined categories",
  input_schema: {
    type: "object" as const,
    properties: {
      category: {
        type: "string",
        description: "The category that best matches the pharmacy response",
      },
      confidence: {
        type: "number",
        description: "Confidence score 0-1",
      },
    },
    required: ["category", "confidence"],
  },
};

const SYSTEM_PROMPT =
  "Você classifica respostas de farmácias em conversas de WhatsApp.\n" +
  "Analise a resposta e escolha a categoria mais adequada.\n" +
  "Considere o contexto da conversa para decidir.\n" +
  "Use a ferramenta classify_response para retornar sua classificação.";

/**
 * Lightweight Haiku classifier for navigating the decision tree.
 * ~145 tokens per call, ~$0.0001/call.
 */
export class ClassifierAgent extends BaseAgent {
  constructor(config: Omit<AgentConfig, "model" | "maxTokens">) {
    super({
      ...config,
      model: "claude-haiku-3-5-20241022",
      maxTokens: 150,
      temperature: 0,
    });
  }

  async classify(
    pharmacyResponse: string,
    branches: ClassifyBranch[],
    conversationHistory?: { role: "user" | "assistant"; content: string }[],
  ): Promise<ClassificationResult> {
    const branchDescriptions = branches
      .map((b) => `- "${b.category}": ${b.description}`)
      .join("\n");

    const validCategories = branches.map((b) => b.category);

    let userPrompt =
      `Categorias disponíveis:\n${branchDescriptions}\n\n`;

    if (conversationHistory?.length) {
      userPrompt += "Contexto da conversa:\n";
      for (const msg of conversationHistory.slice(-4)) {
        userPrompt += `${msg.role === "assistant" ? "Nós" : "Farmácia"}: "${msg.content}"\n`;
      }
      userPrompt += "\n";
    }

    userPrompt += `Resposta da farmácia para classificar:\n"${pharmacyResponse}"`;

    // Dynamic tool schema with valid categories
    const tool: Anthropic.Tool = {
      ...CLASSIFY_TOOL,
      input_schema: {
        ...CLASSIFY_TOOL.input_schema,
        properties: {
          category: {
            type: "string",
            enum: validCategories,
            description: "The category that best matches the pharmacy response",
          },
          confidence: {
            type: "number",
            description: "Confidence score 0-1",
          },
        },
        required: ["category", "confidence"],
      },
    };

    const response = await this.callClaude({
      system: this.systemPrompt || SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      tools: [tool],
      toolChoice: { type: "tool", name: "classify_response" },
    });

    const result = this.extractToolInput<ClassificationResult>(response, "classify_response");

    if (!result || !validCategories.includes(result.category)) {
      // Fallback: pick the first branch (usually "unclear" or similar)
      return { category: branches[branches.length - 1].category, confidence: 0 };
    }

    return result;
  }
}
