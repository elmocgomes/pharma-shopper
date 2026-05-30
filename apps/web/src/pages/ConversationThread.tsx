import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, User, Bot, Clock, DollarSign, Package, Layers, ArrowRightLeft,
  BarChart3, List, RotateCw, ChevronDown, ChevronRight, Activity,
} from "lucide-react";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

interface Message {
  id: string;
  direction: "outbound" | "inbound";
  contentType: string;
  content: string | null;
  aiGenerated: string | null;
  sentAt: string | null;
  parsedData: unknown | null;
}

interface ConversationData {
  id: string;
  status: string;
  phase: string | null;
  spontaneousSubstitution: boolean | null;
  startedAt: string | null;
  completedAt: string | null;
  retryCount: number;
  pharmacy: { name: string; city: string | null; state: string | null; whatsappNumber: string };
  persona: { name: string; communicationStyle: string; occupation: string | null } | null;
}

interface PriceRecord {
  id: string;
  price: string | null;
  availability: string;
  brand: string | null;
  isGeneric: boolean;
  substitutionType: string | null;
  dosage: string | null;
  quantity: string | null;
  presentation: string | null;
  conversationPhase: string | null;
  notes: string | null;
  product: { name: string; activeIngredient: string | null };
}

const phaseLabels: Record<string, string> = {
  phase1_branded: "Fase 1 — Produto de marca",
  phase2_alternatives: "Fase 2 — Genéricos/Alternativas",
};

const substitutionLabels: Record<string, string> = {
  requested: "Solicitado",
  spontaneous: "Espontâneo",
  prompted: "Provocado",
  not_offered: "Não oferecido",
};

const substitutionColors: Record<string, string> = {
  requested: "bg-blue-100 text-blue-700",
  spontaneous: "bg-emerald-100 text-emerald-700",
  prompted: "bg-amber-100 text-amber-700",
  not_offered: "bg-gray-100 text-gray-600",
};

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  initial: "Inicial",
  awaiting_response: "Aguardando Resposta",
  parsing: "Processando",
  follow_up: "Follow-up",
  completed: "Concluida",
  failed: "Falha",
  timeout: "Timeout",
};

const statusColors: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  initial: "bg-blue-100 text-blue-600",
  awaiting_response: "bg-yellow-100 text-yellow-700",
  parsing: "bg-purple-100 text-purple-700",
  follow_up: "bg-orange-100 text-orange-700",
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  timeout: "bg-gray-200 text-gray-600",
};

const availLabels: Record<string, string> = {
  in_stock: "Em estoque",
  out_of_stock: "Em falta",
  on_order: "Sob encomenda",
  unknown: "Desconhecido",
};

interface Analysis {
  id: string;
  conversationId: string;
  agentType: string;
  schemaVersion: number;
  analysisData: {
    products?: { productName: string; mentionOrder: number; rawQuote?: string; mentionContext?: string; price?: number; availability?: string; isGeneric?: boolean }[];
    substitutionBehavior?: { spontaneous: boolean; eagerness: string; notes?: string };
    conversationInsights?: { clerkKnowledge?: string; discountBehavior?: string; helpfulness?: string; notes?: string };
    dataCompleteness?: { score: number; missingFields?: string[] };
  } | null;
  status: string;
  triggeredBy: string;
  processedAt: string | null;
}

interface AlternativeProduct {
  id: string;
  productName: string;
  brand: string | null;
  price: string | null;
  availability: string | null;
  isGeneric: boolean;
  mentionOrder: number;
  mentionContext: string | null;
  mentionPhase: string | null;
  rawQuote: string | null;
  activeIngredient: string | null;
}

interface ConversationEvent {
  id: string;
  eventType: string;
  eventData: Record<string, unknown> | null;
  agentId: string | null;
  sequenceNumber: number;
  createdAt: string;
}

