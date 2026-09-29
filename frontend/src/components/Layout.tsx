import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import QuickAddModal from "./QuickAddModal";
import Icon, { IconName } from "./Icon";

type NavItem = { to: string; label: string; icon: IconName; end?: boolean };
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Money",
    items: [
      { to: "/", label: "Overview", icon: "home", end: true },
      { to: "/transactions", label: "Transactions", icon: "list" },
      { to: "/calendar", label: "Calendar", icon: "calendar" },
      { to: "/commitments", label: "Commitments", icon: "repeat" },
    ],
  },
  {
    label: "Organize",
    items: [
      { to: "/review", label: "Review Inbox", icon: "flag" },
      { to: "/goals", label: "Goals", icon: "target" },
      { to: "/accounts", label: "Accounts", icon: "wallet" },
      { to: "/people", label: "People", icon: "users" },
    ],
  },
  {
    label: "Manage",
    items: [
      { to: "/rules", label: "Rules", icon: "sliders" },
      { to: "/imports", label: "Imports", icon: "upload" },
      { to: "/categories", label: "Categories", icon: "tag" },
    ],
  },
];

const MOBILE_ITEMS: NavItem[] = [
  { to: "/", label: "Home", icon: "home", end: true },
  { to: "/transactions", label: "Transactions", icon: "list" },
  { to: "/calendar", label: "Calendar", icon: "calendar" },
  { to: "/more", label: "More", icon: "grid" },
];

export default function Layout() {
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark"><Icon name="wallet" size={18} /></span>
          <div>
            <p className="text-sm font-semibold leading-tight">Money Ledger</p>
            <p className="text-[11px] text-muted mt-0.5">Personal finance</p>
          </div>
        </div>

        <nav className="flex-1 px-3 pb-4 overflow-y-auto">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="sidebar-section-label">{group.label}</p>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => `sidebar-link ${isActive ? "sidebar-link-active" : ""}`}
                  >
                    <Icon name={item.icon} size={18} />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-line">
          <button className="btn-primary w-full" onClick={() => setQuickAddOpen(true)}>
            <Icon name="plus" size={17} /> Add transaction
          </button>
          <p className="mt-3 text-[11px] text-center text-muted">Local-first money tracking</p>
        </div>
      </aside>

      <div className="main-column">
        <header className="mobile-topbar">
          <div className="flex items-center gap-2.5">
            <span className="brand-mark !w-8 !h-8"><Icon name="wallet" size={16} /></span>
            <div>
              <p className="text-sm font-semibold leading-tight">Money Ledger</p>
              <p className="text-[10px] text-muted">Personal finance</p>
            </div>
          </div>
          <button className="btn-icon bg-accent/10 !text-accent" onClick={() => setQuickAddOpen(true)} aria-label="Add transaction">
            <Icon name="plus" size={19} />
          </button>
        </header>

        <main className="page-container">
          <Outlet />
        </main>

        <nav className="mobile-bottom-nav">
          <div className="flex items-center gap-1 max-w-lg mx-auto">
            {MOBILE_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `mobile-nav-link ${isActive ? "mobile-nav-active" : ""}`}
              >
                <Icon name={item.icon} size={19} />
                <span className="truncate max-w-full">{item.label}</span>
              </NavLink>
            ))}
            <button
              className="ml-1 w-12 h-12 rounded-2xl bg-accent text-white flex items-center justify-center shadow-lg shadow-indigo-200 shrink-0"
              onClick={() => setQuickAddOpen(true)}
              aria-label="Add transaction"
            >
              <Icon name="plus" size={21} />
            </button>
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
