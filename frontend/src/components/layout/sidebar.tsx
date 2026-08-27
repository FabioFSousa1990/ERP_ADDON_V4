"use client";

import Link from "next/link";
import { Building2, FileText, Package, PanelsTopLeft } from "lucide-react";
import { usePathname } from "next/navigation";

const navigation = [
  {
    name: "Clientes",
    href: "/customers",
    icon: Building2,
    enabled: true,
  },
  {
    name: "Produtos",
    href: "/products",
    icon: Package,
    enabled: true,
  },
  {
    name: "Cotações",
    href: "/quotations",
    icon: FileText,
    enabled: false,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex min-h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-slate-950 px-4 py-6 text-slate-100">
      <div className="flex items-center gap-3 px-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
          <PanelsTopLeft size={21} />
        </div>

        <div>
          <p className="font-bold">ERP ADDON</p>
          <p className="text-xs text-slate-400">Workflow V4</p>
        </div>
      </div>

      <nav className="mt-10 space-y-1">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);

          if (!item.enabled) {
            return (
              <div
                key={item.name}
                className="flex cursor-not-allowed items-center justify-between rounded-lg px-3 py-2.5 text-sm text-slate-500"
              >
                <span className="flex items-center gap-3">
                  <Icon size={18} />
                  {item.name}
                </span>

                <span className="text-[10px] uppercase tracking-wide">
                  Em breve
                </span>
              </div>
            );
          }

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-slate-900 hover:text-white"
              }`}
            >
              <Icon size={18} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <p className="mt-auto px-3 text-xs text-slate-500">Versão 0.1.0</p>
    </aside>
  );
}