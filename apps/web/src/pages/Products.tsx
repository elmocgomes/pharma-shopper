import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Upload, Edit2, Trash2, Search, ChevronLeft, ChevronRight, Pill } from "lucide-react";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

interface Product {
  id: string;
  name: string;
  activeIngredient: string | null;
  presentation: string | null;
  anvisaCode: string | null;
  category: string | null;
  isGeneric: boolean;
}

type ProductForm = Omit<Product, "id">;

export function ProductsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [anvisaSearch, setAnvisaSearch] = useState("");
  const [genericFilter, setGenericFilter] = useState<string>("");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [showImport, setShowImport] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["products", page, search, anvisaSearch, genericFilter],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: "25" });
      if (search) params.set("q", search);
      if (anvisaSearch) params.set("anvisa", anvisaSearch);
      if (genericFilter) params.set("generic", genericFilter);
      return api.get<{ data: Product[]; total: number }>(`/products?${params}`);
    },
  });

  const createMut = useMutation({
    mutationFn: (body: ProductForm) => api.post("/products", body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); setShowCreate(false); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...body }: ProductForm & { id: string }) => api.put(`/products/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); setEditing(null); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });

  const importMut = useMutation({
    mutationFn: (rows: ProductForm[]) => api.post("/products/import", { rows }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); setShowImport(false); },
  });

  const products = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 25);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Produtos</h1>
          <p className="text-sm text-gray-500 mt-1">{total} produtos cadastrados</p>
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
            Novo Produto
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar produto..."
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>
        <div className="relative max-w-xs">
          <Pill className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={anvisaSearch}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setAnvisaSearch(e.target.value); setPage(1); }}
            placeholder="Código ANVISA"
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>
        <select
          value={genericFilter}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setGenericFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
        >
          <option value="">Todos</option>
          <option value="true">Genéricos</option>
          <option value="false">Marca</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="text-center py-12 text-gray-400">Carregando...</div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 text-gray-400">Nenhum produto encontrado</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Princípio Ativo</th>
                <th className="px-4 py-3">Apresentação</th>
                <th className="px-4 py-3">ANVISA</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                  <td className="px-4 py-3 text-gray-600">{p.activeIngredient || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{p.presentation || "—"}</td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{p.anvisaCode || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-xs font-medium",
                      p.isGeneric ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700",
                    )}>
                      {p.isGeneric ? "Genérico" : "Marca"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => setEditing(p)} className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteMut.mutate(p.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
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
            <button onClick={() => setPage(page - 1)} disabled={page <= 1} className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setPage(page + 1)} disabled={page >= totalPages} className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreate || editing) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setShowCreate(false); setEditing(null); }}>
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">{editing ? "Editar Produto" : "Novo Produto"}</h2>
            <ProductFormComponent
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
            <p className="text-sm text-gray-500 mb-4">Cole dados CSV. Colunas: name, active_ingredient, presentation, anvisa_code, category, is_generic</p>
            <CsvImport onImport={(rows) => importMut.mutate(rows)} isPending={importMut.isPending} onCancel={() => setShowImport(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

function ProductFormComponent({
  initial,
  onSubmit,
  isPending,
  onCancel,
}: {
  initial?: Product;
  onSubmit: (data: ProductForm) => void;
  isPending: boolean;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [activeIngredient, setActiveIngredient] = useState(initial?.activeIngredient ?? "");
  const [presentation, setPresentation] = useState(initial?.presentation ?? "");
  const [anvisaCode, setAnvisaCode] = useState(initial?.anvisaCode ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [isGeneric, setIsGeneric] = useState(initial?.isGeneric ?? false);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          name,
          activeIngredient: activeIngredient || null,
          presentation: presentation || null,
          anvisaCode: anvisaCode || null,
          category: category || null,
          isGeneric,
        });
      }}
      className="space-y-4"
    >
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
        <input type="text" value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Princípio Ativo</label>
          <input type="text" value={activeIngredient} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setActiveIngredient(e.target.value)} placeholder="Losartana potássica" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Apresentação</label>
          <input type="text" value={presentation} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPresentation(e.target.value)} placeholder="50mg, 30 comprimidos" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Código ANVISA</label>
          <input type="text" value={anvisaCode} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAnvisaCode(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
          <input type="text" value={category} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCategory(e.target.value)} placeholder="Anti-hipertensivo" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={isGeneric} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIsGeneric(e.target.checked)} id="product-generic" className="rounded border-gray-300 text-green-600 focus:ring-green-500" />
        <label htmlFor="product-generic" className="text-sm text-gray-700">Genérico</label>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">Cancelar</button>
        <button type="submit" disabled={isPending || !name} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50">{isPending ? "Salvando..." : "Salvar"}</button>
      </div>
    </form>
  );
}

function CsvImport({
  onImport,
  isPending,
  onCancel,
}: {
  onImport: (rows: ProductForm[]) => void;
  isPending: boolean;
  onCancel: () => void;
}) {
  const [csv, setCsv] = useState("");
  const [parsed, setParsed] = useState<ProductForm[]>([]);

  const parse = () => {
    const lines = csv.trim().split("\n");
    if (lines.length < 2) return;
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const rows: ProductForm[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim());
      const row: Record<string, string | null> = {};
      headers.forEach((h, j) => { row[h] = cols[j] || null; });
      if (row.name) {
        rows.push({
          name: row.name!,
          activeIngredient: row.active_ingredient || null,
          presentation: row.presentation || null,
          anvisaCode: row.anvisa_code || null,
          category: row.category || null,
          isGeneric: row.is_generic === "true" || row.is_generic === "1",
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
        placeholder="name,active_ingredient,presentation,anvisa_code,category,is_generic&#10;Losartana 50mg,Losartana potássica,50mg 30 comp,,Anti-hipertensivo,true"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-green-500 focus:border-green-500"
      />
      {parsed.length > 0 && <p className="text-sm text-green-600">{parsed.length} produtos prontos para importar</p>}
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
