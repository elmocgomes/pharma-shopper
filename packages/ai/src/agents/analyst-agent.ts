import Anthropic from "@anthropic-ai/sdk";
import { BaseAgent, type AgentConfig } from "./base-agent.js";
import type {
  DeepAnalysisResult,
  AnalyzedProduct,
  SubstitutionBehavior,
  ConversationInsights,
} from "../flow-types.js";
import type { ProductInfo } from "../types.js";

const ANALYSIS_TOOL: Anthropic.Tool = {
  name: "conversation_analysis",
  description: "Full analysis of a completed mystery shopping conversation with a pharmacy",
  input_schema: {
    type: "object" as const,
    properties: {
      products: {
        type: "array",
        description: "All products mentioned during the entire conversation, in order of mention",
        items: {
          type: "object",
          properties: {
            productName: { type: "string", description: "Product name as mentioned by pharmacy" },
            brand: { type: ["string", "null"], description: "Brand name if mentioned" },
            price: { type: ["number", "null"], description: "Price in BRL" },
            availability: { type: "string", enum: ["in_stock", "out_of_stock", "on_order", "unknown"] },
            isGeneric: { type: "boolean", description: "Whether generic version" },
            mentionOrder: { type: "number", description: "Order of first mention (1, 2, 3...)" },
            mentionContext: { type: "string", enum: ["spontaneous", "prompted", "requested"] },
            mentionPhase: { type: "string", enum: ["phase1", "phase2"] },
            rawQuote: { type: ["string", "null"], description: "Exact pharmacy text mentioning this product" },
            dosage: { type: ["string", "null"] },
            quantity: { type: ["string", "null"] },
            presentation: { type: ["string", "null"] },
            activeIngredient: { type: ["string", "null"] },
            notes: { type: ["string", "null"] },
          },
          required: ["productName", "availability", "isGeneric", "mentionOrder", "mentionContext", "mentionPhase"],
        },
      },
      substitutionBehavior: {
        type: "object",
        properties: {
          spontaneous: { type: "boolean", description: "Did pharmacy offer alternatives without being asked?" },
          eagerness: { type: "string", enum: ["high", "medium", "low", "none"], description: "How eagerly they offered alternatives" },
          details: { type: ["string", "null"], description: "Description of substitution behavior" },
        },
        required: ["spontaneous", "eagerness"],
      },
      conversationInsights: {
        type: "object",
        properties: {
          clerkKnowledge: { type: "string", enum: ["high", "medium", "low", "unknown"] },
          discountMentioned: { type: "boolean", description: "Did pharmacy mention any discount program?" },
          helpfulness: { type: "string", enum: ["high", "medium", "low", "unknown"] },
          notes: { type: ["string", "null"] },
        },
        required: ["clerkKnowledge", "discountMentioned", "helpfulness"],
      },
      dataCompleteness: {
        type: "object",
        properties: {
          score: { type: "number", description: "0-100 completeness score" },
          missingFields: { type: "array", items: { type: "string" }, description: "List of missing data fields" },
        },
        required: ["score", "missingFields"],
      },
    },
    required: ["products", "substitutionBehavior", "conversationInsights", "dataCompleteness"],
  },
};

const DEFAULT_SYSTEM_PROMPT =
  "Você é um analista especializado em mystery shopping farmacêutico.\n" +
  "Analise a conversa COMPLETA entre um mystery shopper e uma farmácia brasileira.\n\n" +
  "OBJETIVO: Extrair TODOS os dados de produtos, preços, disponibilidade e comportamento " +
  "de substituição da conversa.\n\n" +
  "ATENÇÃO ESPECIAL:\n" +
  "- ORDEM DE MENÇÃO: numere cada produto na ordem em que a farmácia o mencionou pela primeira vez\n" +
  "- CITAÇÃO DIRETA: copie o trecho exato da farmácia que menciona cada produto (rawQuote)\n" +
  "- CONTEXTO DE MENÇÃO: 'spontaneous' = farmácia ofereceu sem ser perguntada, " +
  "'prompted' = farmácia ofereceu quando perguntamos sobre alternativas, " +
  "'requested' = o produto que nós pedimos\n" +
  "- FASE: 'phase1' = resposta à pergunta sobre o produto específico, " +
  "'phase2' = resposta à pergunta sobre genéricos/alternativas\n\n" +
  "FORMATOS DE PREÇO BR: R$ 25,90 / R$25.90 / 25 reais / 25,90\n" +
  "DISPONIBILIDADE: 'tem sim'/'temos' = in_stock, 'em falta'/'não temos' = out_of_stock, " +
  "'encomenda' = on_order\n\n" +
  "Use a ferramenta conversation_analysis para retornar a análise estruturada.";

/**
 * Deep conversation analyst. Runs ONCE per completed conversation.
 * Uses Sonnet for thorough analysis of the entire conversation history.
 */
export class AnalystAgent extends BaseAgent {
  constructor(config: Partial<AgentConfig> & { apiKey: string }) {
    super({
      model: "claude-sonnet-4-20250514",
      maxTokens: 2048,
      temperature: 0,
      ...config,
    });
  }

  async deepAnalyze(
    messages: { role: "user" | "assistant"; content: string }[],
    campaignProducts: ProductInfo[],
    pharmacyInfo: { name: string; city?: string | null; state?: string | null },
  ): Promise<DeepAnalysisResult> {
    const productList = campaignProducts
      .map((p) => {
        const parts = [p.name];
        if (p.activeIngredient) parts.push(`(${p.activeIngredient})`);
        if (p.presentation) parts.push(p.presentation);
        return parts.join(" ");
      })
      .join(", ");

    let userPrompt =
      `Farmácia: ${pharmacyInfo.name}` +
      (pharmacyInfo.city ? ` — ${pharmacyInfo.city}/${pharmacyInfo.state}` : "") +
      `\nProdutos da campanha: ${productList}\n\n` +
      "CONVERSA COMPLETA:\n";

    for (const msg of messages) {
      userPrompt += `${msg.role === "assistant" ? "[Mystery Shopper]" : "[Farmácia]"}: ${msg.content}\n`;
    }

    userPrompt += "\nAnalise toda a conversa e extraia todos os dados.";

    const response = await this.callClaude({
      system: this.systemPrompt || DEFAULT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      tools: [ANALYSIS_TOOL],
      toolChoice: { type: "tool", name: "conversation_analysis" },
    });

    const result = this.extractToolInput<DeepAnalysisResult>(response, "conversation_analysis");

    if (!result) {
      return {
        products: [],
        substitutionBehavior: { spontaneous: false, eagerness: "none", details: null },
        conversationInsights: {
          clerkKnowledge: "unknown",
          discountMentioned: false,
          helpfulness: "unknown",
          notes: "Analysis failed — no tool output",
        },
        dataCompleteness: { score: 0, missingFields: ["all"] },
      };
    }

    return result;
  }
}
