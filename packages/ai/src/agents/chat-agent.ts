import Anthropic from "@anthropic-ai/sdk";
import { BaseAgent, type AgentConfig } from "./base-agent.js";
import type { FlowTree, ChatResult, ChatChange } from "../flow-types.js";
import type { ProductInfo } from "../types.js";

const CHAT_TOOL: Anthropic.Tool = {
  name: "apply_changes",
  description: "Apply template/flow changes requested by the operator",
  input_schema: {
    type: "object" as const,
    properties: {
      changes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            nodeId: { type: "string" },
            changeType: {
              type: "string",
              enum: ["template_modified", "node_added", "node_removed", "branch_modified"],
            },
            description: { type: "string" },
            before: { type: ["string", "null"] },
            after: { type: ["string", "null"] },
          },
          required: ["nodeId", "changeType", "description"],
        },
      },
      modifiedTree: {
        type: "object",
        description: "The complete modified tree JSONB (only if changes were applied)",
      },
      explanation: {
        type: "string",
        description: "Human-readable explanation of what was changed and why",
      },
    },
    required: ["changes", "explanation"],
  },
};

const DEFAULT_SYSTEM_PROMPT =
  "Você é um assistente para operadores de mystery shopping farmacêutico.\n" +
  "O operador pode pedir ajustes nos templates de mensagem e nos fluxos de conversa.\n\n" +
  "CAPACIDADES:\n" +
  "- Modificar texto de templates (ex: 'torne o cumprimento mais formal')\n" +
  "- Ajustar tom e estilo de mensagens\n" +
  "- Explicar como o fluxo funciona\n" +
  "- Sugerir melhorias\n\n" +
  "REGRAS:\n" +
  "- Ao modificar templates, mantenha as variáveis {product_name}, {active_ingredient}, etc.\n" +
  "- Nunca revele que é um robô ou que está fazendo pesquisa\n" +
  "- Mantenha o estilo de comunicação do persona_style\n" +
  "- Mensagens devem ser naturais e curtas (WhatsApp)\n\n" +
  "Se o operador pedir uma mudança, use a ferramenta apply_changes.\n" +
  "Se for apenas uma pergunta, responda normalmente em texto.";

/**
 * Conversational AI for operators to adjust templates/flows.
 * Changes are applied to campaign_flows (not base flows).
 */
export class ChatAgent extends BaseAgent {
  constructor(config: Partial<AgentConfig> & { apiKey: string }) {
    super({
      model: "claude-sonnet-4-20250514",
      maxTokens: 2048,
      temperature: 0.3,
      ...config,
    });
  }

  async chat(
    userMessage: string,
    currentTree: FlowTree,
    campaignProducts: ProductInfo[],
    personaStyle: "formal" | "casual" | "anxious",
    history: { role: "user" | "assistant"; content: string }[],
  ): Promise<ChatResult> {
    const productList = campaignProducts
      .map((p) => p.name + (p.activeIngredient ? ` (${p.activeIngredient})` : ""))
      .join(", ");

    // Build a readable tree summary
    const treeSummary = this.buildTreeSummary(currentTree);

    const contextMessage =
      `Estilo: ${personaStyle}\n` +
      `Produtos: ${productList}\n\n` +
      `Árvore de decisão atual:\n${treeSummary}`;

    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: contextMessage },
      { role: "assistant", content: "Entendido. Como posso ajudar com os templates e fluxos?" },
    ];

    // Add conversation history
    for (const msg of history) {
      messages.push({ role: msg.role as "user" | "assistant", content: msg.content });
    }

    // Add current message
    messages.push({ role: "user", content: userMessage });

    const response = await this.callClaude({
      system: this.systemPrompt || DEFAULT_SYSTEM_PROMPT,
      messages,
      tools: [CHAT_TOOL],
    });

    // Check if AI used the tool (made changes) or just responded with text
    const toolResult = this.extractToolInput<{
      changes: ChatChange[];
      modifiedTree?: FlowTree;
      explanation: string;
    }>(response, "apply_changes");

    if (toolResult) {
      return {
        response: toolResult.explanation,
        appliedChanges: toolResult.changes,
        modifiedTree: toolResult.modifiedTree || null,
      };
    }

    // Text-only response (no changes applied)
    return {
      response: this.extractText(response),
      appliedChanges: null,
      modifiedTree: null,
    };
  }

  private buildTreeSummary(tree: FlowTree): string {
    const lines: string[] = [];
    for (const [nodeId, node] of Object.entries(tree.nodes)) {
      switch (node.type) {
        case "send":
          lines.push(`  ${nodeId} [send → ${node.next}]:`);
          for (const [i, t] of node.templates.entries()) {
            lines.push(`    [${i}] "${t}"`);
          }
          break;
        case "classify":
          lines.push(`  ${nodeId} [classify]:`);
          for (const b of node.branches) {
            lines.push(`    "${b.category}" (${b.description}) → ${b.target}`);
          }
          break;
        case "complete":
          lines.push(`  ${nodeId} [complete]`);
          if (node.thankYouTemplates) {
            for (const [i, t] of node.thankYouTemplates.entries()) {
              lines.push(`    [${i}] "${t}"`);
            }
          }
          break;
        case "fail":
          lines.push(`  ${nodeId} [fail: ${node.reason}]`);
          break;
      }
    }
    return lines.join("\n");
  }
}
