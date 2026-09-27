import { Link } from "react-router-dom";

const ITEMS = [
  { to: "/review", label: "Review Inbox" },
  { to: "/goals", label: "Goals" },
  { to: "/accounts", label: "Accounts" },
  { to: "/people", label: "People" },
  { to: "/rules", label: "Rules" },
  { to: "/imports", label: "Imports" },
  { to: "/categories", label: "Categories" },
];

export default function More() {
  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold mb-4">More</h1>
      {ITEMS.map((item) => (
        <Link key={item.to} to={item.to} className="card flex items-center justify-between block">
          <span className="font-medium">{item.label}</span>
          <span className="text-muted">→</span>
        </Link>
      ))}
    </div>
  );
}
