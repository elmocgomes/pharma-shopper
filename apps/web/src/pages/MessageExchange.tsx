import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  MessagesSquare,
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  Loader2,
  Image,
  FileAudio,
  Bot,
  User,
} from "lucide-react";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

interface MessageWithContext {
  id: string;
  conversationId: string;
  direction: "inbound" | "outbound";
  contentType: string;
  content: string | null;
  mediaPath: string | null;
  aiGenerated: string | null;
  sentAt: string | null;
  conversation: {
    id: string;
    status: string;
    phase: string;
    campaignId: string;
  };
  pharmacy: {
    id: string;
    name: string;
    city: string;
    state: string;
    whatsappNumber: string;
  };
  personaName: string | null;
}

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  initial: "Inicial",
  awaiting_response: "Aguardando",
  parsing: "Analisando",
  follow_up: "Follow-up",
  completed: "Completo",
  failed: "Falhou",
  timeout: "Timeout",
};

const phaseLabels: Record<string, string> = {
  phase1_branded: "Fase 1",
  phase2_alternatives: "Fase 2",
};

function formatTime(ts: string | null): string {
  if (!ts) return "-";
  return new Date(ts).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function MessageExchangePage() {
  const navigate = useNavigate();
  const [direction, setDirection] = useState<string>("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);

  const params = new URLSearchParams();
  if (direction) params.set("direction", direction);
  if (search) params.set("search", search);
  params.set("limit", String(limit));
  params.set("offset", String(offset));

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["message-exchange", direction, search, limit, offset],
    queryFn: () =>
      api.get<{ data: MessageWithContext[]; total: number; limit: number; offset: number }>(
        `/messages?${params.toString()}`,
      ),
    refetchInterval: 10000,
  });

  const messages = data?.data || [];
  const total = data?.total || 0;
  const hasNext = offset + limit < total;
  const hasPrev = offset > 0;

  const handleSearch = () => {
    setSearch(searchInput);
    setOffset(0);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessagesSquare className="w-6 h-6 text-green-600" />
          <h1 className="text-2xl font-bold text-gray-900">Mensagens</h1>
          {total > 0 && (
            <span className="text-sm text-gray-500">({total} total)</span>
          )}
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-white border rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 bg-white p-4 rounded-lg border">
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setDirection(""); setOffset(0); }}
            className={cn(
              "px-3 py-1.5 text-sm rounded-md border transition-colors",
              !direction ? "bg-green-50 border-green-300 text-green-700" : "hover:bg-gray-50",
            )}
          >
            Todas
          </button>
          <button
            onClick={() => { setDirection("outbound"); setOffset(0); }}
            className={cn(
              "px-3 py-1.5 text-sm rounded-md border transition-colors flex items-center gap-1.5",
              direction === "outbound" ? "bg-green-50 border-green-300 text-green-700" : "hover:bg-gray-50",
            )}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            Enviadas
          </button>
          <button
            onClick={() => { setDirection("inbound"); setOffset(0); }}
            className={cn(
              "px-3 py-1.5 text-sm rounded-md border transition-colors flex items-center gap-1.5",
              direction === "inbound" ? "bg-blue-50 border-blue-300 text-blue-700" : "hover:bg-gray-50",
            )}
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            Recebidas
          </button>
        </div>

        <div className="flex-1 flex items-center gap-2 ml-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar no conteudo..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="w-full pl-9 pr-3 py-1.5 text-sm border rounded-md"
            />
          </div>
          <button
            onClick={handleSearch}
            className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Buscar
          </button>
          {search && (
            <button
              onClick={() => { setSearch(""); setSearchInput(""); setOffset(0); }}
              className="text-xs text-red-500 hover:text-red-700"
            >
              limpar
            </button>
          )}
        </div>
      </div>

      {/* Messages list */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="py-12 text-center text-gray-500">Nenhuma mensagem encontrada</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {messages.map((msg) => {
              const isOutbound = msg.direction === "outbound";
              const isAi = msg.aiGenerated === "true";

              return (
                <div
                  key={msg.id}
                  className="px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/conversations/${msg.conversationId}`)}
                >
                  <div className="flex items-start gap-3">
                    {/* Direction indicator */}
                    <div
                      className={cn(
                        "mt-1 p-1.5 rounded-full shrink-0",
                        isOutbound ? "bg-green-100" : "bg-blue-100",
                      )}
                    >
                      {isOutbound ? (
                        <ArrowUpRight className="w-3.5 h-3.5 text-green-600" />
                      ) : (
                        <ArrowDownLeft className="w-3.5 h-3.5 text-blue-600" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {msg.pharmacy.name}
                        </span>
                        <span className="text-xs text-gray-400">
                          {msg.pharmacy.city}/{msg.pharmacy.state}
                        </span>
                        {isAi && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-purple-50 text-purple-600 rounded">
                            <Bot className="w-3 h-3" />
                            IA
                          </span>
                        )}
                        {msg.personaName && isOutbound && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-600 rounded">
                            <User className="w-3 h-3" />
                            {msg.personaName}
                          </span>
                        )}
                        <span className={cn(
                          "px-1.5 py-0.5 text-[10px] font-medium rounded",
                          msg.conversation.status === "completed" ? "bg-green-50 text-green-700" :
                          msg.conversation.status === "failed" ? "bg-red-50 text-red-700" :
                          msg.conversation.status === "timeout" ? "bg-yellow-50 text-yellow-700" :
                          "bg-gray-50 text-gray-600"
                        )}>
                          {statusLabels[msg.conversation.status] || msg.conversation.status}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {phaseLabels[msg.conversation.phase] || msg.conversation.phase}
                        </span>
                      </div>

                      <div className="flex items-start gap-2">
                        {msg.contentType === "image" && (
                          <Image className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                        )}
                        {msg.contentType === "audio" && (
                          <FileAudio className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                        )}
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {msg.content || `[${msg.contentType}]`}
                        </p>
                      </div>
                    </div>

                    {/* Time */}
                    <div className="text-xs text-gray-400 whitespace-nowrap shrink-0">
                      {formatTime(msg.sentAt)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {total > limit && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
            <span className="text-sm text-gray-500">
              Mostrando {offset + 1}-{Math.min(offset + limit, total)} de {total}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={!hasPrev}
                className="px-3 py-1 text-sm border rounded-md hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <button
                onClick={() => setOffset(offset + limit)}
                disabled={!hasNext}
                className="px-3 py-1 text-sm border rounded-md hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Proximo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
