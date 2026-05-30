// Legacy exports (backward compat)
export { AiClient, type AiClientConfig } from "./client.js";
export type {
  PersonaProfile,
  ConversationContext,
  ConversationPhase,
  MessageType,
  GeneratedMessage,
  ParsedPrice,
  ParsedProduct,
  ParseResult,
  SubstitutionType,
  ProductInfo,
} from "./types.js";
export {
  buildPersonaSystemPrompt,
  buildMessagePrompt,
  buildParseSystemPrompt,
  buildParseUserPrompt,
  pickScenario,
} from "./prompts.js";

// New: Decision tree types
export type {
  FlowTree,
  FlowNode,
  SendNode,
  ClassifyNode,
  ClassifyBranch,
  CompleteNode,
  FailNode,
  TemplateVariables,
  CalibrationDiff,
  TemplateDiff,
  ClassificationResult,
  QuickParseResult,
  DeepAnalysisResult,
  AnalyzedProduct,
  SubstitutionBehavior,
  ConversationInsights,
  MonitorResult,
  HealthIssue,
  ChatResult,
  ChatChange,
} from "./flow-types.js";

// New: Agent classes
export { BaseAgent, type AgentConfig } from "./agents/base-agent.js";
export { ClassifierAgent } from "./agents/classifier-agent.js";
export { AnalystAgent } from "./agents/analyst-agent.js";
export { CalibratorAgent } from "./agents/calibrator-agent.js";
export { MonitorAgent } from "./agents/monitor-agent.js";
export { ChatAgent } from "./agents/chat-agent.js";

// New: Agent registry
export { AgentRegistry } from "./registry.js";
