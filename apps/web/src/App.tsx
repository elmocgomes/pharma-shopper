import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/Login";
import { DashboardPage } from "./pages/Dashboard";
import { WhatsAppPage } from "./pages/WhatsApp";
import { PersonasPage } from "./pages/Personas";
import { PharmaciesPage } from "./pages/Pharmacies";
import { ProductsPage } from "./pages/Products";
import { CampaignsPage } from "./pages/Campaigns";
import { ConversationThreadPage } from "./pages/ConversationThread";
import { PricesPage } from "./pages/Prices";
import { SettingsPage } from "./pages/Settings";
import { FlowsPage } from "./pages/Flows";
import { AgentsPage } from "./pages/Agents";
import { LogsPage } from "./pages/Logs";
import { MessageExchangePage } from "./pages/MessageExchange";
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
        <Route path="/whatsapp" element={<WhatsAppPage />} />
        <Route path="/personas" element={<PersonasPage />} />
        <Route path="/pharmacies" element={<PharmaciesPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/campaigns" element={<CampaignsPage />} />
        <Route path="/conversations/:id" element={<ConversationThreadPage />} />
        <Route path="/flows" element={<FlowsPage />} />
        <Route path="/agents" element={<AgentsPage />} />
        <Route path="/prices" element={<PricesPage />} />
        <Route path="/logs" element={<LogsPage />} />
        <Route path="/messages" element={<MessageExchangePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
