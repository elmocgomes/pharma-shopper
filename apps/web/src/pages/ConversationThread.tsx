import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, User, Bot, Clock, DollarSign, Package } from "lucide-react";
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
  notes: string | null;
  product: { name: string; activeIngredient: string | null };
}

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

export function ConversationThreadPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

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

  const conv = convData?.data;
  const msgs = msgsData?.data ?? [];
  const prices = pricesData?.data ?? [];

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

      {/* Timeline */}
      <div className="flex items-center gap-3 text-xs text-gray-500">
        <Clock className="w-3 h-3" />
        {conv.startedAt && <span>Inicio: {new Date(conv.startedAt).toLocaleString("pt-BR")}</span>}
        {conv.completedAt && <span>- Fim: {new Date(conv.completedAt).toLocaleString("pt-BR")}</span>}
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
                  <p className="text-sm font-medium text-gray-900">{pr.product.name}</p>
                  <p className="text-xs text-gray-500">
                    {pr.product.activeIngredient}
                    {pr.brand && ` - ${pr.brand}`}
                    {pr.isGeneric && " (Generico)"}
                  </p>
                </div>
                <div className="text-right">
                  {pr.price ? (
                    <p className="text-sm font-bold text-green-700">R$ {Number(pr.price).toFixed(2).replace(".", ",")}</p>
                  ) : (
                    <p className="text-xs text-gray-400">Sem preco</p>
                  )}
                  <p className="text-xs text-gray-500">{availLabels[pr.availability] || pr.availability}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
