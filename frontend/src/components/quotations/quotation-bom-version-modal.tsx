"use client";

import {
  Ban,
  CheckCircle2,
  PackageCheck,
  TriangleAlert,
  X,
} from "lucide-react";

import type { QuotationBomVersion } from "@/types/quotation-bom";


type QuotationBomVersionModalProps = {
  version: QuotationBomVersion;
  onClose: () => void;
};


export function QuotationBomVersionModal({
  version,
  onClose,
}: QuotationBomVersionModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <section className="flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-sm font-medium text-blue-600">
              BOM confirmada
            </p>

            <h2 className="mt-1 text-xl font-bold text-slate-950">
              Versão {version.version_number}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {version.source_name} · Folha {version.sheet_name}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            title="Fechar"
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <X size={20} />
          </button>
        </header>

        <div className="grid gap-4 border-b border-slate-200 p-6 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase text-slate-400">
              Linhas
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {version.line_count}
            </p>
          </div>

          <div className="rounded-xl bg-blue-50 p-4">
            <p className="text-xs font-semibold uppercase text-blue-600">
              Posições totais
            </p>
            <p className="mt-2 text-2xl font-bold text-blue-950">
              {version.placement_count}
            </p>
          </div>

          <div className="rounded-xl bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase text-emerald-600">
              A montar
            </p>
            <p className="mt-2 text-2xl font-bold text-emerald-950">
              {version.mounted_placement_count}
            </p>
          </div>

          <div className="rounded-xl bg-amber-50 p-4">
            <p className="text-xs font-semibold uppercase text-amber-600">
              DNP
            </p>
            <p className="mt-2 text-2xl font-bold text-amber-950">
              {version.dnp_placement_count}
            </p>
          </div>

          <div
            className={`rounded-xl p-4 ${
              version.warning_count > 0
                ? "bg-red-50"
                : "bg-emerald-50"
            }`}
          >
            <p
              className={`text-xs font-semibold uppercase ${
                version.warning_count > 0
                  ? "text-red-600"
                  : "text-emerald-600"
              }`}
            >
              Avisos
            </p>

            <p
              className={`mt-2 flex items-center gap-2 text-2xl font-bold ${
                version.warning_count > 0
                  ? "text-red-950"
                  : "text-emerald-950"
              }`}
            >
              {version.warning_count > 0 ? (
                <TriangleAlert size={20} />
              ) : (
                <CheckCircle2 size={20} />
              )}
              {version.warning_count}
            </p>
          </div>
        </div>

        <div className="overflow-auto">
          <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
            <thead className="sticky top-0 bg-slate-100 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Linha</th>
                <th className="px-5 py-3">Designadores</th>
                <th className="px-5 py-3">Qtd.</th>
                <th className="px-5 py-3">Valor / componente</th>
                <th className="px-5 py-3">
                  Referência fabricante
                </th>
                <th className="px-5 py-3">Footprint</th>
                <th className="px-5 py-3">Estado</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {version.lines.map((line) => (
                <tr
                  key={line.id}
                  className={
                    line.do_not_place
                      ? "bg-amber-50/60"
                      : "bg-white"
                  }
                >
                  <td className="px-5 py-4 text-slate-500">
                    {line.source_row_number}
                  </td>

                  <td className="px-5 py-4">
                    <p className="font-semibold text-slate-900">
                      {line.reference_designator ?? "—"}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {line.designators.length}{" "}
                      {line.designators.length === 1
                        ? "posição"
                        : "posições"}
                    </p>
                  </td>

                  <td className="px-5 py-4 font-semibold text-slate-900">
                    {line.quantity}
                  </td>

                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">
                      {line.name ?? "—"}
                    </p>

                    {line.description && (
                      <p className="mt-1 max-w-xs text-xs text-slate-500">
                        {line.description}
                      </p>
                    )}
                  </td>

                  <td className="px-5 py-4 text-slate-600">
                    {line.manufacturer_reference ?? "—"}
                  </td>

                  <td className="px-5 py-4 text-xs text-slate-600">
                    {line.footprint ?? "—"}
                  </td>

                  <td className="px-5 py-4">
                    {line.do_not_place ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                        <Ban size={13} />
                        DNP
                      </span>
                    ) : line.is_valid ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        <PackageCheck size={13} />
                        Válido
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                        <TriangleAlert size={13} />
                        Aviso
                      </span>
                    )}

                    {line.warnings.length > 0 && (
                      <ul className="mt-2 space-y-1 text-xs text-red-600">
                        {line.warnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}