import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Play,
  Pause,
  Square,
  RotateCw,
  ChevronRight,
  Trash2,
  Eye,
} from "lucide-react";
import { api } from "../lib/api";
import { cn } from "../lib/utils";
import { CampaignTemplatesTab } from "../components/CampaignTemplatesTab";
import { CampaignChatTab } from "../components/CampaignChatTab";
import { CampaignHealthTab } from "../components/CampaignHealthTab";

interface Campaign {
  id: string;
  name: string;
  status: "draft" | "scheduled" | "running" | "paused" | "completed" | "cancelled";
  targetStates: string[];
  rateLimitPerHour: number;
  businessHoursStart: string | null;
  businessHoursEnd: string | null;
  createdAt: string;
  stats: { total: number; completed: number; failed: number; productCount: number; pharmacyCount: number };
}

interface Product { id: string; name: string; activeIngredient: string | null; isGeneric: boolean; }
interface Pharmacy { id: string; name: string; whatsappNumber: string; city: string | null; state: string | null; }

interface ConvRow {
  id: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  pharmacy: { name: string; city: string | null; state: string | null; whatsappNumber: string };
}

interface CampaignDetail extends Campaign {
  products: Product[];
  pharmacies: Pharmacy[];
  conversationStats: { status: string; count: number }[];
  stateStats: { state: string | null; total: number; completed: number }[];
}

const BR_STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
] as const;

const statusConfig: Record<string, { bg: string; label: string }> = {
  draft: { bg: "bg-gray-100 text-gray-600", label: "Rascunho" },
  scheduled: { bg: "bg-blue-100 text-blue-700", label: "Agendada" },
  running: { bg: "bg-green-100 text-green-700", label: "Em Execução" },
  paused: { bg: "bg-yellow-100 text-yellow-700", label: "Pausada" },
  completed: { bg: "bg-emerald-100 text-emerald-700", label: "Concluída" },
  cancelled: { bg: "bg-red-100 text-red-700", label: "Cancelada" },
};

export function CampaignsPage() {
  const [view, setView] = useState<"list" | "create" | "detail">("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (view === "create") {
    return <CreateCampaign onBack={() => setView("list")} />;
  }
  if (view === "detail" && selectedId) {
    return <CampaignDetail id={selectedId} onBack={() => setView("list")} />;
  }
  return (
    <CampaignList
      onCreate={() => setView("create")}
      onSelect={(id) => { setSelectedId(id); setView("detail"); }}
    />
  );
}

