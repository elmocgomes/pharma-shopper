import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import {
  Plus,
  RefreshCw,
  MapPin,
  Signal,
  SignalZero,
  QrCode,
  Trash2,
  LogOut,
  User,
} from "lucide-react";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

const BR_STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
] as const;

interface WaSession {
  id: string;
  phoneNumber: string;
  waGatewaySessionId: string;
  displayName: string | null;
  stateCode: string | null;
  status: "disconnected" | "qr_pending" | "connected" | "banned";
  currentPersonaId: string | null;
  personaRotationCount: number;
  dailyMessageCount: number;
  maxDailyMessages: number;
  lastActiveAt: string | null;
  currentPersona: { id: string; name: string; communicationStyle: string } | null;
}

interface QrResult {
  qr?: string;
  data?: { message: string };
}

const statusColors: Record<string, string> = {
  connected: "bg-green-100 text-green-700",
  disconnected: "bg-gray-100 text-gray-600",
  qr_pending: "bg-yellow-100 text-yellow-700",
  banned: "bg-red-100 text-red-700",
};

const statusLabels: Record<string, string> = {
  connected: "Conectado",
  disconnected: "Desconectado",
  qr_pending: "QR Pendente",
  banned: "Banido",
};

export function WhatsAppPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [qrData, setQrData] = useState<{ sessionId: string; qr: string } | null>(null);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState("");

  // Convert raw QR string to renderable image
  useEffect(() => {
    if (!qrData?.qr) {
      setQrImageUrl(null);
      return;
    }
    // If it's already a data URL or http URL, use directly
    if (qrData.qr.startsWith("data:") || qrData.qr.startsWith("http")) {
      setQrImageUrl(qrData.qr);
      return;
    }
    // Otherwise, it's a raw QR string — render it as a QR code image
    QRCode.toDataURL(qrData.qr, { width: 256, margin: 2 })
      .then((url) => setQrImageUrl(url))
      .catch((err) => console.error("QR render error:", err));
  }, [qrData]);

  const { data, isLoading } = useQuery({
    queryKey: ["wa-sessions", stateFilter],
    queryFn: () =>
      api.get<{ data: WaSession[] }>(
        `/wa-sessions${stateFilter ? `?state=${stateFilter}` : ""}`,
      ),
  });

  const { data: stats } = useQuery({
    queryKey: ["wa-sessions-stats"],
    queryFn: () =>
      api.get<{ data: { stateCode: string | null; total: number; connected: number }[] }>(
        "/wa-sessions/stats/by-state",
      ),
  });

  const createMut = useMutation({
    mutationFn: (body: { phoneNumber: string; waGatewaySessionId: string; displayName?: string; stateCode?: string }) =>
      api.post<{ data: WaSession }>("/wa-sessions", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wa-sessions"] });
      setShowCreate(false);
    },
  });

  const startMut = useMutation({
    mutationFn: (id: string) => api.post<{ data: QrResult }>(`/wa-sessions/${id}/start`, {}),
    onSuccess: (res, id) => {
      if (res.data.qr) setQrData({ sessionId: id, qr: res.data.qr });
      qc.invalidateQueries({ queryKey: ["wa-sessions"] });
    },
  });

  const logoutMut = useMutation({
    mutationFn: (id: string) => api.post(`/wa-sessions/${id}/logout`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wa-sessions"] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/wa-sessions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wa-sessions"] }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...body }: { id: string; stateCode?: string | null }) =>
      api.put(`/wa-sessions/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wa-sessions"] }),
  });

  const sessions = data?.data ?? [];

  const stateMap = new Map<string, { total: number; connected: number }>();
  stats?.data?.forEach((s) => {
    if (s.stateCode) stateMap.set(s.stateCode, { total: s.total, connected: s.connected });
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">WhatsApp Numbers</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gerencie números, atribua estados e monitore conexões
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Adicionar Número
        </button>
      </div>

      {/* State distribution */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Distribuição por Estado</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStateFilter("")}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
              !stateFilter ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200",
            )}
          >
            Todos ({sessions.length})
          </button>
          {BR_STATES.map((st) => {
            const s = stateMap.get(st);
            if (!s) return null;
            return (
              <button
                key={st}
                onClick={() => setStateFilter(stateFilter === st ? "" : st)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                  stateFilter === st
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                )}
              >
                {st} ({s.connected}/{s.total})
              </button>
            );
          })}
        </div>
      </div>

      {/* Session cards */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Carregando...</div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          Nenhum número cadastrado
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sessions.map((s) => (
            <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{s.displayName || s.phoneNumber}</p>
                  <p className="text-xs text-gray-500">{s.phoneNumber}</p>
                </div>
                <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", statusColors[s.status])}>
                  {statusLabels[s.status]}
                </span>
              </div>

              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  <select
                    value={s.stateCode || ""}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                      updateMut.mutate({ id: s.id, stateCode: e.target.value || null })
                    }
                    className="bg-transparent border-none text-xs cursor-pointer"
                  >
                    <option value="">Sem estado</option>
                    {BR_STATES.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </span>
                <span className="flex items-center gap-1">
                  {s.status === "connected" ? (
                    <Signal className="w-3 h-3 text-green-500" />
                  ) : (
                    <SignalZero className="w-3 h-3 text-gray-400" />
                  )}
                  {s.dailyMessageCount}/{s.maxDailyMessages} msgs hoje
                </span>
              </div>

              {s.currentPersona && (
                <div className="flex items-center gap-2 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                  <User className="w-3 h-3" />
                  {s.currentPersona.name} ({s.currentPersona.communicationStyle})
                  <span className="text-blue-400 ml-auto">rotação #{s.personaRotationCount}</span>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                {s.status === "disconnected" && (
                  <button
                    onClick={() => startMut.mutate(s.id)}
                    disabled={startMut.isPending}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-medium hover:bg-green-100 transition-colors"
                  >
                    <QrCode className="w-3 h-3" />
                    Conectar
                  </button>
                )}
                {s.status === "connected" && (
                  <button
                    onClick={() => logoutMut.mutate(s.id)}
                    disabled={logoutMut.isPending}
                    className="flex items-center gap-1 px-3 py-1.5 bg-yellow-50 text-yellow-700 rounded-lg text-xs font-medium hover:bg-yellow-100 transition-colors"
                  >
                    <LogOut className="w-3 h-3" />
                    Desconectar
                  </button>
                )}
                <button
                  onClick={() => deleteMut.mutate(s.id)}
                  disabled={deleteMut.isPending}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors ml-auto"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* QR Code Modal */}
      {qrData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setQrData(null)}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">Escanear QR Code</h2>
            <div className="flex justify-center">
              {qrImageUrl ? (
                <img src={qrImageUrl} alt="QR Code" className="w-64 h-64" />
              ) : (
                <div className="w-64 h-64 flex items-center justify-center text-gray-400">
                  <RefreshCw className="w-8 h-8 animate-spin" />
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 text-center mt-3">
              Abra o WhatsApp no celular e escaneie o código
            </p>
            <button
              onClick={() => setQrData(null)}
              className="w-full mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">Adicionar Número</h2>
            <CreateSessionForm
              onSubmit={(data) => createMut.mutate(data)}
              isPending={createMut.isPending}
              onCancel={() => setShowCreate(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function CreateSessionForm({
  onSubmit,
  isPending,
  onCancel,
}: {
  onSubmit: (data: { phoneNumber: string; waGatewaySessionId: string; displayName?: string; stateCode?: string }) => void;
  isPending: boolean;
  onCancel: () => void;
}) {
  const [phone, setPhone] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [name, setName] = useState("");
  const [state, setState] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          phoneNumber: phone,
          waGatewaySessionId: sessionId || phone.replace(/\D/g, ""),
          ...(name && { displayName: name }),
          ...(state && { stateCode: state }),
        });
      }}
      className="space-y-4"
    >
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Número (E.164)</label>
        <input
          type="text"
          value={phone}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)}
          placeholder="+5511999999999"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Session ID (wa-gateway)</label>
        <input
          type="text"
          value={sessionId}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSessionId(e.target.value)}
          placeholder="Auto-gerado do número"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
        <input
          type="text"
          value={name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
          placeholder="Opcional"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
        <select
          value={state}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setState(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
        >
          <option value="">Selecionar estado...</option>
          {BR_STATES.map((st) => (
            <option key={st} value={st}>{st}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isPending || !phone}
          className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          {isPending ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </form>
  );
}
