import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle, RotateCw, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

interface CampaignFlow {
  id: string;
  campaignId: string;
  baseFlowId: string;
  personaStyle: "formal" | "casual" | "anxious";
  calibratedTree: Record<string, unknown> | null;
  calibrationStatus: "pending" | "calibrating" | "ready" | "rejected";
  calibrationDiff: Record<string, unknown> | null;
  calibratedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
}

interface FlowDiff {
  personaStyle: string;
  calibrationStatus: string;
  baseTree: Record<string, unknown> | null;
  calibratedTree: Record<string, unknown> | null;
  diff: Record<string, { original: unknown; calibrated: unknown }> | null;
  calibratedAt: string | null;
  approvedAt: string | null;
}

const statusConfig: Record<string, { label: string; bg: string }> = {
  pending: { label: "Pendente", bg: "bg-gray-100 text-gray-600" },
  calibrating: { label: "Calibrando...", bg: "bg-blue-100 text-blue-700" },
  ready: { label: "Pronto", bg: "bg-green-100 text-green-700" },
  rejected: { label: "Rejeitado", bg: "bg-red-100 text-red-700" },
};

const styleLabels: Record<string, string> = {
  formal: "Formal",
  casual: "Casual",
  anxious: "Ansioso",
};

export function CampaignTemplatesTab({ campaignId }: { campaignId: string }) {
  const qc = useQueryClient();
  const [expandedStyle, setExpandedStyle] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["campaign-flows", campaignId],
    queryFn: () => api.get<{ data: CampaignFlow[] }>(`/campaigns/${campaignId}/flows`),
    refetchInterval: 5000,
  });

  const calibrateMut = useMutation({
    mutationFn: () => api.post(`/campaigns/${campaignId}/calibrate`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaign-flows", campaignId] }),
  });

  const approveMut = useMutation({
    mutationFn: (style: string) => api.post(`/campaigns/${campaignId}/flows/${style}/approve`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaign-flows", campaignId] }),
  });

  const rejectMut = useMutation({
    mutationFn: (style: string) => api.post(`/campaigns/${campaignId}/flows/${style}/reject`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaign-flows", campaignId] }),
  });

  const flows = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-700">Templates Calibrados</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Comparacao dos templates base vs calibrados para esta campanha
          </p>
        </div>
        <button
          onClick={() => calibrateMut.mutate()}
          disabled={calibrateMut.isPending}
          className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 disabled:opacity-50"
        >
          <RotateCw className={cn("w-3.5 h-3.5", calibrateMut.isPending && "animate-spin")} />
          {calibrateMut.isPending ? "Calibrando..." : "Calibrar"}
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-400 text-sm">Carregando...</div>
      ) : flows.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-400 text-sm">Nenhum fluxo calibrado</p>
          <p className="text-gray-400 text-xs mt-1">Clique em "Calibrar" para gerar templates adaptados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {flows.map((flow) => {
            const status = statusConfig[flow.calibrationStatus] ?? statusConfig.pending;
            const isExpanded = expandedStyle === flow.personaStyle;
            return (
              <div key={flow.id} className="bg-white rounded-xl border border-gray-200">
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedStyle(isExpanded ? null : flow.personaStyle)}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                  <span className="font-medium text-gray-900">
                    {styleLabels[flow.personaStyle] ?? flow.personaStyle}
                  </span>
                  <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", status.bg)}>
                    {status.label}
                  </span>
                  {flow.approvedAt && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                      Aprovado
                    </span>
                  )}
                  <div className="flex-1" />
                  {flow.calibrationStatus === "ready" && !flow.approvedAt && (
                    <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => approveMut.mutate(flow.personaStyle)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 rounded-lg text-xs font-medium hover:bg-green-100"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Aprovar
                      </button>
                      <button
                        onClick={() => rejectMut.mutate(flow.personaStyle)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 rounded-lg text-xs font-medium hover:bg-red-100"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Rejeitar
                      </button>
                    </div>
                  )}
                </div>

                {isExpanded && (
                  <FlowDiffView campaignId={campaignId} style={flow.personaStyle} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FlowDiffView({ campaignId, style }: { campaignId: string; style: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["campaign-flow-diff", campaignId, style],
    queryFn: () => api.get<{ data: FlowDiff }>(`/campaigns/${campaignId}/flows/${style}/diff`),
  });

  if (isLoading) return <div className="px-4 pb-4 text-gray-400 text-xs">Carregando diff...</div>;
  if (!data?.data) return null;

  const diff = data.data.diff as Record<string, { original: unknown; calibrated: unknown }> | null;

  if (!diff || Object.keys(diff).length === 0) {
    return (
      <div className="px-4 pb-4 text-gray-400 text-xs">Sem diferencas — templates identicos ao base</div>
    );
  }

  return (
    <div className="px-4 pb-4 space-y-2">
      <div className="text-xs text-gray-500 mb-2">
        {Object.keys(diff).length} no(s) modificado(s)
      </div>
      {Object.entries(diff).map(([nodeId, changes]) => (
        <div key={nodeId} className="border border-gray-100 rounded-lg overflow-hidden">
          <div className="px-3 py-1.5 bg-gray-50 text-xs font-mono text-gray-600 font-medium">
            {nodeId}
          </div>
          <div className="grid grid-cols-2 divide-x divide-gray-100">
            <div className="p-3">
              <p className="text-[10px] text-gray-400 uppercase mb-1">Base</p>
              <pre className="text-xs text-gray-600 whitespace-pre-wrap break-words">
                {typeof changes.original === "string"
                  ? changes.original
                  : JSON.stringify(changes.original, null, 2)}
              </pre>
            </div>
            <div className="p-3 bg-green-50/30">
              <p className="text-[10px] text-green-600 uppercase mb-1">Calibrado</p>
              <pre className="text-xs text-green-700 whitespace-pre-wrap break-words">
                {typeof changes.calibrated === "string"
                  ? changes.calibrated
                  : JSON.stringify(changes.calibrated, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
