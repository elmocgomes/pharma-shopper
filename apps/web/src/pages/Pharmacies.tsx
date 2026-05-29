import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Upload, Edit2, Trash2, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

const BR_STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
] as const;

interface Pharmacy {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  phone: string | null;
  whatsappNumber: string;
  chain: string | null;
  lat: string | null;
  lng: string | null;
  source: string | null;
  notes: string | null;
}

type PharmacyForm = Omit<Pharmacy, "id">;

export function PharmaciesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Pharmacy | null>(null);
  const [showImport, setShowImport] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["pharmacies", page, search, stateFilter],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: "25" });
      if (search) params.set("q", search);
      if (stateFilter) params.set("state", stateFilter);
      return api.get<{ data: Pharmacy[]; total: number; page: number; limit: number }>(
        `/pharmacies?${params}`,
      );
    },
  });

  const createMut = useMutation({
    mutationFn: (body: PharmacyForm) => api.post("/pharmacies", body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pharmacies"] }); setShowCreate(false); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...body }: PharmacyForm & { id: string }) => api.put(`/pharmacies/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pharmacies"] }); setEditing(null); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/pharmacies/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pharmacies"] }),
  });

  const importMut = useMutation({
    mutationFn: (rows: PharmacyForm[]) => api.post("/pharmacies/import", { rows }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pharmacies"] }); setShowImport(false); },
  });

  const pharmacies = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 25);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Farmácias</h1>
          <p className="text-sm text-gray-500 mt-1">{total} farmácias cadastradas</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            <Upload className="w-4 h-4" />
            Importar CSV
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Nova Farmácia
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar farmácia..."
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>
        <select
          value={stateFilter}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setStateFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
        >
          <option value="">Todos os estados</option>
          {BR_STATES.map((st) => (
            <option key={st} value={st}>{st}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="text-center py-12 text-gray-400">Carregando...</div>
        ) : pharmacies.length === 0 ? (
          <div className="text-center py-12 text-gray-400">Nenhuma farmácia encontrada</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">WhatsApp</th>
                <th className="px-4 py-3">Cidade</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Rede</th>
                <th className="px-4 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pharmacies.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                  <td className="px-4 py-3 text-gray-600">{p.whatsappNumber}</td>
                  <td className="px-4 py-3 text-gray-600">{p.city || "—"}</td>
                  <td className="px-4 py-3">
                    {p.state ? (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-medium">{p.state}</span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.chain || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => setEditing(p)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteMut.mutate(p.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Mostrando {(page - 1) * 25 + 1}–{Math.min(page * 25, total)} de {total}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
              className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages}
              className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreate || editing) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setShowCreate(false); setEditing(null); }}>
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">{editing ? "Editar Farmácia" : "Nova Farmácia"}</h2>
            <PharmacyFormComponent
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

      {/* CSV Import Modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowImport(false)}>
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-2">Importar CSV</h2>
            <p className="text-sm text-gray-500 mb-4">
              Cole dados CSV (nome, whatsapp, cidade, estado, rede). Primeira linha = cabeçalho.
            </p>
            <CsvImport
              onImport={(rows) => importMut.mutate(rows)}
              isPending={importMut.isPending}
              onCancel={() => setShowImport(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function PharmacyFormComponent({
  initial,
  onSubmit,
  isPending,
  onCancel,
}: {
  initial?: Pharmacy;
  onSubmit: (data: PharmacyForm) => void;
  isPending: boolean;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<PharmacyForm>({
    name: initial?.name ?? "",
    address: initial?.address ?? null,
    city: initial?.city ?? null,
    state: initial?.state ?? null,
    zipCode: initial?.zipCode ?? null,
    phone: initial?.phone ?? null,
    whatsappNumber: initial?.whatsappNumber ?? "",
    chain: initial?.chain ?? null,
    lat: initial?.lat ?? null,
    lng: initial?.lng ?? null,
    source: initial?.source ?? null,
    notes: initial?.notes ?? null,
  });

  const set = (key: keyof PharmacyForm, value: string) =>
    setForm((f) => ({ ...f, [key]: value || null }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
        <input type="text" value={form.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set("name", e.target.value)} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp *</label>
        <input type="text" value={form.whatsappNumber} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set("whatsappNumber", e.target.value)} required placeholder="+5511999999999" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
          <input type="text" value={form.city ?? ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set("city", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
          <select value={form.state ?? ""} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set("state", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500">
            <option value="">—</option>
            {BR_STATES.map((st) => <option key={st} value={st}>{st}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Rede</label>
          <input type="text" value={form.chain ?? ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set("chain", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
          <input type="text" value={form.phone ?? ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set("phone", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
        <input type="text" value={form.address ?? ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set("address", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500" />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">Cancelar</button>
        <button type="submit" disabled={isPending || !form.name || !form.whatsappNumber} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50">{isPending ? "Salvando..." : "Salvar"}</button>
      </div>
    </form>
  );
}

function CsvImport({
  onImport,
  isPending,
  onCancel,
}: {
  onImport: (rows: PharmacyForm[]) => void;
  isPending: boolean;
  onCancel: () => void;
}) {
  const [csv, setCsv] = useState("");
  const [parsed, setParsed] = useState<PharmacyForm[]>([]);

  const parse = () => {
    const lines = csv.trim().split("\n");
    if (lines.length < 2) return;
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const rows: PharmacyForm[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim());
      const row: Record<string, string | null> = {};
      headers.forEach((h, j) => { row[h] = cols[j] || null; });
      if (row.name && row.whatsapp_number) {
        rows.push({
          name: row.name!,
          whatsappNumber: row.whatsapp_number!,
          city: row.city || null,
          state: row.state || null,
          chain: row.chain || null,
          address: row.address || null,
          zipCode: row.zip_code || null,
          phone: row.phone || null,
          lat: null,
          lng: null,
          source: "csv",
          notes: null,
        });
      }
    }
    setParsed(rows);
  };

  return (
    <div className="space-y-4">
      <textarea
        value={csv}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCsv(e.target.value)}
        rows={8}
        placeholder="name,whatsapp_number,city,state,chain&#10;Farmácia Popular,+5511999999999,São Paulo,SP,Rede Pop"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-green-500 focus:border-green-500"
      />
      {parsed.length > 0 && (
        <p className="text-sm text-green-600">{parsed.length} farmácias prontas para importar</p>
      )}
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">Cancelar</button>
        {parsed.length === 0 ? (
          <button type="button" onClick={parse} disabled={!csv.trim()} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">Validar</button>
        ) : (
          <button type="button" onClick={() => onImport(parsed)} disabled={isPending} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50">{isPending ? "Importando..." : `Importar ${parsed.length}`}</button>
        )}
      </div>
    </div>
  );
}
