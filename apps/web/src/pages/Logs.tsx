import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ScrollText,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Timer,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

interface QueueJob {
  id: string;
  queue: string;
  name: string;
  status: string;
  data: unknown;
  result: unknown;
  error: string | null;
  processedOn: number | null;
  finishedOn: number | null;
  timestamp: number;
  duration: number | null;
}

interface QueueSummary {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

const statusConfig: Record<string, { icon: typeof CheckCircle2; color: string; bg: string }> = {
  completed: { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
  failed: { icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
  active: { icon: Loader2, color: "text-blue-600", bg: "bg-blue-50" },
  waiting: { icon: Clock, color: "text-yellow-600", bg: "bg-yellow-50" },
  delayed: { icon: Timer, color: "text-purple-600", bg: "bg-purple-50" },
};

const QUEUE_NAMES = ["campaign", "conversation", "parse", "maintenance", "analyst", "calibrate", "monitor"];

function formatDuration(ms: number | null): string {
  if (ms === null) return "-";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}min`;
}

function formatTime(ts: number | null): string {
  if (!ts) return "-";
  return new Date(ts).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function JobRow({ job }: { job: QueueJob }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = statusConfig[job.status] || statusConfig.waiting;
  const StatusIcon = cfg.icon;

  return (
    <>
      <tr
        className="hover:bg-gray-50 cursor-pointer border-b border-gray-100"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-4 py-3">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
        </td>
        <td className="px-4 py-3">
          <span className="text-xs font-mono text-gray-500">{job.id}</span>
        </td>
        <td className="px-4 py-3">
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
            {job.queue}
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-gray-900">{job.name}</td>
        <td className="px-4 py-3">
          <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium", cfg.bg, cfg.color)}>
            <StatusIcon className={cn("w-3 h-3", job.status === "active" && "animate-spin")} />
            {job.status}
          </span>
        </td>
        <td className="px-4 py-3 text-xs text-gray-500 font-mono">
          {formatDuration(job.duration)}
        </td>
        <td className="px-4 py-3 text-xs text-gray-500">{formatTime(job.timestamp)}</td>
      </tr>
      {expanded && (
        <tr className="bg-gray-50">
          <td colSpan={7} className="px-8 py-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Data</p>
                <pre className="bg-white p-3 rounded-lg border text-xs overflow-auto max-h-48">
                  {JSON.stringify(job.data, null, 2)}
                </pre>
              </div>
              <div>
                {job.error ? (
                  <>
                    <p className="text-xs font-medium text-red-500 mb-1">Erro</p>
                    <pre className="bg-red-50 p-3 rounded-lg border border-red-200 text-xs text-red-700 overflow-auto max-h-48">
                      {job.error}
                    </pre>
                  </>
                ) : job.result ? (
                  <>
                    <p className="text-xs font-medium text-gray-500 mb-1">Resultado</p>
                    <pre className="bg-white p-3 rounded-lg border text-xs overflow-auto max-h-48">
                      {JSON.stringify(job.result, null, 2)}
                    </pre>
                  </>
                ) : (
                  <p className="text-xs text-gray-400 italic">Sem resultado ainda</p>
                )}
              </div>
            </div>
            <div className="mt-3 flex gap-6 text-xs text-gray-500">
              <span>Criado: {formatTime(job.timestamp)}</span>
              <span>Processado: {formatTime(job.processedOn)}</span>
              <span>Finalizado: {formatTime(job.finishedOn)}</span>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function LogsPage() {
  const [queueFilter, setQueueFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [limit, setLimit] = useState(50);

  const params = new URLSearchParams();
  if (queueFilter) params.set("queue", queueFilter);
  if (statusFilter !== "all") params.set("status", statusFilter);
  params.set("limit", String(limit));

  const { data: jobs, isLoading, refetch } = useQuery({
    queryKey: ["logs", queueFilter, statusFilter, limit],
    queryFn: () => api.get<{ data: QueueJob[] }>(`/logs?${params.toString()}`),
    refetchInterval: 10000,
  });

  const { data: queues } = useQuery({
    queryKey: ["log-queues"],
    queryFn: () => api.get<{ data: QueueSummary[] }>("/logs/queues"),
    refetchInterval: 15000,
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ScrollText className="w-6 h-6 text-green-600" />
          <h1 className="text-2xl font-bold text-gray-900">Logs do Sistema</h1>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-white border rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </button>
      </div>

      {/* Queue summary cards */}
      {queues?.data && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {queues.data.map((q) => {
            const total = q.waiting + q.active + q.completed + q.failed + q.delayed;
            const isActive = queueFilter === q.name;
            return (
              <button
                key={q.name}
                onClick={() => setQueueFilter(isActive ? "" : q.name)}
                className={cn(
                  "p-3 rounded-lg border text-left transition-all",
                  isActive
                    ? "bg-green-50 border-green-300 ring-1 ring-green-300"
                    : "bg-white hover:bg-gray-50",
                )}
              >
                <p className="text-xs font-medium text-gray-500 capitalize">{q.name}</p>
                <p className="text-lg font-bold text-gray-900">{total}</p>
                <div className="flex gap-2 mt-1 text-[10px]">
                  {q.failed > 0 && <span className="text-red-600">{q.failed} err</span>}
                  {q.active > 0 && <span className="text-blue-600">{q.active} ativo</span>}
                  {q.waiting > 0 && <span className="text-yellow-600">{q.waiting} espera</span>}
                  {q.delayed > 0 && <span className="text-purple-600">{q.delayed} delay</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4 bg-white p-4 rounded-lg border">
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border rounded-md px-3 py-1.5"
          >
            <option value="all">Todos</option>
            <option value="completed">Completo</option>
            <option value="failed">Falhou</option>
            <option value="active">Ativo</option>
            <option value="waiting">Esperando</option>
            <option value="delayed">Atrasado</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">Limite</label>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="text-sm border rounded-md px-3 py-1.5"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </div>
        {queueFilter && (
          <div className="ml-auto">
            <span className="text-sm text-gray-500">
              Filtro: <strong>{queueFilter}</strong>
            </span>
            <button
              onClick={() => setQueueFilter("")}
              className="ml-2 text-xs text-red-500 hover:text-red-700"
            >
              limpar
            </button>
          </div>
        )}
      </div>

      {/* Jobs table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-3 w-8"></th>
                  <th className="px-4 py-3 text-left">ID</th>
                  <th className="px-4 py-3 text-left">Fila</th>
                  <th className="px-4 py-3 text-left">Job</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Tempo</th>
                  <th className="px-4 py-3 text-left">Criado</th>
                </tr>
              </thead>
              <tbody>
                {jobs?.data && jobs.data.length > 0 ? (
                  jobs.data.map((job) => <JobRow key={`${job.queue}-${job.id}`} job={job} />)
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                      Nenhum job encontrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
