import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Send,
  BarChart3,
  Settings,
  LogOut,
  FileText,
} from "lucide-react";
import { useAuth } from "../state/auth.js";
import { cn } from "../lib/cn.js";
import { WhatsAppIcon } from "./WhatsAppIcon.js";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/guests", label: "Guests", icon: Users },
  { to: "/templates", label: "Templates", icon: FileText },
  { to: "/send", label: "Send message", icon: Send },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="flex flex-1 min-h-0">
      <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center gap-2.5 px-6 py-5 border-b border-slate-100">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#25D366] text-white shadow-sm">
            <WhatsAppIcon className="h-[22px] w-[22px]" />
          </div>
          <div>
            <div className="text-sm font-semibold">Reform Hotel</div>
            <div className="text-xs text-slate-500">WhatsApp guest messaging</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
                  isActive
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-700 hover:bg-slate-100",
                )
              }
            >
              <n.icon className="h-4 w-4" />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-100 p-3">
          <div className="px-3 pb-2 text-xs text-slate-500">{user?.email}</div>
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