function CampaignList({ onCreate, onSelect }: { onCreate: () => void; onSelect: (id: string) => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => api.get<{ data: Campaign[] }>("/campaigns"),
  });

  const actionMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      api.post(`/campaigns/${id}/${action}`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/campaigns/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });

  const campaigns = data?.data ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campanhas</h1>
          <p className="text-sm text-gray-500 mt-1">Gerencie campanhas de pesquisa de preços</p>
        </div>
        <button onClick={onCreate} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium">
          <Plus className="w-4 h-4" />
          Nova Campanha
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Carregando...</div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Nenhuma campanha criada</div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => {
            const progress = c.stats.total > 0 ? Math.round(((c.stats.completed + c.stats.failed) / c.stats.total) * 100) : 0;
            return (
              <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">{c.name}</h3>
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", statusConfig[c.status]?.bg)}>
                        {statusConfig[c.status]?.label}
                      </span>
                    </div>
                    <div className="flex gap-4 text-xs text-gray-500">
                      <span>{c.stats.pharmacyCount} farmácias</span>
                      <span>{c.stats.productCount} produtos</span>
                      {c.targetStates.length > 0 && <span>{c.targetStates.join(", ")}</span>}
                    </div>
                    {c.stats.total > 0 && (
                      <div className="mt-2 flex items-center gap-3">
                        <div className="flex-1 bg-gray-100 rounded-full h-2 max-w-xs">
                          <div
                            className="bg-green-500 h-2 rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">
                          {c.stats.completed}/{c.stats.total} ({progress}%)
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    {c.status === "draft" && (
                      <button onClick={() => actionMut.mutate({ id: c.id, action: "start" })} className="p-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors" title="Iniciar">
                        <Play className="w-4 h-4" />
                      </button>
                    )}
                    {c.status === "running" && (
                      <button onClick={() => actionMut.mutate({ id: c.id, action: "pause" })} className="p-2 bg-yellow-50 text-yellow-700 rounded-lg hover:bg-yellow-100 transition-colors" title="Pausar">
                        <Pause className="w-4 h-4" />
                      </button>
                    )}
                    {c.status === "paused" && (
                      <button onClick={() => actionMut.mutate({ id: c.id, action: "resume" })} className="p-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors" title="Retomar">
                        <RotateCw className="w-4 h-4" />
                      </button>
                    )}
                    {["running", "paused"].includes(c.status) && (
                      <button onClick={() => actionMut.mutate({ id: c.id, action: "cancel" })} className="p-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors" title="Cancelar">
                        <Square className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => onSelect(c.id)} className="p-2 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors" title="Detalhes">
                      <Eye className="w-4 h-4" />
                    </button>
                    {c.status === "draft" && (
                      <button onClick={() => deleteMut.mutate(c.id)} className="p-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors" title="Excluir">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CreateCampaign({ onBack }: { onBack: () => void }) {
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [targetStates, setTargetStates] = useState<string[]>([]);
  const [rateLimitPerHour, setRateLimitPerHour] = useState(10);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedPharmacies, setSelectedPharmacies] = useState<string[]>([]);

  const { data: productsData } = useQuery({
    queryKey: ["products", 1, "", "", ""],
    queryFn: () => api.get<{ data: Product[] }>("/products?limit=100"),
  });
  const { data: pharmaciesData } = useQuery({
    queryKey: ["pharmacies", 1, "", ""],
    queryFn: () => api.get<{ data: Pharmacy[] }>("/pharmacies?limit=100"),
  });

  const createMut = useMutation({
    mutationFn: (body: unknown) => api.post<{ data: Campaign }>("/campaigns", body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["campaigns"] }); onBack(); },
  });

  const allProducts = productsData?.data ?? [];
  const allPharmacies = pharmaciesData?.data ?? [];
  const filteredPharmacies = targetStates.length > 0
    ? allPharmacies.filter((p) => p.state && targetStates.includes(p.state))
    : allPharmacies;

  const steps = ["Informações", "Produtos", "Farmácias", "Revisar"];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-700">← Voltar</button>
        <h1 className="text-2xl font-bold text-gray-900">Nova Campanha</h1>
      </div>

      {/* Step indicator */}
      <div className="flex gap-2">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
              i <= step ? "bg-green-600 text-white" : "bg-gray-200 text-gray-500",
            )}>
              {i + 1}
            </div>
            <span className={cn("text-sm", i <= step ? "text-gray-900 font-medium" : "text-gray-400")}>{s}</span>
            {i < steps.length - 1 && <ChevronRight className="w-4 h-4 text-gray-300" />}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {step === 0 && (
          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Campanha</label>
              <input type="text" value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} placeholder="Ex: Pesquisa Losartana SP/RJ" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estados Alvo</label>
              <div className="flex flex-wrap gap-2">
                {BR_STATES.map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setTargetStates((prev) => prev.includes(st) ? prev.filter((s) => s !== st) : [...prev, st])}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                      targetStates.includes(st) ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500 hover:bg-gray-200",
                    )}
                  >
                    {st}
                  </button>
                ))}
              </div>
              {targetStates.length === 0 && <p className="text-xs text-gray-400 mt-1">Nenhum filtro = todas as farmácias</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Limite por hora</label>
              <input type="number" value={rateLimitPerHour} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRateLimitPerHour(Number(e.target.value))} min={1} max={100} className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500" />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 mb-2">Selecione os produtos para pesquisar ({selectedProducts.length} selecionados)</p>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {allProducts.map((p) => (
                <label key={p.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedProducts.includes(p.id)}
                    onChange={() => setSelectedProducts((prev) => prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id])}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.activeIngredient || ""} {p.isGeneric ? "· Genérico" : ""}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-500">{selectedPharmacies.length} de {filteredPharmacies.length} farmácias selecionadas</p>
              <button
                type="button"
                onClick={() => setSelectedPharmacies(
                  selectedPharmacies.length === filteredPharmacies.length ? [] : filteredPharmacies.map((p) => p.id),
                )}
                className="text-xs text-green-600 hover:text-green-700 font-medium"
              >
                {selectedPharmacies.length === filteredPharmacies.length ? "Desmarcar Todas" : "Selecionar Todas"}
              </button>
            </div>
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {filteredPharmacies.map((p) => (
                <label key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedPharmacies.includes(p.id)}
                    onChange={() => setSelectedPharmacies((prev) => prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id])}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-gray-900">{p.name}</span>
                    <span className="text-xs text-gray-400 ml-2">{p.city}/{p.state}</span>
                  </div>
                  <span className="text-xs text-gray-400">{p.whatsappNumber}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700">Resumo</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-500">Campanha</p>
                <p className="font-semibold text-gray-900">{name}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-500">Estados</p>
                <p className="font-semibold text-gray-900">{targetStates.length > 0 ? targetStates.join(", ") : "Todos"}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-500">Produtos</p>
                <p className="font-semibold text-gray-900">{selectedProducts.length}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-500">Farmácias</p>
                <p className="font-semibold text-gray-900">{selectedPharmacies.length}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-500">Limite/hora</p>
                <p className="font-semibold text-gray-900">{rateLimitPerHour}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        {step > 0 && (
          <button onClick={() => setStep(step - 1)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
            Anterior
          </button>
        )}
        <div className="flex-1" />
        {step < 3 ? (
          <button
            onClick={() => setStep(step + 1)}
            disabled={
              (step === 0 && !name) ||
              (step === 1 && selectedProducts.length === 0) ||
              (step === 2 && selectedPharmacies.length === 0)
            }
            className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            Próximo
          </button>
        ) : (
          <button
            onClick={() => createMut.mutate({
              name,
              targetStates,
              rateLimitPerHour,
              productIds: selectedProducts,
              pharmacyIds: selectedPharmacies,
            })}
            disabled={createMut.isPending}
            className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {createMut.isPending ? "Criando..." : "Criar Campanha"}
          </button>
        )}
      </div>
    </div>
  );
}

function CampaignDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [convPage, setConvPage] = useState(1);
  const [activeTab, setActiveTab] = useState<"overview" | "templates" | "chat" | "health">("overview");

  const { data } = useQuery({
    queryKey: ["campaign", id],
    queryFn: () => api.get<{ data: CampaignDetail }>(`/campaigns/${id}`),
    refetchInterval: 10_000,
  });

  const { data: convsData } = useQuery({
    queryKey: ["campaign-convs", id, convPage],
    queryFn: () => api.get<{ data: ConvRow[]; total: number }>(`/campaigns/${id}/conversations?page=${convPage}&limit=20`),
    refetchInterval: 10_000,
  });

  const actionMut = useMutation({
    mutationFn: (action: string) => api.post(`/campaigns/${id}/${action}`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaign", id] }),
  });

  const deleteMut = useMutation({
    mutationFn: () => api.delete(`/campaigns/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["campaigns"] }); onBack(); },
  });

  const camp = data?.data;
  const convs = convsData?.data ?? [];
  const convTotal = convsData?.total ?? 0;

  if (!camp) return <div className="p-6 text-gray-400">Carregando...</div>;

  const totalConvs = camp.conversationStats.reduce((s, c) => s + c.count, 0);
  const completedConvs = camp.conversationStats.find((c) => c.status === "completed")?.count ?? 0;
  const progress = totalConvs > 0 ? Math.round((completedConvs / totalConvs) * 100) : 0;

  const convStatusColors: Record<string, string> = {
    pending: "bg-gray-100 text-gray-600",
    initial: "bg-blue-100 text-blue-600",
    awaiting_response: "bg-yellow-100 text-yellow-700",
    parsing: "bg-purple-100 text-purple-700",
    follow_up: "bg-orange-100 text-orange-700",
    completed: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
    timeout: "bg-gray-200 text-gray-600",
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-700">← Voltar</button>
        <h1 className="text-2xl font-bold text-gray-900">{camp.name}</h1>
        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", statusConfig[camp.status]?.bg)}>
          {statusConfig[camp.status]?.label}
        </span>
        <div className="flex-1" />
        {camp.status === "draft" && (
          <button onClick={() => actionMut.mutate("start")} className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
            <Play className="w-4 h-4" /> Iniciar
          </button>
        )}
        {camp.status === "running" && (
          <button onClick={() => actionMut.mutate("pause")} className="flex items-center gap-1 px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600">
            <Pause className="w-4 h-4" /> Pausar
          </button>
        )}
        {camp.status === "paused" && (
          <button onClick={() => actionMut.mutate("resume")} className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
            <RotateCw className="w-4 h-4" /> Retomar
          </button>
        )}
        <button
          onClick={() => { if (confirm("Tem certeza que deseja excluir esta campanha?")) deleteMut.mutate(); }}
          disabled={deleteMut.isPending}
          className="flex items-center gap-1 px-4 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" /> Excluir
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Conversas</p>
          <p className="text-2xl font-bold text-gray-900">{totalConvs}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Concluídas</p>
          <p className="text-2xl font-bold text-green-600">{completedConvs}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Progresso</p>
          <p className="text-2xl font-bold text-gray-900">{progress}%</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Produtos</p>
          <p className="text-2xl font-bold text-gray-900">{camp.products.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl border border-gray-200 p-1">
        {(["overview", "templates", "chat", "health"] as const).map((tab) => {
          const labels: Record<string, string> = { overview: "Visao Geral", templates: "Templates", chat: "Chat IA", health: "Saude" };
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                activeTab === tab
                  ? "bg-green-50 text-green-700"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50",
              )}
            >
              {labels[tab]}
            </button>
          );
        })}
      </div>

      {activeTab === "templates" && <CampaignTemplatesTab campaignId={id} />}
      {activeTab === "chat" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <CampaignChatTab campaignId={id} />
        </div>
      )}
      {activeTab === "health" && <CampaignHealthTab campaignId={id} />}

      {activeTab === "overview" && <>
      {/* Progress bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-700">Progresso Geral</h3>
          <span className="text-xs text-gray-500">{completedConvs}/{totalConvs}</span>
        </div>
        <div className="bg-gray-100 rounded-full h-3">
          <div className="bg-green-500 h-3 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Per-state stats */}
      {camp.stateStats.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Progresso por Estado</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {camp.stateStats.map((s) => {
              const pct = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
              return (
                <div key={s.state || "other"} className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-600 w-6">{s.state || "—"}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-gray-400">{s.completed}/{s.total}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Conversation status breakdown */}
      {camp.conversationStats.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Status das Conversas</h3>
          <div className="flex flex-wrap gap-2">
            {camp.conversationStats.map((s) => (
              <span key={s.status} className={cn("px-3 py-1 rounded-full text-xs font-medium", convStatusColors[s.status] || "bg-gray-100 text-gray-600")}>
                {s.status}: {s.count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Conversations table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-medium text-gray-700">Conversas ({convTotal})</h3>
        </div>
        {convs.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">Nenhuma conversa iniciada</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-2">Farmácia</th>
                <th className="px-4 py-2">Cidade/UF</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Início</th>
                <th className="px-4 py-2">Fim</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {convs.map((cv) => (
                <tr key={cv.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => nav(`/conversations/${cv.id}`)}>
                  <td className="px-4 py-2 font-medium text-gray-900">{cv.pharmacy.name}</td>
                  <td className="px-4 py-2 text-gray-600">{cv.pharmacy.city}/{cv.pharmacy.state}</td>
                  <td className="px-4 py-2">
                    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", convStatusColors[cv.status] || "bg-gray-100")}>
                      {cv.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{cv.startedAt ? new Date(cv.startedAt).toLocaleString("pt-BR") : "—"}</td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{cv.completedAt ? new Date(cv.completedAt).toLocaleString("pt-BR") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      </>}
    </div>
  );
}
