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
  { to: "/send", label: "Send message", icon: Send, emphasis: true },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="flex flex-1 min-h-0">
      <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200/70 bg-gradient-to-b from-white via-white to-surface-50">
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-100">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#25D366] text-white shadow-[0_8px_20px_-6px_rgba(37,211,102,0.55)] ring-1 ring-inset ring-white/20">
            <WhatsAppIcon className="h-6 w-6" />
          </div>
          <div>
            <div className="text-[15px] font-semibold leading-tight text-slate-900">
              Reform Hotel
            </div>
            <div className="text-[11px] uppercase tracking-wide text-brand-700/80 font-medium">
              Guest messaging
            </div>
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
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                  isActive
                    ? "bg-brand-50 text-brand-800 shadow-[inset_2px_0_0_theme(colors.brand.500)]"
                    : "text-slate-700 hover:bg-slate-100/80",
                  n.emphasis && !isActive &&
                    "text-brand-800 hover:bg-brand-50/60",
                )
              }
            >
              <n.icon
                className={cn(
                  "h-4 w-4 transition",
                  n.emphasis && "text-brand-600",
                )}
              />
              {n.label}
              {n.emphasis && (
                <span className="ml-auto rounded-full bg-accent-100 px-1.5 py-[1px] text-[10px] font-semibold uppercase tracking-wide text-accent-700">
                  New
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-100 p-3">
          <div className="px-3 pb-2 text-xs text-slate-500 truncate">
            {user?.email}
          </div>
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
