import Anthropic from "@anthropic-ai/sdk";

export interface AgentConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  systemPrompt?: string;
  temperature?: number;
}

/**
 * Base class for all AI agents. Provides shared Claude API helper.
 */
export abstract class BaseAgent {
  protected client: Anthropic;
  protected model: string;
  protected maxTokens: number;
  protected systemPrompt: string | undefined;
  protected temperature: number;

  constructor(config: AgentConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey });
    this.model = config.model;
    this.maxTokens = config.maxTokens;
    this.systemPrompt = config.systemPrompt;
    this.temperature = config.temperature ?? 0;
  }

  protected async callClaude(opts: {
    system?: string;
    messages: Anthropic.MessageParam[];
    tools?: Anthropic.Tool[];
    toolChoice?: Anthropic.ToolChoice;
    maxTokens?: number;
    model?: string;
  }): Promise<Anthropic.Message> {
    return this.client.messages.create({
      model: opts.model ?? this.model,
      max_tokens: opts.maxTokens ?? this.maxTokens,
      system: opts.system ?? this.systemPrompt,
      messages: opts.messages,
      ...(opts.tools ? { tools: opts.tools } : {}),
      ...(opts.toolChoice ? { tool_choice: opts.toolChoice } : {}),
      temperature: this.temperature,
    });
  }

  protected extractText(response: Anthropic.Message): string {
    return response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
  }

  protected extractToolInput<T>(response: Anthropic.Message, toolName?: string): T | null {
    const block = response.content.find(
      (b): b is Anthropic.ToolUseBlock =>
        b.type === "tool_use" && (!toolName || b.name === toolName),
    );
    return block ? (block.input as T) : null;
  }
}
