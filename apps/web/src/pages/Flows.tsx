import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  GitBranch,
  Copy,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  Power,
} from "lucide-react";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

interface FlowNode {
  type: "send" | "classify" | "complete" | "fail";
  phase?: string;
  templates?: string[];
  thankYouTemplates?: string[];
  next?: string;
  timeoutMs?: number;
  branches?: { category: string; description: string; target: string }[];
  reason?: string;
}

interface FlowTree {
  nodes: Record<string, FlowNode>;
}

interface ConversationFlow {
  id: string;
  name: string;
  personaStyle: "formal" | "casual" | "anxious";
  version: number;
  isActive: boolean;
  tree: FlowTree;
  entryNodeId: string;
  variablesSchema: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

const styleLabels: Record<string, { label: string; bg: string }> = {
  formal: { label: "Formal", bg: "bg-blue-100 text-blue-700" },
  casual: { label: "Casual", bg: "bg-green-100 text-green-700" },
  anxious: { label: "Ansioso", bg: "bg-orange-100 text-orange-700" },
};

const nodeTypeLabels: Record<string, { label: string; bg: string }> = {
  send: { label: "Enviar", bg: "bg-blue-50 text-blue-600" },
  classify: { label: "Classificar", bg: "bg-purple-50 text-purple-600" },
  complete: { label: "Concluir", bg: "bg-green-50 text-green-600" },
  fail: { label: "Falha", bg: "bg-red-50 text-red-600" },
};

export function FlowsPage() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  if (creating) {
    return <FlowEditor onBack={() => setCreating(false)} />;
  }
  if (editingId) {
    return <FlowEditor flowId={editingId} onBack={() => setEditingId(null)} />;
  }

  return <FlowList onEdit={setEditingId} onCreate={() => setCreating(true)} />;
}

