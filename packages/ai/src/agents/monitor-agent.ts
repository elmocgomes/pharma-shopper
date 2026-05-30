import Anthropic from "@anthropic-ai/sdk";
import { BaseAgent, type AgentConfig } from "./base-agent.js";
import type { MonitorResult, HealthIssue } from "../flow-types.js";

const MONITOR_TOOL: Anthropic.Tool = {
  name: "health_check",
  description: "Assess the health of a running mystery shopping conversation",
  input_schema: {
    type: "object" as const,
    properties: {
      status: {
        type: "string",
        enum: ["healthy", "warning", "critical"],
        description: "Overall conversation health",
      },
      issues: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["bot_detected", "stuck", "confused", "off_topic", "hostile", "other"],
            },
            description: { type: "string" },
            severity: { type: "string", enum: ["warning", "critical"] },
          },
          required: ["type", "description", "severity"],
        },
      },
      recommendedAction: {
        type: "string",
        enum: ["none", "flag", "pause"],
      },
    },
    required: ["status", "issues", "recommendedAction"],
  },
};

const DEFAULT_SYSTEM_PROMPT =
  "Você monitora conversas de mystery shopping com farmácias para detectar problemas.\n\n" +
  "DETECTE:\n" +
  "- bot_detected: farmácia perguntou 'é robô?', 'isso é automático?', etc.\n" +
  "- stuck: conversa não avança, mesma pergunta repetida 3+ vezes\n" +
  "- confused: farmácia claramente não entendeu o que foi perguntado\n" +
  "- off_topic: conversa saiu do assunto (medicamentos/preços)\n" +
  "- hostile: farmácia irritada, ameaçando bloquear ou denunciar\n\n" +
  "SEVERIDADE:\n" +
  "- warning: problema detectado mas a conversa pode continuar\n" +
  "- critical: conversa deve ser pausada imediatamente\n\n" +
  "AÇÃO RECOMENDADA:\n" +
  "- none: sem problemas\n" +
  "- flag: marcar para revisão humana\n" +
  "- pause: pausar conversa imediatamente\n\n" +
  "Se a conversa está fluindo normalmente, retorne status='healthy' com lista vazia de issues.\n\n" +
  "Use a ferramenta health_check para retornar o resultado.";

/**
 * Monitors running conversations for anomalies.
 * Uses Haiku for cheap, fast checks (~$0.0001/call).
 */
export class MonitorAgent extends BaseAgent {
  constructor(config: Omit<AgentConfig, "model" | "maxTokens">) {
    super({
      ...config,
      model: "claude-haiku-3-5-20241022",
      maxTokens: 256,
      temperature: 0,
    });
  }

  async checkConversation(
    messages: { role: "user" | "assistant"; content: string }[],
    currentNode: string | null,
    nodeVisitCount: number,
  ): Promise<MonitorResult> {
    // Only look at last 3-4 messages for efficiency
    const recentMessages = messages.slice(-4);

    let userPrompt = "Verifique esta conversa de mystery shopping:\n\n";

    for (const msg of recentMessages) {
      userPrompt += `${msg.role === "assistant" ? "[Shopper]" : "[Farmácia]"}: ${msg.content}\n`;
    }

    userPrompt += `\nNó atual da árvore: ${currentNode || "desconhecido"}`;
    userPrompt += `\nVisitas ao nó atual: ${nodeVisitCount}`;

    if (nodeVisitCount >= 3) {
      userPrompt += "\n⚠️ A conversa visitou o mesmo nó 3+ vezes — pode estar travada.";
    }

    const response = await this.callClaude({
      system: this.systemPrompt || DEFAULT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      tools: [MONITOR_TOOL],
      toolChoice: { type: "tool", name: "health_check" },
    });

    const result = this.extractToolInput<MonitorResult>(response, "health_check");

    if (!result) {
      return { status: "healthy", issues: [], recommendedAction: "none" };
    }

    return result;
  }
}
