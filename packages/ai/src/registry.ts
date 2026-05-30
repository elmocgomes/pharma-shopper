import { ClassifierAgent } from "./agents/classifier-agent.js";
import { AnalystAgent } from "./agents/analyst-agent.js";
import { CalibratorAgent } from "./agents/calibrator-agent.js";
import { MonitorAgent } from "./agents/monitor-agent.js";
import { ChatAgent } from "./agents/chat-agent.js";

export interface AgentConfigRecord {
  agentType: string;
  model: string;
  maxTokens: number;
  systemPrompt: string | null;
  config: Record<string, unknown> | null;
  isActive: boolean;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Registry for AI agents. Call loadConfigs() with DB results, caches for 5 min.
 * The registry itself has no DB dependency — the caller loads configs and passes them in.
 */
export class AgentRegistry {
  private apiKey: string;
  private configs: Map<string, AgentConfigRecord> = new Map();
  private lastLoad = 0;

  private _classifier: ClassifierAgent | null = null;
  private _analyst: AnalystAgent | null = null;
  private _calibrator: CalibratorAgent | null = null;
  private _monitor: MonitorAgent | null = null;
  private _chat: ChatAgent | null = null;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /** Whether the cache is stale and needs reloading */
  get needsReload(): boolean {
    return Date.now() - this.lastLoad >= CACHE_TTL_MS;
  }

  /**
   * Load agent configs. Call with results from `db.select().from(agentConfigs)`.
   * Clears cached agent instances so they pick up new configs.
   */
  loadConfigs(rows: AgentConfigRecord[]): void {
    this.configs.clear();
    for (const row of rows) {
      this.configs.set(row.agentType, row);
    }
    this.lastLoad = Date.now();

    // Reset cached agents
    this._classifier = null;
    this._analyst = null;
    this._calibrator = null;
    this._monitor = null;
    this._chat = null;
  }

  getClassifier(): ClassifierAgent {
    if (!this._classifier) {
      const cfg = this.configs.get("classifier");
      this._classifier = new ClassifierAgent({
        apiKey: this.apiKey,
        systemPrompt: cfg?.systemPrompt || undefined,
        temperature: (cfg?.config as any)?.temperature ?? 0,
      });
    }
    return this._classifier;
  }

  getAnalyst(): AnalystAgent {
    if (!this._analyst) {
      const cfg = this.configs.get("analyst");
      this._analyst = new AnalystAgent({
        apiKey: this.apiKey,
        model: cfg?.model || "claude-sonnet-4-20250514",
        maxTokens: cfg?.maxTokens || 2048,
        systemPrompt: cfg?.systemPrompt || undefined,
        temperature: (cfg?.config as any)?.temperature ?? 0,
      });
    }
    return this._analyst;
  }

  getCalibrator(): CalibratorAgent {
    if (!this._calibrator) {
      const cfg = this.configs.get("calibrator");
      this._calibrator = new CalibratorAgent({
        apiKey: this.apiKey,
        model: cfg?.model || "claude-sonnet-4-20250514",
        maxTokens: cfg?.maxTokens || 2048,
        systemPrompt: cfg?.systemPrompt || undefined,
        temperature: (cfg?.config as any)?.temperature ?? 0.3,
      });
    }
    return this._calibrator;
  }

  getMonitor(): MonitorAgent {
    if (!this._monitor) {
      const cfg = this.configs.get("monitor");
      this._monitor = new MonitorAgent({
        apiKey: this.apiKey,
        systemPrompt: cfg?.systemPrompt || undefined,
        temperature: (cfg?.config as any)?.temperature ?? 0,
      });
    }
    return this._monitor;
  }

  getChat(): ChatAgent {
    if (!this._chat) {
      this._chat = new ChatAgent({
        apiKey: this.apiKey,
        model: "claude-sonnet-4-20250514",
        maxTokens: 2048,
        temperature: 0.3,
      });
    }
    return this._chat;
  }
}
