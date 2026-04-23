import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  ListFilter,
  Send,
  BarChart3,
  Settings,
  LogOut,
  FileText,
  Menu,
  X,
  ChevronsLeft,
  ChevronsRight,
  Blocks,
} from "lucide-react";
import { useAuth } from "../state/auth.js";
import { cn } from "../lib/cn.js";
import { WhatsAppIcon } from "./WhatsAppIcon.js";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/send", label: "Send message", icon: Send, emphasis: true },
  { to: "/contacts", label: "Contacts", icon: Users },
  { to: "/audiences", label: "Audiences", icon: ListFilter },
  { to: "/templates", label: "Templates", icon: FileText },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/modules", label: "Modules", icon: Blocks },
  { to: "/settings", label: "Settings", icon: Settings },
];

const COLLAPSED_KEY = "hms-sidebar-collapsed";

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () =>
      typeof localStorage !== "undefined" &&
      localStorage.getItem(COLLAPSED_KEY) === "1",
  );

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // ESC closes the drawer.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  // Freeze body scroll while the drawer is open so the page behind doesn't
  // scroll under the backdrop.
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // quota — ignore
      }
      return next;
    });
  }

  return (
    <div className="flex flex-1 min-h-0">
      {/* Mobile backdrop */}
      <div
        onClick={() => setMobileOpen(false)}
        className={cn(
          "lg:hidden fixed inset-0 bg-slate-900/40 z-40 transition-opacity duration-200",
          mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        aria-hidden
      />

      {/* Sidebar — drawer on mobile, collapsible on desktop */}
      <aside
        className={cn(
          "flex flex-col border-r border-slate-200/70 bg-gradient-to-b from-white via-white to-surface-50 shrink-0",
          "fixed lg:static inset-y-0 left-0 z-50 lg:z-auto w-64",
          "transition-[transform,width] duration-200 ease-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          collapsed ? "lg:w-[72px]" : "lg:w-64",
        )}
        aria-label="Primary navigation"
      >
        {/* Brand */}
        <div
          className={cn(
            "flex items-center gap-3 border-b border-slate-100 px-5 py-5",
            collapsed && "lg:justify-center lg:gap-0 lg:px-3",
          )}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#25D366] text-white shadow-[0_8px_20px_-6px_rgba(37,211,102,0.55)] ring-1 ring-inset ring-white/20 shrink-0">
            <WhatsAppIcon className="h-6 w-6" />
          </div>
          <div className={cn("flex-1 min-w-0", collapsed && "lg:hidden")}>
            <div className="text-[15px] font-semibold leading-tight text-slate-900 truncate">
              Reform Hotel
            </div>
            <div className="text-[11px] uppercase tracking-wide text-brand-700/80 font-medium">
              Customer messaging
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden -mr-1 p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              title={collapsed ? n.label : undefined}
              className={({ isActive }) =>
                cn(
                  "group relative flex items-center gap-3 rounded-lg text-sm font-medium transition",
                  collapsed
                    ? "lg:justify-center lg:px-2 lg:py-2 px-3 py-2"
                    : "px-3 py-2",
                  isActive
                    ? "bg-brand-50 text-brand-800 shadow-[inset_2px_0_0_theme(colors.brand.500)]"
                    : "text-slate-700 hover:bg-slate-100/80",
                  n.emphasis && !isActive && "text-brand-800 hover:bg-brand-50/60",
                )
              }
            >
              <n.icon
                className={cn(
                  "h-4 w-4 shrink-0 transition",
                  n.emphasis && "text-brand-600",
                )}
              />
              <span className={cn("truncate", collapsed && "lg:hidden")}>
                {n.label}
              </span>
              {n.emphasis && (
                <span
                  className={cn(
                    "ml-auto rounded-full bg-accent-100 px-1.5 py-[1px] text-[10px] font-semibold uppercase tracking-wide text-accent-700",
                    collapsed && "lg:hidden",
                  )}
                >
                  New
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-slate-100 p-3 space-y-1">
          <div
            className={cn(
              "px-3 pb-2 text-xs text-slate-500 truncate",
              collapsed && "lg:hidden",
            )}
          >
            {user?.email}
          </div>
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            title={collapsed ? "Sign out" : undefined}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100",
              collapsed
                ? "lg:justify-center lg:px-2 lg:py-2 px-3 py-2"
                : "px-3 py-2",
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className={cn(collapsed && "lg:hidden")}>Sign out</span>
          </button>
          <button
            onClick={toggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "hidden lg:flex w-full items-center gap-3 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700",
              collapsed ? "justify-center px-2 py-2" : "px-3 py-2",
            )}
          >
            {collapsed ? (
              <ChevronsRight className="h-4 w-4 shrink-0" />
            ) : (
              <>
                <ChevronsLeft className="h-4 w-4 shrink-0" />
                Collapse
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex flex-1 min-w-0 flex-col">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white/90 px-3 backdrop-blur">
          <button
            onClick={() => setMobileOpen(true)}
            className="-ml-1 rounded-lg p-2 text-slate-700 hover:bg-slate-100"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#25D366] text-white shadow-sm">
              <WhatsAppIcon className="h-[18px] w-[18px]" />
            </div>
            <div className="text-sm font-semibold text-slate-900">
              Reform Hotel
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
