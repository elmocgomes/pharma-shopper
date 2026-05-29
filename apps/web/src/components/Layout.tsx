import { Outlet, NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  MessageCircle,
  Users,
  Building2,
  Package,
  Megaphone,
  TrendingUp,
  Settings,
  LogOut,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { cn } from "../lib/utils";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/whatsapp", icon: MessageCircle, label: "WhatsApp" },
  { to: "/personas", icon: Users, label: "Personas" },
  { to: "/pharmacies", icon: Building2, label: "Farmácias" },
  { to: "/products", icon: Package, label: "Produtos" },
  { to: "/campaigns", icon: Megaphone, label: "Campanhas" },
  { to: "/prices", icon: TrendingUp, label: "Preços" },
  { to: "/settings", icon: Settings, label: "Configurações" },
];

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-green-700">
            💊 Pharma Shopper
          </h1>
          <p className="text-xs text-gray-500 mt-1">Mystery Shopping Platform</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-green-50 text-green-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                )
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <p className="font-medium text-gray-900">{user?.name}</p>
              <p className="text-gray-500 text-xs">{user?.email}</p>
            </div>
            <button
              onClick={logout}
              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
