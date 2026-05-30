import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, Bot, User } from "lucide-react";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

interface ChatMessage {
  id: string;
  campaignId: string;
  role: "user" | "assistant";
  content: string;
  appliedChanges: Record<string, unknown> | null;
  createdAt: string;
}

export function CampaignChatTab({ campaignId }: { campaignId: string }) {
  const qc = useQueryClient();
  const [message, setMessage] = useState("");
  const [personaStyle, setPersonaStyle] = useState<"formal" | "casual" | "anxious">("casual");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ["campaign-chat", campaignId],
    queryFn: () => api.get<{ data: ChatMessage[] }>(`/campaigns/${campaignId}/chat`),
    refetchInterval: 5000,
  });

  const sendMut = useMutation({
    mutationFn: (body: { message: string; personaStyle: string }) =>
      api.post<{ data: { response: string; appliedChanges: unknown } }>(
        `/campaigns/${campaignId}/chat`,
        body,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaign-chat", campaignId] });
      qc.invalidateQueries({ queryKey: ["campaign-flows", campaignId] });
    },
  });

  const messages = data?.data ?? [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed || sendMut.isPending) return;
    setMessage("");
    sendMut.mutate({ message: trimmed, personaStyle });
  };

  return (
    <div className="flex flex-col h-[500px]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
        <div>
          <h3 className="text-sm font-medium text-gray-700">Chat com IA</h3>
          <p className="text-[11px] text-gray-400">Solicite ajustes nos templates e fluxos</p>
        </div>
        <select
          value={personaStyle}
          onChange={(e) => setPersonaStyle(e.target.value as "formal" | "casual" | "anxious")}
          className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-green-500"
        >
          <option value="casual">Casual</option>
          <option value="formal">Formal</option>
          <option value="anxious">Ansioso</option>
        </select>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <Bot className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Envie uma mensagem para ajustar os templates</p>
            <p className="text-gray-300 text-xs mt-1">
              Ex: "Torne a saudacao mais formal" ou "Adicione pergunta sobre desconto"
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex gap-2 max-w-[85%]",
              msg.role === "user" ? "ml-auto flex-row-reverse" : "",
            )}
          >
            <div className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0",
              msg.role === "user" ? "bg-green-100" : "bg-purple-100",
            )}>
              {msg.role === "user" ? (
                <User className="w-3.5 h-3.5 text-green-700" />
              ) : (
                <Bot className="w-3.5 h-3.5 text-purple-700" />
              )}
            </div>
            <div className={cn(
              "rounded-xl px-3 py-2 text-sm",
              msg.role === "user"
                ? "bg-green-600 text-white"
                : "bg-gray-100 text-gray-800",
            )}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.appliedChanges && Object.keys(msg.appliedChanges).length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200/50">
                  <p className="text-[10px] text-purple-600 font-medium uppercase mb-1">
                    Alteracoes aplicadas:
                  </p>
                  <pre className="text-[11px] text-gray-600 bg-white/50 rounded p-1.5 overflow-x-auto">
                    {JSON.stringify(msg.appliedChanges, null, 2)}
                  </pre>
                </div>
              )}
              <p className={cn(
                "text-[10px] mt-1",
                msg.role === "user" ? "text-green-200" : "text-gray-400",
              )}>
                {new Date(msg.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        ))}
        {sendMut.isPending && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center bg-purple-100 flex-shrink-0">
              <Bot className="w-3.5 h-3.5 text-purple-700" />
            </div>
            <div className="bg-gray-100 rounded-xl px-3 py-2">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Solicite ajustes nos templates..."
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            disabled={sendMut.isPending}
          />
          <button
            onClick={handleSend}
            disabled={!message.trim() || sendMut.isPending}
            className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
