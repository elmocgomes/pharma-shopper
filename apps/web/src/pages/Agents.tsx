import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bot, Save, Settings2, Cpu, Eye, Activity } from "lucide-react";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

interface AgentConfig {
  id: string;
  agentType: string;
  displayName: string;
  description: string | null;
  systemPrompt: string;
  model: string;
  maxTokens: number;
  toolSchemas: unknown[];
  isActive: boolean;
  config: Record<string, unknown> | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

const agentIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  classifier: Cpu,
  analyst: Eye,
  calibrator: Settings2,
  monitor: Activity,
};

const agentDescriptions: Record<string, string> = {
  classifier: "Classifica respostas das farmacias para navegar a arvore de decisao (Haiku, ~$0.0001/chamada)",
  analyst: "Analise profunda pos-conclusao: produtos alternativos, comportamento de substituicao, insights (Sonnet)",
  calibrator: "Adapta templates base para produtos/terapia especificos de cada campanha (Sonnet, unico por campanha)",
  monitor: "Monitora conversas em tempo real, detecta anomalias, pausa criticas (Haiku, periodico)",
};

export function AgentsPage() {
  const qc = useQueryClient();
  const [editingType, setEditingType] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["agents"],
    queryFn: () => api.get<{ data: AgentConfig[] }>("/agents"),
  });

  const agents = data?.data ?? [];
  const editing = agents.find((a) => a.agentType === editingType);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Agentes IA</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure os agentes de IA: prompts, modelos e parametros
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Carregando...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {agents.map((agent) => {
            const Icon = agentIcons[agent.agentType] ?? Bot;
            return (
              <div
                key={agent.id}
                className={cn(
                  "bg-white rounded-xl border p-5 cursor-pointer transition-all",
                  editingType === agent.agentType
                    ? "border-green-500 ring-2 ring-green-100"
                    : "border-gray-200 hover:border-gray-300",
                )}
                onClick={() => setEditingType(agent.agentType)}
              >
                <div className="flex items-start gap-3">
                  <div className={cn("p-2 rounded-lg", agent.isActive ? "bg-green-50" : "bg-gray-50")}>
                    <Icon className={cn("w-5 h-5", agent.isActive ? "text-green-600" : "text-gray-400")} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{agent.displayName}</h3>
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-medium",
                        agent.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500",
                      )}>
                        {agent.isActive ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {agentDescriptions[agent.agentType] ?? agent.description ?? ""}
                    </p>
                    <div className="flex gap-3 mt-2 text-[11px] text-gray-400">
                      <span>Modelo: {agent.model}</span>
                      <span>Max tokens: {agent.maxTokens}</span>
                      <span>v{agent.version}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <AgentEditor
          agent={editing}
          onClose={() => setEditingType(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["agents"] });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
          }}
          saved={saved}
        />
      )}
    </div>
  );
}

function AgentEditor({
  agent,
  onClose,
  onSaved,
  saved,
}: {
  agent: AgentConfig;
  onClose: () => void;
  onSaved: () => void;
  saved: boolean;
}) {
  const [systemPrompt, setSystemPrompt] = useState(agent.systemPrompt);
  const [model, setModel] = useState(agent.model);
  const [maxTokens, setMaxTokens] = useState(agent.maxTokens);
  const [isActive, setIsActive] = useState(agent.isActive);

  // Reset form when agent changes
  useEffect(() => {
    setSystemPrompt(agent.systemPrompt);
    setModel(agent.model);
    setMaxTokens(agent.maxTokens);
    setIsActive(agent.isActive);
  }, [agent.agentType]);

  const saveMut = useMutation({
    mutationFn: (body: { systemPrompt: string; model: string; maxTokens: number; isActive: boolean }) =>
      api.put(`/agents/${agent.agentType}`, body),
    onSuccess: onSaved,
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Editar: {agent.displayName}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Fechar
          </button>
          <button
            onClick={() => saveMut.mutate({ systemPrompt, model, maxTokens, isActive })}
            disabled={saveMut.isPending}
            className={cn(
              "flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
              saved ? "bg-green-100 text-green-700" : "bg-green-600 text-white hover:bg-green-700",
            )}
          >
            <Save className="w-3.5 h-3.5" />
            {saved ? "Salvo!" : saveMut.isPending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Modelo</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
            <option value="claude-haiku-4-20250514">Claude Haiku 4</option>
            <option value="claude-haiku-3-5-20241022">Claude Haiku 3.5</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Max Tokens</label>
          <input
            type="number"
            value={maxTokens}
            onChange={(e) => setMaxTokens(Number(e.target.value))}
            min={50}
            max={4096}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
            Ativo
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">System Prompt</label>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={12}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {saveMut.isError && (
        <p className="text-red-500 text-sm">{(saveMut.error as Error).message}</p>
      )}
    </div>
  );
}
