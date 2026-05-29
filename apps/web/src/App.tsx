import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/Login";
import { DashboardPage } from "./pages/Dashboard";
import { useAuth } from "./hooks/useAuth";

export function App() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/whatsapp" element={<Placeholder title="WhatsApp Numbers" />} />
        <Route path="/personas" element={<Placeholder title="Personas" />} />
        <Route path="/pharmacies" element={<Placeholder title="Farmácias" />} />
        <Route path="/products" element={<Placeholder title="Produtos" />} />
        <Route path="/campaigns" element={<Placeholder title="Campanhas" />} />
        <Route path="/prices" element={<Placeholder title="Análise de Preços" />} />
        <Route path="/settings" element={<Placeholder title="Configurações" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-gray-400 text-lg">{title} — Sprint 1</p>
    </div>
  );
}
