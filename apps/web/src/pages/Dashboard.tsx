import { useQuery } from "@tanstack/react-query";
import {
  Megaphone,
  Building2,
  MessageCircle,
  TrendingUp,
  Signal,
  Activity,
} from "lucide-react";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

interface DashboardStats {
  campaigns: { total: number; running: number; completed: number };
  pharmacies: { total: number };
  sessions: { total: number; connected: number };
  conversations: { total: number; today: number; completed: number; awaiting: number; responseRate: number };
  priceRecords: { total: number };
}

interface SessionHealth {
  id: string;
  phoneNumber: string;
  displayName: string | null;
  stateCode: string | null;
  status: string;
  dailyMessageCount: number;
  maxDailyMessages: number;
  lastActiveAt: string | null;
}

export function DashboardPage() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => api.get<{ data: DashboardStats }>("/stats/dashboard"),
    refetchInterval: 30_000,
  });

  const { data: healthData } = useQuery({
    queryKey: ["sessions-health"],
    queryFn: () => api.get<{ data: SessionHealth[] }>("/stats/sessions-health"),
    refetchInterval: 30_000,
  });

  const s = stats?.data;
  const sessions = healthData?.data ?? [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Visao geral da plataforma</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Megaphone} label="Campanhas Ativas" value={s?.campaigns.running ?? 0} sub={`${s?.campaigns.completed ?? 0} concluidas`} color="green" />
        <KpiCard icon={Building2} label="Farmacias" value={s?.pharmacies.total ?? 0} sub="cadastradas" color="blue" />
        <KpiCard icon={MessageCircle} label="Conversas Hoje" value={s?.conversations.today ?? 0} sub={`${s?.conversations.awaiting ?? 0} aguardando`} color="purple" />
        <KpiCard icon={TrendingUp} label="Taxa de Resposta" value={`${s?.conversations.responseRate ?? 0}%`} sub={`${s?.priceRecords.total ?? 0} precos coletados`} color="amber" />
      </div>

      {/* Number Health */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Signal className="w-4 h-4 text-green-600" />
          <h2 className="text-sm font-medium text-gray-700">Saude dos Numeros</h2>
          <span className="text-xs text-gray-400 ml-auto">
            {sessions.filter((sess) => sess.status === "connected").length}/{sessions.length} conectados
          </span>
        </div>
        {sessions.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhum numero cadastrado</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {sessions.map((sess) => {
              const pct = sess.maxDailyMessages > 0 ? (sess.dailyMessageCount / sess.maxDailyMessages) * 100 : 0;
              return (
                <div key={sess.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    sess.status === "connected" ? "bg-green-500" : sess.status === "banned" ? "bg-red-500" : "bg-gray-400",
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{sess.displayName || sess.phoneNumber}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {sess.stateCode && <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">{sess.stateCode}</span>}
                      <div className="flex-1 bg-gray-200 rounded-full h-1.5 max-w-[80px]">
                        <div className={cn("h-1.5 rounded-full", pct > 80 ? "bg-red-500" : pct > 50 ? "bg-yellow-500" : "bg-green-500")} style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                      <span className="text-xs text-gray-400">{sess.dailyMessageCount}/{sess.maxDailyMessages}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <Activity className="w-5 h-5 text-gray-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{s?.conversations.total ?? 0}</p>
          <p className="text-xs text-gray-500">Total de Conversas</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <Activity className="w-5 h-5 text-green-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{s?.conversations.completed ?? 0}</p>
          <p className="text-xs text-gray-500">Conversas Concluidas</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <Signal className="w-5 h-5 text-blue-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{s?.sessions.total ?? 0}</p>
          <p className="text-xs text-gray-500">Numeros WhatsApp</p>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  sub: string;
  color: "green" | "blue" | "purple" | "amber";
}) {
  const bgColors = { green: "bg-green-50", blue: "bg-blue-50", purple: "bg-purple-50", amber: "bg-amber-50" };
  const iconColors = { green: "text-green-600", blue: "text-blue-600", purple: "text-purple-600", amber: "text-amber-600" };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className={cn("p-2 rounded-lg", bgColors[color])}>
          <Icon className={cn("w-4 h-4", iconColors[color])} />
        </div>
        <span className="text-xs text-gray-500 font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );
}
