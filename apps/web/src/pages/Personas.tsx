import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit2, Trash2, MessageSquare } from "lucide-react";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

interface Persona {
  id: string;
  name: string;
  ageRange: string | null;
  gender: string | null;
  occupation: string | null;
  communicationStyle: "formal" | "casual" | "anxious";
  scenarioTemplates: string[];
  avatarUrl: string | null;
  isActive: boolean;
}

type PersonaForm = {
  name: string;
  ageRange: string;
  gender: string;
  occupation: string;
  communicationStyle: "formal" | "casual" | "anxious";
  scenarioTemplates: string[];
  isActive: boolean;
};

const styleBadge: Record<string, { bg: string; label: string }> = {
  formal: { bg: "bg-blue-100 text-blue-700", label: "Formal" },
  casual: { bg: "bg-green-100 text-green-700", label: "Casual" },
  anxious: { bg: "bg-orange-100 text-orange-700", label: "Ansioso" },
};

const sampleMessages: Record<string, string> = {
  formal: "Bom dia! Gostaria de saber se vocês possuem o medicamento Losartana 50mg em estoque e qual o valor, por gentileza.",
  casual: "Oi, tudo bem? Vcs tem Losartana 50mg aí? Quanto tá?",
  anxious: "Olá! Por favor, preciso muito saber se vocês têm Losartana 50mg... Meu médico receitou ontem e não estou encontrando em lugar nenhum! Quanto custa?",
};

export function PersonasPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Persona | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [previewStyle, setPreviewStyle] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["personas"],
    queryFn: () => api.get<{ data: Persona[]; total: number }>("/personas"),
  });

  const createMut = useMutation({
    mutationFn: (body: PersonaForm) => api.post("/personas", body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["personas"] }); setShowCreate(false); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...body }: PersonaForm & { id: string }) => api.put(`/personas/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["personas"] }); setEditing(null); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/personas/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["personas"] }),
  });

  const personas = data?.data ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Personas</h1>
          <p className="text-sm text-gray-500 mt-1">
            Identidades fictícias para mystery shopping — cada número roda entre personas
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Nova Persona
        </button>
      </div>

      {/* Style preview */}
      {previewStyle && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-4 h-4 text-green-600" />
            <h3 className="text-sm font-medium text-gray-700">
              Exemplo de mensagem — estilo {styleBadge[previewStyle]?.label}
            </h3>
            <button onClick={() => setPreviewStyle(null)} className="ml-auto text-xs text-gray-400 hover:text-gray-600">Fechar</button>
          </div>
          <div className="bg-green-50 rounded-lg px-4 py-3 text-sm text-gray-700 max-w-md">
            {sampleMessages[previewStyle]}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Carregando...</div>
      ) : personas.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Nenhuma persona cadastrada</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {personas.map((p) => (
            <div
              key={p.id}
              className={cn(
                "bg-white rounded-xl border border-gray-200 p-4 space-y-3",
                !p.isActive && "opacity-50",
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{p.name}</p>
                  <p className="text-xs text-gray-500">
                    {[p.gender, p.ageRange, p.occupation].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <button
                  onClick={() => setPreviewStyle(p.communicationStyle)}
                  className={cn("px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer", styleBadge[p.communicationStyle]?.bg)}
                >
                  {styleBadge[p.communicationStyle]?.label}
                </button>
              </div>

              {p.scenarioTemplates.length > 0 && (
                <div className="space-y-1">
                  {p.scenarioTemplates.slice(0, 3).map((t, i) => (
                    <p key={i} className="text-xs text-gray-500 truncate">• {t}</p>
                  ))}
                  {p.scenarioTemplates.length > 3 && (
                    <p className="text-xs text-gray-400">+{p.scenarioTemplates.length - 3} mais</p>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setEditing(p)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-100 transition-colors"
                >
                  <Edit2 className="w-3 h-3" />
                  Editar
                </button>
                <button
                  onClick={() => deleteMut.mutate(p.id)}
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

      {/* Create/Edit Modal */}
      {(showCreate || editing) && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => { setShowCreate(false); setEditing(null); }}
        >
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">
              {editing ? "Editar Persona" : "Nova Persona"}
            </h2>
            <PersonaFormComponent
              initial={editing || undefined}
              onSubmit={(data) => {
                if (editing) updateMut.mutate({ ...data, id: editing.id });
                else createMut.mutate(data);
              }}
              isPending={createMut.isPending || updateMut.isPending}
              onCancel={() => { setShowCreate(false); setEditing(null); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function PersonaFormComponent({
  initial,
  onSubmit,
  isPending,
  onCancel,
}: {
  initial?: Persona;
  onSubmit: (data: PersonaForm) => void;
  isPending: boolean;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [ageRange, setAgeRange] = useState(initial?.ageRange ?? "");
  const [gender, setGender] = useState(initial?.gender ?? "");
  const [occupation, setOccupation] = useState(initial?.occupation ?? "");
  const [style, setStyle] = useState<"formal" | "casual" | "anxious">(initial?.communicationStyle ?? "casual");
  const [scenarios, setScenarios] = useState(initial?.scenarioTemplates?.join("\n") ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          name,
          ageRange,
          gender,
          occupation,
          communicationStyle: style,
          scenarioTemplates: scenarios.split("\n").map((s) => s.trim()).filter(Boolean),
          isActive,
        });
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
          <input
            type="text"
            value={name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Faixa Etária</label>
          <input
            type="text"
            value={ageRange}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAgeRange(e.target.value)}
            placeholder="25-35"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Gênero</label>
          <select
            value={gender}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setGender(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
          >
            <option value="">—</option>
            <option value="F">Feminino</option>
            <option value="M">Masculino</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Profissão</label>
          <input
            type="text"
            value={occupation}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOccupation(e.target.value)}
            placeholder="Professora, Engenheiro..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Estilo de Comunicação</label>
        <div className="flex gap-3">
          {(["formal", "casual", "anxious"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStyle(s)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors border",
                style === s ? "border-green-500 bg-green-50 text-green-700" : "border-gray-200 text-gray-600 hover:bg-gray-50",
              )}
            >
              {styleBadge[s].label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Cenários (um por linha)
        </label>
        <textarea
          value={scenarios}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setScenarios(e.target.value)}
          rows={4}
          placeholder={"Meu médico receitou ontem\nPreciso para minha mãe\nVi na internet que é bom para..."}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIsActive(e.target.checked)}
          id="persona-active"
          className="rounded border-gray-300 text-green-600 focus:ring-green-500"
        />
        <label htmlFor="persona-active" className="text-sm text-gray-700">Ativa</label>
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
          disabled={isPending || !name}
          className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          {isPending ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </form>
  );
}
