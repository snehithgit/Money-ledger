import { Link } from "react-router-dom";
import Icon, { IconName } from "../components/Icon";
import { PageHeader } from "../components/UI";

type Item = { to: string; label: string; blurb: string; icon: IconName };
type Group = { title: string; items: Item[] };

const GROUPS: Group[] = [
  {
    title: "Organize",
    items: [
      { to: "/review", label: "Review Inbox", blurb: "Clear uncertain transactions", icon: "flag" },
      { to: "/goals", label: "Goals", blurb: "Track savings progress", icon: "target" },
      { to: "/accounts", label: "Accounts", blurb: "Balances and money sources", icon: "wallet" },
      { to: "/people", label: "People & payees", blurb: "Relationships and duplicate names", icon: "users" },
    ],
  },
  {
    title: "Manage",
    items: [
      { to: "/rules", label: "Rules", blurb: "Automatic classification", icon: "sliders" },
      { to: "/imports", label: "Imports", blurb: "Upload PhonePe statements", icon: "upload" },
      { to: "/categories", label: "Categories", blurb: "Manage spending buckets", icon: "tag" },
    ],
  },
];

export default function More() {
  return (
    <div className="page-stack">
      <PageHeader icon="grid" title="More" description="Less-used tools stay here so the main navigation remains simple." />

      {GROUPS.map((group) => (
        <section key={group.title}>
          <h2 className="section-title mb-3">{group.title}</h2>
          <div className="panel p-2">
            {group.items.map((item) => (
              <Link key={item.to} to={item.to} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                <span className="icon-chip bg-accent/10 text-accent"><Icon name={item.icon} size={17} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted mt-0.5">{item.blurb}</p>
                </div>
                <Icon name="chevron-right" size={16} className="text-gray-400" />
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
