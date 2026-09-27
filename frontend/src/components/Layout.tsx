import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import QuickAddModal from "./QuickAddModal";
import Icon, { IconName } from "./Icon";

type NavItem = { to: string; label: string; icon: IconName; end?: boolean };

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", icon: "home", end: true },
  { to: "/transactions", label: "Transactions", icon: "list" },
  { to: "/review", label: "Review Inbox", icon: "flag" },
  { to: "/commitments", label: "Commitments", icon: "repeat" },
  { to: "/goals", label: "Goals", icon: "target" },
  { to: "/accounts", label: "Accounts", icon: "wallet" },
  { to: "/people", label: "People", icon: "users" },
  { to: "/rules", label: "Rules", icon: "sliders" },
  { to: "/imports", label: "Imports", icon: "upload" },
  { to: "/categories", label: "Categories", icon: "tag" },
];

const MOBILE_ITEMS: { to: string; label: string; icon: IconName }[] = [
  { to: "/", label: "Home", icon: "home" },
  { to: "/transactions", label: "Spend", icon: "list" },
  { to: "/commitments", label: "Commit", icon: "repeat" },
  { to: "/more", label: "More", icon: "grid" },
];

export default function Layout() {
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex flex-col border-r border-line bg-white transition-all ${collapsed ? "w-16" : "w-64"}`}
      >
        <div className="flex items-center justify-between px-4 h-14 border-b border-line">
          {!collapsed && (
            <span className="flex items-center gap-2 font-semibold text-sm">
              <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent to-accent2 flex items-center justify-center text-white">
                <Icon name="wallet" size={15} />
              </span>
              Finance Tracker
            </span>
          )}
          <button className="text-muted hover:text-ink text-xs" onClick={() => setCollapsed((c) => !c)}>
            {collapsed ? "»" : "«"}
          </button>
        </div>
        <nav className="flex-1 py-3 px-2 overflow-y-auto space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                  isActive ? "bg-ink text-white" : "text-ink/75 hover:bg-gray-100"
                }`
              }
              title={item.label}
            >
              <Icon name={item.icon} size={18} className="shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-line">
          <button className="btn-primary w-full gap-2" onClick={() => setQuickAddOpen(true)}>
            <Icon name="plus" size={16} />
            {!collapsed && "Quick Add"}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between h-14 px-4 border-b border-line bg-white sticky top-0 z-10">
          <span className="flex items-center gap-2 font-semibold text-sm">
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent to-accent2 flex items-center justify-center text-white">
              <Icon name="wallet" size={15} />
            </span>
            Finance Tracker
          </span>
          <button
            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-ink/70"
            onClick={() => setQuickAddOpen(true)}
            aria-label="Quick add transaction"
          >
            <Icon name="plus" size={18} />
          </button>
        </header>
        <main className="flex-1 p-4 md:p-6 pb-28 md:pb-6 max-w-6xl w-full mx-auto">
          <Outlet />
        </main>

        {/* Mobile bottom nav - floating pill bar with a raised gradient FAB,
            matching the app's new visual language while staying a plain
            4-item + center action layout (no new nav semantics). */}
        <nav className="md:hidden fixed bottom-3 inset-x-3 z-20">
          <div className="nav-pill-bar">
            {MOBILE_ITEMS.slice(0, 2).map((item) => (
              <MobileNavLink key={item.to} to={item.to} label={item.label} icon={item.icon} />
            ))}
            <button
              className="flex-1 flex flex-col items-center justify-center text-white bg-gradient-to-br from-accent to-accent2 rounded-xl mx-0.5 shadow-hero"
              onClick={() => setQuickAddOpen(true)}
              aria-label="Quick add transaction"
            >
              <Icon name="plus" size={20} />
            </button>
            {MOBILE_ITEMS.slice(2).map((item) => (
              <MobileNavLink key={item.to} to={item.to} label={item.label} icon={item.icon} />
            ))}
          </div>
        </nav>
      </div>

      {quickAddOpen && (
        <QuickAddModal
          onClose={() => setQuickAddOpen(false)}
          onCreated={(id) => {
            setQuickAddOpen(false);
            navigate(`/transactions?highlight=${id}`);
          }}
        />
      )}
    </div>
  );
}

function MobileNavLink({ to, label, icon }: { to: string; label: string; icon: IconName }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        `flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl text-[11px] font-medium transition-colors ${
          isActive ? "text-accent bg-accent/10" : "text-muted"
        }`
      }
    >
      <Icon name={icon} size={19} />
      {label}
    </NavLink>
  );
}
