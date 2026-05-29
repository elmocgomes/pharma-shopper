import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Bot, Clock, Shield, Users } from "lucide-react";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

interface AppSettings {
  ai: { model: string; maxTokens: number; parseMaxTokens: number };
  campaign: { defaultRateLimitPerHour: number; businessHoursStart: string; businessHoursEnd: string; maxFollowUps: number; responseTimeoutMinutes: number };
  persona: { rotationThreshold: number };
  antiDetection: { minDelaySeconds: number; maxDelaySeconds: number; warmupDays: number; warmupDailyLimit: number; dailyMessageLimit: number };
}

export function SettingsPage() {
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);

  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<{ data: AppSettings }>("/settings"),
  });

  const [form, setForm] = useState<AppSettings | null>(null);

  useEffect(() => {
    if (data?.data && !form) setForm(data.data);
  }, [data, form]);

  const saveMut = useMutation({
    mutationFn: (body: AppSettings) => api.put("/settings", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  if (!form) return <div className="p-6 text-gray-400">Carregando...</div>;

  const updateAi = (key: string, value: string | number) =>
    setForm((f) => f ? { ...f, ai: { ...f.ai, [key]: value } } : f);
  const updateCampaign = (key: string, value: string | number) =>
    setForm((f) => f ? { ...f, campaign: { ...f.campaign, [key]: value } } : f);
  const updatePersona = (key: string, value: number) =>
    setForm((f) => f ? { ...f, persona: { ...f.persona, [key]: value } } : f);
  const updateAntiDetection = (key: string, value: number) =>
    setForm((f) => f ? { ...f, antiDetection: { ...f.antiDetection, [key]: value } } : f);

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configuracoes</h1>
          <p className="text-sm text-gray-500 mt-1">Parametros da plataforma</p>
        </div>
        <button
          onClick={() => saveMut.mutate(form)}
          disabled={saveMut.isPending}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            saved ? "bg-green-100 text-green-700" : "bg-green-600 text-white hover:bg-green-700",
          )}
        >
          <Save className="w-4 h-4" />
          {saved ? "Salvo!" : saveMut.isPending ? "Salvando..." : "Salvar"}
        </button>
      </div>

      {/* AI Config */}
      <Section icon={Bot} title="Inteligencia Artificial" description="Modelo e limites do Claude API">
        <Field label="Modelo">
          <select value={form.ai.model} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateAi("model", e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500">
            <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
            <option value="claude-haiku-4-20250514">Claude Haiku 4</option>
          </select>
        </Field>
        <Field label="Max Tokens (Mensagem)">
          <input type="number" value={form.ai.maxTokens} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateAi("maxTokens", Number(e.target.value))} min={50} max={2000} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 w-32" />
        </Field>
        <Field label="Max Tokens (Parsing)">
          <input type="number" value={form.ai.parseMaxTokens} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateAi("parseMaxTokens", Number(e.target.value))} min={100} max={4000} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 w-32" />
        </Field>
      </Section>

      {/* Campaign Config */}
      <Section icon={Clock} title="Campanhas" description="Limites e horarios padrao">
        <Field label="Limite por hora (padrao)">
          <input type="number" value={form.campaign.defaultRateLimitPerHour} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateCampaign("defaultRateLimitPerHour", Number(e.target.value))} min={1} max={100} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 w-32" />
        </Field>
        <Field label="Horario Comercial">
          <div className="flex items-center gap-2">
            <input type="time" value={form.campaign.businessHoursStart} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateCampaign("businessHoursStart", e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500" />
            <span className="text-gray-400">ate</span>
            <input type="time" value={form.campaign.businessHoursEnd} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateCampaign("businessHoursEnd", e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500" />
          </div>
        </Field>
        <Field label="Max Follow-ups">
          <input type="number" value={form.campaign.maxFollowUps} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateCampaign("maxFollowUps", Number(e.target.value))} min={0} max={10} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 w-32" />
        </Field>
        <Field label="Timeout de Resposta (min)">
          <input type="number" value={form.campaign.responseTimeoutMinutes} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateCampaign("responseTimeoutMinutes", Number(e.target.value))} min={5} max={1440} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 w-32" />
        </Field>
      </Section>

      {/* Persona Config */}
      <Section icon={Users} title="Personas" description="Rotacao de identidades">
        <Field label="Rotacao apos N conversas">
          <input type="number" value={form.persona.rotationThreshold} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updatePersona("rotationThreshold", Number(e.target.value))} min={1} max={50} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 w-32" />
        </Field>
      </Section>

      {/* Anti-Detection */}
      <Section icon={Shield} title="Anti-Deteccao" description="Protecao contra bloqueio">
        <Field label="Delay Minimo (seg)">
          <input type="number" value={form.antiDetection.minDelaySeconds} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateAntiDetection("minDelaySeconds", Number(e.target.value))} min={5} max={600} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 w-32" />
        </Field>
        <Field label="Delay Maximo (seg)">
          <input type="number" value={form.antiDetection.maxDelaySeconds} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateAntiDetection("maxDelaySeconds", Number(e.target.value))} min={30} max={1800} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 w-32" />
        </Field>
        <Field label="Dias de Aquecimento">
          <input type="number" value={form.antiDetection.warmupDays} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateAntiDetection("warmupDays", Number(e.target.value))} min={0} max={30} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 w-32" />
        </Field>
        <Field label="Limite Diario (Aquecimento)">
          <input type="number" value={form.antiDetection.warmupDailyLimit} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateAntiDetection("warmupDailyLimit", Number(e.target.value))} min={1} max={100} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 w-32" />
        </Field>
        <Field label="Limite Diario (Normal)">
          <input type="number" value={form.antiDetection.dailyMessageLimit} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateAntiDetection("dailyMessageLimit", Number(e.target.value))} min={1} max={500} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 w-32" />
        </Field>
      </Section>
    </div>
  );
}

function Section({ icon: Icon, title, description, children }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4 text-green-600" />
        <div>
          <h2 className="text-sm font-medium text-gray-900">{title}</h2>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-sm text-gray-700">{label}</label>
      {children}
    </div>
  );
}
