import Anthropic from "@anthropic-ai/sdk";
import { BaseAgent, type AgentConfig } from "./base-agent.js";
import type { FlowTree, CalibrationDiff, TemplateDiff } from "../flow-types.js";
import type { ProductInfo } from "../types.js";

const CALIBRATE_TOOL: Anthropic.Tool = {
  name: "calibrate_templates",
  description: "Return calibrated template texts for campaign-specific products and therapy",
  input_schema: {
    type: "object" as const,
    properties: {
      calibratedTemplates: {
        type: "array",
        description: "List of templates that were modified",
        items: {
          type: "object",
          properties: {
            nodeId: { type: "string", description: "ID of the tree node" },
            templateIndex: { type: "number", description: "Index of the template in the node's templates array" },
            original: { type: "string", description: "Original template text" },
            calibrated: { type: "string", description: "Calibrated template text for this campaign" },
            reason: { type: "string", description: "Brief reason for the change" },
          },
          required: ["nodeId", "templateIndex", "original", "calibrated"],
        },
      },
    },
    required: ["calibratedTemplates"],
  },
};

const DEFAULT_SYSTEM_PROMPT =
  "Você é um calibrador de templates para mystery shopping farmacêutico.\n\n" +
  "TAREFA: Receber templates base de uma árvore de decisão e ajustá-los para uma " +
  "campanha específica, considerando os produtos, princípio ativo e tipo de terapia.\n\n" +
  "REGRAS:\n" +
  "- Templates com variáveis como {product_name} NÃO precisam ser calibrados — as variáveis " +
  "são interpoladas automaticamente em tempo de execução\n" +
  "- Calibre APENAS templates que contêm referências hardcoded a terapias, sintomas, " +
  "contextos de uso ou formas de perguntar sobre alternativas\n" +
  "- Ex: 'Meu médico receitou pra pressão' → ajuste 'pressão' para a terapia da campanha\n" +
  "- Ex: 'tem genérico do losartan?' → ajuste 'losartan' para o princípio ativo da campanha\n" +
  "- Mantenha o estilo de comunicação (formal/casual/ansioso) EXATAMENTE como está\n" +
  "- Mantenha a brevidade — são mensagens de WhatsApp\n" +
  "- NÃO modifique cumprimentos, agradecimentos, respostas de CPF ou templates genéricos\n" +
  "- Se NENHUM template precisa de calibração, retorne uma lista vazia\n\n" +
  "Use a ferramenta calibrate_templates para retornar os ajustes.";

/**
 * Calibrates base flow templates for a specific campaign's products and therapy.
 * Runs ONCE per campaign per persona style (~$0.02 per campaign total).
 */
export class CalibratorAgent extends BaseAgent {
  constructor(config: Partial<AgentConfig> & { apiKey: string }) {
    super({
      model: "claude-sonnet-4-20250514",
      maxTokens: 2048,
      temperature: 0.3,
      ...config,
    });
  }

  async calibrateFlow(
    baseTree: FlowTree,
    campaignProducts: ProductInfo[],
    personaStyle: "formal" | "casual" | "anxious",
    therapyType?: string,
  ): Promise<{ calibratedTree: FlowTree; diff: CalibrationDiff }> {
    const productList = campaignProducts
      .map((p) => {
        const parts = [p.name];
        if (p.activeIngredient) parts.push(`(princípio ativo: ${p.activeIngredient})`);
        if (p.presentation) parts.push(`[${p.presentation}]`);
        return parts.join(" ");
      })
      .join("\n  - ");

    // Build a readable version of all templates in the tree
    const templateListing: string[] = [];
    for (const [nodeId, node] of Object.entries(baseTree.nodes)) {
      if ("templates" in node && Array.isArray((node as any).templates)) {
        const templates = (node as any).templates as string[];
        templates.forEach((t: string, i: number) => {
          templateListing.push(`[${nodeId}][${i}] "${t}"`);
        });
      }
      if ("thankYouTemplates" in node && Array.isArray((node as any).thankYouTemplates)) {
        const templates = (node as any).thankYouTemplates as string[];
        templates.forEach((t: string, i: number) => {
          templateListing.push(`[${nodeId}][${i}] "${t}"`);
        });
      }
    }

    const userPrompt =
      `Estilo de comunicação: ${personaStyle}\n\n` +
      `Produtos da campanha:\n  - ${productList}\n` +
      (therapyType ? `\nTipo de terapia: ${therapyType}\n` : "") +
      `\nTemplates da árvore de decisão:\n${templateListing.join("\n")}\n\n` +
      "Identifique quais templates precisam ser calibrados para esta campanha " +
      "e retorne os textos ajustados.";

    const response = await this.callClaude({
      system: this.systemPrompt || DEFAULT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      tools: [CALIBRATE_TOOL],
      toolChoice: { type: "tool", name: "calibrate_templates" },
    });

    const result = this.extractToolInput<{
      calibratedTemplates: Array<{
        nodeId: string;
        templateIndex: number;
        original: string;
        calibrated: string;
      }>;
    }>(response, "calibrate_templates");

    // Apply calibrations to a deep copy of the tree
    const calibratedTree: FlowTree = JSON.parse(JSON.stringify(baseTree));
    const diff: CalibrationDiff = {};

    if (result?.calibratedTemplates) {
      for (const change of result.calibratedTemplates) {
        const node = calibratedTree.nodes[change.nodeId];
        if (!node) continue;

        const templateArray =
          "templates" in node
            ? (node as any).templates
            : "thankYouTemplates" in node
              ? (node as any).thankYouTemplates
              : null;

        if (templateArray && change.templateIndex < templateArray.length) {
          templateArray[change.templateIndex] = change.calibrated;

          if (!diff[change.nodeId]) diff[change.nodeId] = [];
          diff[change.nodeId].push({
            templateIndex: change.templateIndex,
            original: change.original,
            calibrated: change.calibrated,
          });
        }
      }
    }

    return { calibratedTree, diff };
  }
}
