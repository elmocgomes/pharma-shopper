import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Activity, AlertTriangle, CheckCircle2, XOctagon, Pause } from "lucide-react";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

interface HealthSummary {
  healthy: number;
  warning: number;
  critical: number;
  total: number;
  healthyPct: number;
}

interface HealthCheck {
  id: string;
  conversationId: string;
  campaignId: string;
  checkType: "periodic" | "triggered";
  status: "healthy" | "warning" | "critical";
  issues: { type: string; description: string; severity: string }[];
  actionTaken: string | null;
  checkedAt: string;
}

const statusIcons: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  healthy: { icon: CheckCircle2, color: "text-green-600" },
  warning: { icon: AlertTriangle, color: "text-yellow-600" },
  critical: { icon: XOctagon, color: "text-red-600" },
};

export function CampaignHealthTab({ campaignId }: { campaignId: string }) {
  const qc = useQueryClient();

  const { data: summaryData, isLoading: loadingSummary } = useQuery({
    queryKey: ["campaign-health", campaignId],
    queryFn: () => api.get<{ data: HealthSummary }>(`/campaigns/${campaignId}/health`),
    refetchInterval: 10_000,
  });

  const { data: checksData, isLoading: loadingChecks } = useQuery({
    queryKey: ["campaign-health-checks", campaignId],
    queryFn: () => api.get<{ data: HealthCheck[] }>(`/campaigns/${campaignId}/health/checks`),
    refetchInterval: 10_000,
  });

  const pauseMut = useMutation({
    mutationFn: (conversationId: string) =>
      api.post(`/conversations/${conversationId}/pause`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaign-health", campaignId] });
      qc.invalidateQueries({ queryKey: ["campaign-health-checks", campaignId] });
    },
  });

  const summary = summaryData?.data;
  const checks = checksData?.data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-gray-700">Saude das Conversas</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Monitoramento em tempo real por agente de saude
        </p>
      </div>

      {/* Summary cards */}
      {loadingSummary ? (
        <div className="text-center py-4 text-gray-400 text-sm">Carregando...</div>
      ) : summary ? (
        <div className="grid grid-cols-4 gap-3">
          <SummaryCard
            label="Total"
            value={summary.total}
            icon={Activity}
            color="text-gray-600"
            bg="bg-gray-50"
          />
          <SummaryCard
            label="Saudaveis"
            value={summary.healthy}
            icon={CheckCircle2}
            color="text-green-600"
            bg="bg-green-50"
            pct={summary.healthyPct}
          />
          <SummaryCard
            label="Alerta"
            value={summary.warning}
            icon={AlertTriangle}
            color="text-yellow-600"
            bg="bg-yellow-50"
          />
          <SummaryCard
            label="Criticos"
            value={summary.critical}
            icon={XOctagon}
            color="text-red-600"
            bg="bg-red-50"
          />
        </div>
      ) : null}

      {/* Health bar */}
      {summary && summary.total > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex rounded-full h-4 overflow-hidden">
            {summary.healthy > 0 && (
              <div
                className="bg-green-500 transition-all"
                style={{ width: `${(summary.healthy / summary.total) * 100}%` }}
              />
            )}
            {summary.warning > 0 && (
              <div
                className="bg-yellow-400 transition-all"
                style={{ width: `${(summary.warning / summary.total) * 100}%` }}
              />
            )}
            {summary.critical > 0 && (
              <div
                className="bg-red-500 transition-all"
                style={{ width: `${(summary.critical / summary.total) * 100}%` }}
              />
            )}
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-gray-400">
            <span>{summary.healthyPct}% saudavel</span>
            <span>{summary.total} conversas verificadas</span>
          </div>
        </div>
      )}

      {/* Checks list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h4 className="text-xs font-medium text-gray-600 uppercase">
            Verificacoes Recentes ({checks.length})
          </h4>
        </div>
        {loadingChecks ? (
          <div className="text-center py-8 text-gray-400 text-sm">Carregando...</div>
        ) : checks.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            Nenhuma verificacao realizada ainda
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {checks.map((check) => {
              const st = statusIcons[check.status] ?? statusIcons.healthy;
              const StIcon = st.icon;
              return (
                <div key={check.id} className="px-4 py-3 flex items-start gap-3">
                  <StIcon className={cn("w-4 h-4 mt-0.5 flex-shrink-0", st.color)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-gray-600 truncate">
                        {check.conversationId.slice(0, 8)}...
                      </span>
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-[10px] font-medium",
                        check.status === "healthy" ? "bg-green-100 text-green-700" :
                        check.status === "warning" ? "bg-yellow-100 text-yellow-700" :
                        "bg-red-100 text-red-700",
                      )}>
                        {check.status}
                      </span>
                      {check.actionTaken && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-100 text-purple-700">
                          {check.actionTaken}
                        </span>
                      )}
                    </div>
                    {check.issues.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {check.issues.map((issue, i) => (
                          <p key={i} className="text-xs text-gray-500">
                            <span className="font-medium text-gray-600">{issue.type}:</span>{" "}
                            {issue.description}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] text-gray-400">
                      {new Date(check.checkedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    {check.status === "critical" && !check.actionTaken && (
                      <button
                        onClick={() => pauseMut.mutate(check.conversationId)}
                        disabled={pauseMut.isPending}
                        className="mt-1 flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-700 rounded text-[10px] font-medium hover:bg-red-100"
                      >
                        <Pause className="w-3 h-3" /> Pausar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  color,
  bg,
  pct,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
  pct?: number;
}) {
  return (
    <div className={cn("rounded-xl border border-gray-200 p-3", bg)}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn("w-4 h-4", color)} />
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className={cn("text-xl font-bold", color)}>{value}</p>
      {pct !== undefined && (
        <p className="text-[10px] text-gray-400">{pct}%</p>
      )}
    </div>
  );
}