export function ConversationThreadPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showEvents, setShowEvents] = useState(false);

  const { data: convData } = useQuery({
    queryKey: ["conversation", id],
    queryFn: () => api.get<{ data: ConversationData }>(`/conversations/${id}`),
    enabled: !!id,
  });

  const { data: msgsData } = useQuery({
    queryKey: ["conversation-messages", id],
    queryFn: () => api.get<{ data: Message[] }>(`/conversations/${id}/messages`),
    enabled: !!id,
    refetchInterval: 5_000,
  });

  const { data: pricesData } = useQuery({
    queryKey: ["conversation-prices", id],
    queryFn: () => api.get<{ data: PriceRecord[] }>(`/conversations/${id}/prices`),
    enabled: !!id,
  });

  const { data: analysesData } = useQuery({
    queryKey: ["conversation-analyses", id],
    queryFn: () => api.get<{ data: Analysis[] }>(`/conversations/${id}/analyses`),
    enabled: !!id,
  });

  const { data: altsData } = useQuery({
    queryKey: ["conversation-alternatives", id],
    queryFn: () => api.get<{ data: AlternativeProduct[] }>(`/conversations/${id}/alternatives`),
    enabled: !!id,
  });

  const { data: eventsData } = useQuery({
    queryKey: ["conversation-events", id],
    queryFn: () => api.get<{ data: ConversationEvent[] }>(`/conversations/${id}/events`),
    enabled: !!id && showEvents,
  });

  const reanalyzeMut = useMutation({
    mutationFn: () => api.post(`/conversations/${id}/reanalyze`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversation-analyses", id] });
      qc.invalidateQueries({ queryKey: ["conversation-alternatives", id] });
    },
  });

  const conv = convData?.data;
  const msgs = msgsData?.data ?? [];
  const prices = pricesData?.data ?? [];
  const analyses = analysesData?.data ?? [];
  const alternatives = altsData?.data ?? [];
  const events = eventsData?.data ?? [];

  if (!conv) return <div className="p-6 text-gray-400">Carregando...</div>;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-gray-900">{conv.pharmacy.name}</h1>
            <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", statusColors[conv.status])}>
              {statusLabels[conv.status] || conv.status}
            </span>
          </div>
          <p className="text-xs text-gray-500">
            {conv.pharmacy.city}/{conv.pharmacy.state} - {conv.pharmacy.whatsappNumber}
          </p>
        </div>
        {conv.persona && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg">
            <User className="w-3.5 h-3.5 text-blue-600" />
            <div>
              <p className="text-xs font-medium text-blue-700">{conv.persona.name}</p>
              <p className="text-xs text-blue-500">{conv.persona.communicationStyle} - {conv.persona.occupation}</p>
            </div>
          </div>
        )}
      </div>

      {/* Phase & Substitution Info */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {conv.startedAt && <span>Inicio: {new Date(conv.startedAt).toLocaleString("pt-BR")}</span>}
          {conv.completedAt && <span>- Fim: {new Date(conv.completedAt).toLocaleString("pt-BR")}</span>}
        </div>
        {conv.phase && (
          <div className="flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full">
            <Layers className="w-3 h-3" />
            {phaseLabels[conv.phase] || conv.phase}
          </div>
        )}
        {conv.spontaneousSubstitution !== null && (
          <div className={cn(
            "flex items-center gap-1 px-2 py-0.5 rounded-full",
            conv.spontaneousSubstitution ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600",
          )}>
            <ArrowRightLeft className="w-3 h-3" />
            {conv.spontaneousSubstitution
              ? "Substituição espontânea detectada"
              : "Sem substituição espontânea"}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="bg-gray-100 rounded-xl p-4 space-y-3 min-h-[300px]">
        {msgs.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-8">Nenhuma mensagem</p>
        ) : (
          msgs.map((msg) => (
            <div key={msg.id} className={cn("flex", msg.direction === "outbound" ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[75%] rounded-xl px-4 py-2.5 shadow-sm",
                msg.direction === "outbound"
                  ? "bg-green-500 text-white rounded-br-sm"
                  : "bg-white text-gray-900 rounded-bl-sm",
              )}>
                <div className="flex items-center gap-1.5 mb-1">
                  {msg.direction === "outbound" ? (
                    <Bot className="w-3 h-3 opacity-70" />
                  ) : (
                    <User className="w-3 h-3 text-gray-400" />
                  )}
                  <span className={cn("text-xs", msg.direction === "outbound" ? "text-green-100" : "text-gray-400")}>
                    {msg.direction === "outbound" ? "Enviado" : "Recebido"}
                    {msg.aiGenerated === "true" && " (AI)"}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                {msg.sentAt && (
                  <p className={cn("text-xs mt-1", msg.direction === "outbound" ? "text-green-200" : "text-gray-400")}>
                    {new Date(msg.sentAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Extracted Prices */}
      {prices.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="w-4 h-4 text-green-600" />
            <h3 className="text-sm font-medium text-gray-700">Precos Extraidos</h3>
          </div>
          <div className="space-y-2">
            {prices.map((pr) => (
              <div key={pr.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Package className="w-4 h-4 text-gray-400" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{pr.product.name}</p>
                    {pr.substitutionType && (
                      <span className={cn("px-1.5 py-0.5 rounded text-xs font-medium", substitutionColors[pr.substitutionType] || "bg-gray-100 text-gray-600")}>
                        {substitutionLabels[pr.substitutionType] || pr.substitutionType}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {pr.product.activeIngredient}
                    {pr.brand && ` - ${pr.brand}`}
                    {pr.isGeneric && " (Genérico)"}
                  </p>
                  {(pr.dosage || pr.quantity || pr.presentation) && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {[pr.dosage, pr.presentation, pr.quantity].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {pr.notes && (
                    <p className="text-xs text-gray-400 mt-0.5 italic">{pr.notes}</p>
                  )}
                </div>
                <div className="text-right">
                  {pr.price ? (
                    <p className="text-sm font-bold text-green-700">R$ {Number(pr.price).toFixed(2).replace(".", ",")}</p>
                  ) : (
                    <p className="text-xs text-gray-400">Sem preço</p>
                  )}
                  <p className="text-xs text-gray-500">{availLabels[pr.availability] || pr.availability}</p>
                  {pr.conversationPhase && (
                    <p className="text-xs text-gray-400">
                      {pr.conversationPhase === "phase1_branded" ? "Fase 1" : "Fase 2"}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alternative Products */}
      {alternatives.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <ArrowRightLeft className="w-4 h-4 text-purple-600" />
            <h3 className="text-sm font-medium text-gray-700">Produtos Alternativos Mencionados</h3>
          </div>
          <div className="space-y-2">
            {alternatives.map((alt) => (
              <div key={alt.id} className="flex items-start gap-3 p-3 bg-purple-50/50 rounded-lg">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center">
                  {alt.mentionOrder}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{alt.productName}</p>
                    {alt.isGeneric && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-100 text-blue-700">Generico</span>
                    )}
                    {alt.mentionContext && (
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-[10px]",
                        alt.mentionContext === "spontaneous" ? "bg-emerald-100 text-emerald-700" :
                        alt.mentionContext === "prompted" ? "bg-amber-100 text-amber-700" :
                        "bg-gray-100 text-gray-600",
                      )}>
                        {alt.mentionContext === "spontaneous" ? "Espontaneo" :
                         alt.mentionContext === "prompted" ? "Provocado" : "Solicitado"}
                      </span>
                    )}
                  </div>
                  {alt.brand && <p className="text-xs text-gray-500">{alt.brand}</p>}
                  {alt.activeIngredient && <p className="text-xs text-gray-400">{alt.activeIngredient}</p>}
                  {alt.rawQuote && (
                    <p className="text-xs text-gray-500 italic mt-1 border-l-2 border-purple-200 pl-2">
                      "{alt.rawQuote}"
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  {alt.price ? (
                    <p className="text-sm font-bold text-green-700">R$ {Number(alt.price).toFixed(2).replace(".", ",")}</p>
                  ) : (
                    <p className="text-xs text-gray-400">Sem preco</p>
                  )}
                  {alt.availability && (
                    <p className="text-xs text-gray-500">{availLabels[alt.availability] ?? alt.availability}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Analysis Panel */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-medium text-gray-700">Analise IA</h3>
            {analyses.length > 0 && (
              <span className={cn(
                "px-1.5 py-0.5 rounded text-[10px] font-medium",
                analyses[0].status === "completed" ? "bg-green-100 text-green-700" :
                analyses[0].status === "processing" ? "bg-blue-100 text-blue-700" :
                analyses[0].status === "failed" ? "bg-red-100 text-red-700" :
                "bg-gray-100 text-gray-600",
              )}>
                {analyses[0].status}
              </span>
            )}
          </div>
          <button
            onClick={() => reanalyzeMut.mutate()}
            disabled={reanalyzeMut.isPending}
            className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium hover:bg-indigo-100 disabled:opacity-50"
          >
            <RotateCw className={cn("w-3 h-3", reanalyzeMut.isPending && "animate-spin")} />
            Re-analisar
          </button>
        </div>

        {analyses.length === 0 ? (
          <p className="text-gray-400 text-xs">Nenhuma analise disponivel</p>
        ) : (
          <div className="space-y-3">
            {analyses.filter(a => a.status === "completed" && a.analysisData).slice(0, 1).map((analysis) => {
              const d = analysis.analysisData!;
              return (
                <div key={analysis.id} className="space-y-3">
                  {/* Substitution Behavior */}
                  {d.substitutionBehavior && (
                    <div className="p-3 bg-emerald-50/50 rounded-lg">
                      <p className="text-xs font-medium text-gray-700 mb-1">Comportamento de Substituicao</p>
                      <div className="flex gap-3 text-xs">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full",
                          d.substitutionBehavior.spontaneous ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600",
                        )}>
                          {d.substitutionBehavior.spontaneous ? "Espontanea" : "Nao espontanea"}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                          Disposicao: {d.substitutionBehavior.eagerness}
                        </span>
                      </div>
                      {d.substitutionBehavior.notes && (
                        <p className="text-xs text-gray-500 mt-1">{d.substitutionBehavior.notes}</p>
                      )}
                    </div>
                  )}

                  {/* Conversation Insights */}
                  {d.conversationInsights && (
                    <div className="p-3 bg-blue-50/50 rounded-lg">
                      <p className="text-xs font-medium text-gray-700 mb-1">Insights da Conversa</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {d.conversationInsights.clerkKnowledge && (
                          <div><span className="text-gray-500">Conhecimento:</span> <span className="text-gray-700">{d.conversationInsights.clerkKnowledge}</span></div>
                        )}
                        {d.conversationInsights.helpfulness && (
                          <div><span className="text-gray-500">Atendimento:</span> <span className="text-gray-700">{d.conversationInsights.helpfulness}</span></div>
                        )}
                        {d.conversationInsights.discountBehavior && (
                          <div><span className="text-gray-500">Descontos:</span> <span className="text-gray-700">{d.conversationInsights.discountBehavior}</span></div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Data Completeness */}
                  {d.dataCompleteness && (
                    <div className="p-3 bg-amber-50/50 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-medium text-gray-700">Completude dos Dados</p>
                        <span className={cn(
                          "text-sm font-bold",
                          d.dataCompleteness.score >= 80 ? "text-green-600" :
                          d.dataCompleteness.score >= 50 ? "text-amber-600" : "text-red-600",
                        )}>
                          {d.dataCompleteness.score}%
                        </span>
                      </div>
                      <div className="bg-gray-200 rounded-full h-2">
                        <div
                          className={cn(
                            "h-2 rounded-full",
                            d.dataCompleteness.score >= 80 ? "bg-green-500" :
                            d.dataCompleteness.score >= 50 ? "bg-amber-500" : "bg-red-500",
                          )}
                          style={{ width: `${d.dataCompleteness.score}%` }}
                        />
                      </div>
                      {d.dataCompleteness.missingFields && d.dataCompleteness.missingFields.length > 0 && (
                        <p className="text-[10px] text-gray-400 mt-1">
                          Faltando: {d.dataCompleteness.missingFields.join(", ")}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Events Log */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <button
          onClick={() => setShowEvents(!showEvents)}
          className="flex items-center gap-2 w-full"
        >
          {showEvents ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
          <Activity className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-medium text-gray-700">Log de Eventos</h3>
          {events.length > 0 && (
            <span className="text-xs text-gray-400">({events.length})</span>
          )}
        </button>
        {showEvents && (
          <div className="mt-3 space-y-1.5">
            {events.length === 0 ? (
              <p className="text-gray-400 text-xs">Nenhum evento registrado</p>
            ) : (
              events.map((evt) => (
                <div key={evt.id} className="flex items-start gap-2 px-3 py-2 bg-gray-50 rounded-lg text-xs">
                  <span className="text-gray-400 font-mono w-6 text-right flex-shrink-0">
                    #{evt.sequenceNumber}
                  </span>
                  <div className="flex-1">
                    <span className="font-medium text-gray-700">{evt.eventType}</span>
                    {evt.agentId && (
                      <span className="ml-2 px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 text-[10px]">
                        {evt.agentId}
                      </span>
                    )}
                    {evt.eventData && Object.keys(evt.eventData).length > 0 && (
                      <p className="text-gray-400 mt-0.5 truncate">
                        {JSON.stringify(evt.eventData).slice(0, 100)}
                      </p>
                    )}
                  </div>
                  <span className="text-gray-400 flex-shrink-0">
                    {new Date(evt.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
