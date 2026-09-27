import { Link } from "react-router-dom";
import Icon, { IconName } from "../components/Icon";

const ITEMS: { to: string; label: string; blurb: string; icon: IconName }[] = [
  { to: "/review", label: "Review Inbox", blurb: "Clear flagged transactions", icon: "flag" },
  { to: "/goals", label: "Goals", blurb: "Track your savings targets", icon: "target" },
  { to: "/accounts", label: "Accounts", blurb: "Balances & sources", icon: "wallet" },
  { to: "/people", label: "People", blurb: "Counterparties & relationships", icon: "users" },
  { to: "/rules", label: "Rules", blurb: "Auto-categorization rules", icon: "sliders" },
  { to: "/imports", label: "Imports", blurb: "Upload PhonePe statements", icon: "upload" },
  { to: "/categories", label: "Categories", blurb: "Organize spending buckets", icon: "tag" },
];

export default function More() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">More</h1>
        <p className="text-sm text-muted">Everything else, in one place.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {ITEMS.map((item) => (
          <Link key={item.to} to={item.to} className="tile">
            <span className="icon-chip bg-accent/10 text-accent">
              <Icon name={item.icon} size={18} />
            </span>
            <div>
              <p className="font-medium text-sm">{item.label}</p>
              <p className="text-xs text-muted mt-0.5">{item.blurb}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
