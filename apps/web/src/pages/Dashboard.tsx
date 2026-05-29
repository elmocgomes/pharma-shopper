import {
  MessageCircle,
  Building2,
  Megaphone,
  TrendingUp,
} from "lucide-react";

const stats = [
  { label: "Campanhas Ativas", value: "0", icon: Megaphone, color: "green" },
  { label: "Farmácias", value: "0", icon: Building2, color: "blue" },
  { label: "Conversas Hoje", value: "0", icon: MessageCircle, color: "purple" },
  { label: "Taxa de Resposta", value: "—", icon: TrendingUp, color: "amber" },
];

export function DashboardPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-sm text-gray-500 mt-1">
          Visão geral do mystery shopping
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm"
          >
            <div className="flex items-center justify-between mb-4">
              <div
                className={`p-2 rounded-lg bg-${color}-50 text-${color}-600`}
              >
                <Icon className="w-5 h-5" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-sm text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Atividade Recente
        </h3>
        <p className="text-sm text-gray-400">
          Nenhuma atividade ainda. Crie sua primeira campanha para começar.
        </p>
      </div>
    </div>
  );
}