function FlowList({ onEdit, onCreate }: { onEdit: (id: string) => void; onCreate: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["flows"],
    queryFn: () => api.get<{ data: ConversationFlow[] }>("/flows"),
  });

  const activateMut = useMutation({
    mutationFn: (id: string) => api.post(`/flows/${id}/activate`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["flows"] }),
  });

  const duplicateMut = useMutation({
    mutationFn: (id: string) => api.post(`/flows/${id}/duplicate`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["flows"] }),
  });

  const flows = data?.data ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fluxos de Conversa</h1>
          <p className="text-sm text-gray-500 mt-1">
            Arvores de decisao por estilo de persona (formal/casual/ansioso)
          </p>
        </div>
        <button
          onClick={onCreate}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Novo Fluxo
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Carregando...</div>
      ) : flows.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Nenhum fluxo criado</div>
      ) : (
        <div className="space-y-3">
          {flows.map((flow) => {
            const nodeCount = flow.tree?.nodes ? Object.keys(flow.tree.nodes).length : 0;
            const style = styleLabels[flow.personaStyle] ?? { label: flow.personaStyle, bg: "bg-gray-100 text-gray-600" };
            return (
              <div key={flow.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-purple-50">
                    <GitBranch className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">{flow.name}</h3>
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", style.bg)}>
                        {style.label}
                      </span>
                      {flow.isActive && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                          Ativo
                        </span>
                      )}
                      <span className="text-xs text-gray-400">v{flow.version}</span>
                    </div>
                    <div className="flex gap-4 text-xs text-gray-500">
                      <span>{nodeCount} nos</span>
                      <span>Entrada: {flow.entryNodeId}</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {!flow.isActive && (
                      <button
                        onClick={() => activateMut.mutate(flow.id)}
                        className="p-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
                        title="Ativar"
                      >
                        <Power className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => duplicateMut.mutate(flow.id)}
                      className="p-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                      title="Duplicar"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onEdit(flow.id)}
                      className="p-2 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                      title="Editar"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expandable node list */}
                <FlowNodePreview tree={flow.tree} entryNodeId={flow.entryNodeId} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FlowNodePreview({ tree, entryNodeId }: { tree: FlowTree; entryNodeId: string }) {
  const [expanded, setExpanded] = useState(false);
  const nodes = tree?.nodes ?? {};
  const nodeIds = Object.keys(nodes);

  if (nodeIds.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
      >
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {nodeIds.length} nos no fluxo
      </button>
      {expanded && (
        <div className="mt-2 space-y-1.5">
          {nodeIds.map((nodeId) => {
            const node = nodes[nodeId];
            const nType = nodeTypeLabels[node.type] ?? { label: node.type, bg: "bg-gray-50 text-gray-600" };
            const isEntry = nodeId === entryNodeId;
            return (
              <div
                key={nodeId}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-xs",
                  isEntry ? "bg-yellow-50 border border-yellow-200" : "bg-gray-50",
                )}
              >
                <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", nType.bg)}>
                  {nType.label}
                </span>
                <span className="font-mono text-gray-700">{nodeId}</span>
                {isEntry && <span className="text-yellow-600 text-[10px]">(entrada)</span>}
                {node.type === "send" && node.templates && (
                  <span className="text-gray-400 truncate ml-auto max-w-[200px]">
                    {node.templates.length} template(s)
                  </span>
                )}
                {node.type === "classify" && node.branches && (
                  <span className="text-gray-400 ml-auto">
                    {node.branches.length} ramificacao(oes)
                  </span>
                )}
                {node.next && <span className="text-gray-400 ml-auto">→ {node.next}</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FlowEditor({ flowId, onBack }: { flowId?: string; onBack: () => void }) {
  const qc = useQueryClient();

  const { data: existing } = useQuery({
    queryKey: ["flow", flowId],
    queryFn: () => api.get<{ data: ConversationFlow }>(`/flows/${flowId}`),
    enabled: !!flowId,
  });

  const [name, setName] = useState("");
  const [personaStyle, setPersonaStyle] = useState<"formal" | "casual" | "anxious">("casual");
  const [entryNodeId, setEntryNodeId] = useState("greeting");
  const [treeJson, setTreeJson] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Initialize form when data loads
  if (existing?.data && !initialized) {
    setName(existing.data.name);
    setPersonaStyle(existing.data.personaStyle);
    setEntryNodeId(existing.data.entryNodeId);
    setTreeJson(JSON.stringify(existing.data.tree, null, 2));
    setInitialized(true);
  }

  const saveMut = useMutation({
    mutationFn: (body: { name: string; personaStyle: string; entryNodeId: string; tree: FlowTree }) =>
      flowId ? api.put(`/flows/${flowId}`, body) : api.post("/flows", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flows"] });
      onBack();
    },
  });

  const handleSave = () => {
    try {
      const tree = JSON.parse(treeJson) as FlowTree;
      if (!tree.nodes || typeof tree.nodes !== "object") {
        setJsonError("Tree must have a 'nodes' object");
        return;
      }
      setJsonError(null);
      saveMut.mutate({ name, personaStyle, entryNodeId, tree });
    } catch {
      setJsonError("JSON invalido");
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-700">
          ← Voltar
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          {flowId ? "Editar Fluxo" : "Novo Fluxo"}
        </h1>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Fluxo Casual v1"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estilo</label>
            <select
              value={personaStyle}
              onChange={(e) => setPersonaStyle(e.target.value as "formal" | "casual" | "anxious")}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="casual">Casual</option>
              <option value="formal">Formal</option>
              <option value="anxious">Ansioso</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">No de Entrada</label>
            <input
              type="text"
              value={entryNodeId}
              onChange={(e) => setEntryNodeId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Arvore de Decisao (JSON)
          </label>
          <textarea
            value={treeJson}
            onChange={(e) => { setTreeJson(e.target.value); setJsonError(null); }}
            rows={20}
            className={cn(
              "w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2",
              jsonError ? "border-red-300 focus:ring-red-500" : "border-gray-300 focus:ring-green-500",
            )}
            placeholder='{"nodes": { "greeting": { "type": "send", ... } }}'
          />
          {jsonError && <p className="text-red-500 text-xs mt-1">{jsonError}</p>}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onBack}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!name || !treeJson || saveMut.isPending}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saveMut.isPending ? "Salvando..." : flowId ? "Atualizar" : "Criar"}
          </button>
        </div>
        {saveMut.isError && (
          <p className="text-red-500 text-sm">{(saveMut.error as Error).message}</p>
        )}
      </div>
    </div>
  );
}
