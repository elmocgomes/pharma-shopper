/**
 * Decision tree types for conversation flows.
 *
 * A flow is a directed graph of nodes. Each node has a type that
 * determines its behavior:
 *   - "send": pick a template, interpolate variables, send via WA
 *   - "classify": wait for pharmacy response, classify it with Haiku
 *   - "complete": send thank-you + mark conversation completed
 *   - "fail": mark conversation failed
 */

// ─── Node types ────────────────────────────────────────

export interface SendNode {
  type: "send";
  phase: "phase1" | "phase2";
  /** Array of template variants — one is picked at random */
  templates: string[];
  /** Next node id after sending */
  next: string;
}

export interface ClassifyNode {
  type: "classify";
  /** Timeout in ms before advancing to timeoutTarget */
  timeoutMs: number;
  /** Classification branches */
  branches: ClassifyBranch[];
  /** Node to advance to if timeout */
  timeoutTarget: string;
}

export interface ClassifyBranch {
  /** Machine-readable category id */
  category: string;
  /** Human-readable description for Haiku */
  description: string;
  /** Target node id */
  target: string;
}

export interface CompleteNode {
  type: "complete";
  /** Optional thank-you templates */
  thankYouTemplates?: string[];
}

export interface FailNode {
  type: "fail";
  reason: string;
}

export type FlowNode = SendNode | ClassifyNode | CompleteNode | FailNode;

// ─── Tree structure ────────────────────────────────────

export interface FlowTree {
  nodes: Record<string, FlowNode>;
}

// ─── Template variables ────────────────────────────────

export interface TemplateVariables {
  product_name: string;
  active_ingredient: string;
  presentation: string;
  pharmacy_name: string;
  persona_name: string;
  cpf: string;
  /** Custom variables set during calibration */
  [key: string]: string;
}

// ─── Calibration diff ──────────────────────────────────

export interface CalibrationDiff {
  /** nodeId → array of template changes */
  [nodeId: string]: TemplateDiff[];
}

export interface TemplateDiff {
  /** Index within the node's templates array */
  templateIndex: number;
  original: string;
  calibrated: string;
}

// ─── Classifier result ─────────────────────────────────

export interface ClassificationResult {
  category: string;
  confidence: number;
}

// ─── Quick parse (shopper-level) ───────────────────────

export interface QuickParseResult {
  needsFollowUp: boolean;
  cpfRequested: boolean;
  hasAlternatives: boolean;
  shouldTransitionPhase: boolean;
  briefSummary: string;
}

// ─── Deep analysis (analyst-level) ─────────────────────

export interface AnalyzedProduct {
  productName: string;
  brand: string | null;
  price: number | null;
  availability: "in_stock" | "out_of_stock" | "on_order" | "unknown";
  isGeneric: boolean;
  mentionOrder: number;
  mentionContext: "spontaneous" | "prompted" | "requested";
  mentionPhase: "phase1" | "phase2";
  rawQuote: string | null;
  dosage: string | null;
  quantity: string | null;
  presentation: string | null;
  activeIngredient: string | null;
  notes: string | null;
}

export interface SubstitutionBehavior {
  spontaneous: boolean;
  eagerness: "high" | "medium" | "low" | "none";
  details: string | null;
}

export interface ConversationInsights {
  clerkKnowledge: "high" | "medium" | "low" | "unknown";
  discountMentioned: boolean;
  helpfulness: "high" | "medium" | "low" | "unknown";
  notes: string | null;
}

export interface DeepAnalysisResult {
  products: AnalyzedProduct[];
  substitutionBehavior: SubstitutionBehavior;
  conversationInsights: ConversationInsights;
  dataCompleteness: {
    score: number;
    missingFields: string[];
  };
}

// ─── Monitor result ────────────────────────────────────

export interface HealthIssue {
  type: "bot_detected" | "stuck" | "confused" | "off_topic" | "hostile" | "other";
  description: string;
  severity: "warning" | "critical";
}

export interface MonitorResult {
  status: "healthy" | "warning" | "critical";
  issues: HealthIssue[];
  recommendedAction: "none" | "flag" | "pause";
}

// ─── Chat result ───────────────────────────────────────

export interface ChatChange {
  nodeId: string;
  changeType: "template_modified" | "node_added" | "node_removed" | "branch_modified";
  description: string;
  before?: string;
  after?: string;
}

export interface ChatResult {
  response: string;
  appliedChanges: ChatChange[] | null;
  modifiedTree: FlowTree | null;
}
