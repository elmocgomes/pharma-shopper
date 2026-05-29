import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Search, BarChart3, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

const BR_STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
] as const;

interface Product { id: string; name: string; }
interface PriceSummary {
  productId: string;
  productName: string;
  avgPrice: string;
  minPrice: string;
  maxPrice: string;
  count: number;
  inStock: number;
  outOfStock: number;
  genericCount: number;
  brandCount: number;
}
interface StatePrice {
  state: string | null;
  avgPrice: string;
  minPrice: string;
  maxPrice: string;
  count: number;
}
interface ComparisonRow {
  productName: string;
  pharmacyName: string;
  pharmacyState: string | null;
  pharmacyCity: string | null;
  price: string;
  availability: string;
  isGeneric: boolean;
  brand: string | null;
  collectedAt: string;
}

export function PricesPage() {
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [tab, setTab] = useState<"summary" | "comparison" | "states">("summary");

  const { data: productsData } = useQuery({
    queryKey: ["products-list"],
    queryFn: () => api.get<{ data: Product[] }>("/products?limit=100"),
  });

  const { data: summaryData } = useQuery({
    queryKey: ["price-summary", selectedState],
    queryFn: () => {
      const params = selectedState ? `?state=${selectedState}` : "";
      return api.get<{ data: PriceSummary[] }>(`/prices/summary${params}`);
    },
  });

  const { data: stateData } = useQuery({
    queryKey: ["price-by-state", selectedProduct],
    queryFn: () => {
      const params = selectedProduct ? `?product=${selectedProduct}` : "";
      return api.get<{ data: StatePrice[] }>(`/prices/by-state${params}`);
    },
  });

  const { data: comparisonData } = useQuery({
    queryKey: ["price-comparison", selectedProduct, selectedState],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedProduct) params.set("product", selectedProduct);
      if (selectedState) params.set("state", selectedState);
      return api.get<{ data: ComparisonRow[] }>(`/prices/comparison?${params}`);
    },
    enabled: tab === "comparison",
  });

  const products = productsData?.data ?? [];
  const summary = summaryData?.data ?? [];
  const stateStats = stateData?.data ?? [];
  const comparison = comparisonData?.data ?? [];

  const handleExport = () => {
    const params = new URLSearchParams();
    if (selectedProduct) params.set("product", selectedProduct);
    if (selectedState) params.set("state", selectedState);
    const token = localStorage.getItem("token");
    window.open(`/api/prices/export?${params}&token=${token}`, "_blank");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analise de Precos</h1>
          <p className="text-sm text-gray-500 mt-1">Comparacao de precos e disponibilidade</p>
        </div>
        <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
          <Download className="w-4 h-4" />
          Exportar CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <select
          value={selectedProduct}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedProduct(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
        >
          <option value="">Todos os Produtos</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select
          value={selectedState}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedState(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
        >
          <option value="">Todos os Estados</option>
          {BR_STATES.map((st) => <option key={st} value={st}>{st}</option>)}
        </select>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 max-w-md">
        {([
          { key: "summary", label: "Resumo", icon: BarChart3 },
          { key: "comparison", label: "Comparacao", icon: Search },
          { key: "states", label: "Por Estado", icon: TrendingUp },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              tab === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700",
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Summary Tab */}
      {tab === "summary" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {summary.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">Nenhum preco coletado ainda</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-4 py-3 text-right">Preco Medio</th>
                  <th className="px-4 py-3 text-right">Min</th>
                  <th className="px-4 py-3 text-right">Max</th>
                  <th className="px-4 py-3 text-right">Amostras</th>
                  <th className="px-4 py-3 text-right">Em Estoque</th>
                  <th className="px-4 py-3 text-right">Generico</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {summary.map((s) => (
                  <tr key={s.productId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{s.productName}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-700">R$ {Number(s.avgPrice).toFixed(2).replace(".", ",")}</td>
                    <td className="px-4 py-3 text-right text-gray-600">R$ {Number(s.minPrice).toFixed(2).replace(".", ",")}</td>
                    <td className="px-4 py-3 text-right text-gray-600">R$ {Number(s.maxPrice).toFixed(2).replace(".", ",")}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{s.count}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-green-600">{s.inStock}</span>
                      <span className="text-gray-400"> / </span>
                      <span className="text-red-500">{s.outOfStock}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-blue-600">{s.genericCount}</span>
                      <span className="text-gray-400"> / </span>
                      <span className="text-purple-600">{s.brandCount}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Comparison Tab */}
      {tab === "comparison" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {comparison.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">Selecione um produto para comparar precos</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3">Farmacia</th>
                  <th className="px-4 py-3">Cidade/UF</th>
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-4 py-3 text-right">Preco</th>
                  <th className="px-4 py-3">Disponibilidade</th>
                  <th className="px-4 py-3">Tipo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {comparison.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{r.pharmacyName}</td>
                    <td className="px-4 py-3 text-gray-600">{r.pharmacyCity}/{r.pharmacyState}</td>
                    <td className="px-4 py-3 text-gray-600">{r.productName}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-700">R$ {Number(r.price).toFixed(2).replace(".", ",")}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-xs font-medium",
                        r.availability === "in_stock" ? "bg-green-100 text-green-700" : r.availability === "out_of_stock" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600",
                      )}>
                        {r.availability === "in_stock" ? "Em estoque" : r.availability === "out_of_stock" ? "Em falta" : r.availability}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2 py-0.5 rounded text-xs font-medium", r.isGeneric ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700")}>
                        {r.isGeneric ? "Generico" : r.brand || "Marca"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* By State Tab */}
      {tab === "states" && (
        <div className="space-y-4">
          {stateStats.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-4">Preco Medio por Estado</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stateStats.filter((s) => s.state)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="state" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: number) => [`R$ ${Number(value).toFixed(2)}`, "Preco Medio"]} />
                  <Bar dataKey="avgPrice" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {stateStats.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">Nenhum dado por estado</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Preco Medio</th>
                    <th className="px-4 py-3 text-right">Min</th>
                    <th className="px-4 py-3 text-right">Max</th>
                    <th className="px-4 py-3 text-right">Amostras</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {stateStats.map((s) => (
                    <tr key={s.state || "null"} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{s.state || "N/D"}</td>
                      <td className="px-4 py-3 text-right font-semibold text-green-700">R$ {Number(s.avgPrice).toFixed(2).replace(".", ",")}</td>
                      <td className="px-4 py-3 text-right text-gray-600">R$ {Number(s.minPrice).toFixed(2).replace(".", ",")}</td>
                      <td className="px-4 py-3 text-right text-gray-600">R$ {Number(s.maxPrice).toFixed(2).replace(".", ",")}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{s.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
