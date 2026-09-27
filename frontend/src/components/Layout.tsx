import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import QuickAddModal from "./QuickAddModal";

type NavItem = { to: string; label: string; icon: string; end?: boolean };

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

const MOBILE_ITEMS = [
  { to: "/", label: "Home" },
  { to: "/transactions", label: "Transactions" },
  { to: "/commitments", label: "Commitments" },
  { to: "/more", label: "More" },
];

export default function Layout() {
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex flex-col border-r border-line bg-white transition-all ${collapsed ? "w-16" : "w-60"}`}
      >
        <div className="flex items-center justify-between px-4 h-14 border-b border-line">
          {!collapsed && <span className="font-semibold text-sm">Finance Tracker</span>}
          <button className="text-muted hover:text-ink text-xs" onClick={() => setCollapsed((c) => !c)}>
            {collapsed ? "»" : "«"}
          </button>
        </div>
        <nav className="flex-1 py-2 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 mx-2 my-0.5 px-3 py-2 rounded-lg text-sm font-medium ${
                  isActive ? "bg-ink text-white" : "text-ink/80 hover:bg-gray-100"
                }`
              }
              title={item.label}
            >
              <span className="w-2 h-2 rounded-full bg-current opacity-60 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-line">
          <button className="btn-primary w-full" onClick={() => setQuickAddOpen(true)}>
            {collapsed ? "+" : "+ Quick Add"}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between h-14 px-4 border-b border-line bg-white sticky top-0 z-10">
          <span className="font-semibold text-sm">Finance Tracker</span>
        </header>
        <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6 max-w-6xl w-full mx-auto">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-line flex items-stretch h-16 z-20">
          {MOBILE_ITEMS.slice(0, 2).map((item) => (
            <MobileNavLink key={item.to} to={item.to} label={item.label} />
          ))}
          <button
            className="flex-1 flex flex-col items-center justify-center text-white bg-accent mx-1 my-2 rounded-xl"
            onClick={() => setQuickAddOpen(true)}
          >
            <span className="text-xl leading-none">+</span>
          </button>
          {MOBILE_ITEMS.slice(2).map((item) => (
            <MobileNavLink key={item.to} to={item.to} label={item.label} />
          ))}
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

function MobileNavLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) => `flex-1 flex flex-col items-center justify-center text-xs ${isActive ? "text-ink font-semibold" : "text-muted"}`}
    >
      {label}
    </NavLink>
  );
}
