"use client";

import {
  ArrowRight,
  CircleMinus,
  CirclePlus,
  Equal,
  RefreshCw,
  X,
} from "lucide-react";

import type {
  QuotationBomComponentSnapshot,
  QuotationBomComparison,
} from "@/types/quotation-bom";


type QuotationBomComparisonModalProps = {
  comparison: QuotationBomComparison;
  onClose: () => void;
};


const fieldLabels: Record<string, string> = {
  name: "Valor / componente",
  description: "Descrição",
  do_not_place: "Estado de montagem",
  footprint: "Footprint",
  manufacturer_reference: "Referência fabricante",
  datasheet: "Datasheet",
};


function componentState(
  component: QuotationBomComponentSnapshot,
) {
  return component.do_not_place ? "DNP" : "A montar";
}


function ComponentDetails({
  component,
}: {
  component: QuotationBomComponentSnapshot;
}) {
  return (
    <div className="space-y-1">
      <p className="font-semibold text-slate-900">
        {component.name ?? "Sem valor indicado"}
      </p>

      <p className="text-xs text-slate-500">
        {component.manufacturer_reference ??
          "Sem referência de fabricante"}
      </p>

      <p className="text-xs text-slate-400">
        {component.footprint ?? "Sem footprint"}
      </p>

      <span
        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
          component.do_not_place
            ? "bg-amber-100 text-amber-800"
            : "bg-emerald-50 text-emerald-700"
        }`}
      >
        {componentState(component)}
      </span>
    </div>
  );
}


export function QuotationBomComparisonModal({
  comparison,
  onClose,
}: QuotationBomComparisonModalProps) {
  const hasDifferences =
    comparison.added_count > 0 ||
    comparison.removed_count > 0 ||
    comparison.changed_count > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <section className="flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-sm font-medium text-blue-600">
              Comparação da BOM
            </p>

            <h2 className="mt-1 flex flex-wrap items-center gap-2 text-xl font-bold text-slate-950">
              Versão{" "}
              {comparison.previous_version.version_number}
              <ArrowRight size={19} />
              Versão{" "}
              {comparison.current_version.version_number}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {comparison.previous_version.source_name}
              {" → "}
              {comparison.current_version.source_name}
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

        <div className="grid gap-4 border-b border-slate-200 p-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-emerald-50 p-4">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase text-emerald-600">
              <CirclePlus size={16} />
              Adicionados
            </p>

            <p className="mt-2 text-2xl font-bold text-emerald-950">
              {comparison.added_count}
            </p>
          </div>

          <div className="rounded-xl bg-red-50 p-4">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase text-red-600">
              <CircleMinus size={16} />
              Removidos
            </p>

            <p className="mt-2 text-2xl font-bold text-red-950">
              {comparison.removed_count}
            </p>
          </div>

          <div className="rounded-xl bg-amber-50 p-4">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase text-amber-600">
              <RefreshCw size={16} />
              Alterados
            </p>

            <p className="mt-2 text-2xl font-bold text-amber-950">
              {comparison.changed_count}
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-4">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
              <Equal size={16} />
              Sem alterações
            </p>

            <p className="mt-2 text-2xl font-bold text-slate-900">
              {comparison.unchanged_count}
            </p>
          </div>
        </div>

        <div className="overflow-auto p-6">
          {!hasDifferences ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center text-sm font-medium text-emerald-700">
              As duas versões têm os mesmos componentes.
            </div>
          ) : (
            <div className="space-y-8">
              {comparison.added.length > 0 && (
                <section>
                  <h3 className="flex items-center gap-2 text-lg font-semibold text-emerald-700">
                    <CirclePlus size={19} />
                    Componentes adicionados
                  </h3>

                  <div className="mt-3 overflow-hidden rounded-xl border border-emerald-200">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-emerald-50 text-xs uppercase text-emerald-700">
                        <tr>
                          <th className="px-4 py-3">
                            Designador
                          </th>
                          <th className="px-4 py-3">
                            Componente
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-emerald-100">
                        {comparison.added.map((component) => (
                          <tr key={component.designator}>
                            <td className="px-4 py-4 font-bold text-slate-900">
                              {component.designator}
                            </td>
                            <td className="px-4 py-4">
                              <ComponentDetails
                                component={component}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {comparison.removed.length > 0 && (
                <section>
                  <h3 className="flex items-center gap-2 text-lg font-semibold text-red-700">
                    <CircleMinus size={19} />
                    Componentes removidos
                  </h3>

                  <div className="mt-3 overflow-hidden rounded-xl border border-red-200">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-red-50 text-xs uppercase text-red-700">
                        <tr>
                          <th className="px-4 py-3">
                            Designador
                          </th>
                          <th className="px-4 py-3">
                            Componente anterior
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-red-100">
                        {comparison.removed.map((component) => (
                          <tr key={component.designator}>
                            <td className="px-4 py-4 font-bold text-slate-900">
                              {component.designator}
                            </td>
                            <td className="px-4 py-4">
                              <ComponentDetails
                                component={component}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {comparison.changed.length > 0 && (
                <section>
                  <h3 className="flex items-center gap-2 text-lg font-semibold text-amber-700">
                    <RefreshCw size={19} />
                    Componentes alterados
                  </h3>

                  <div className="mt-3 overflow-x-auto rounded-xl border border-amber-200">
                    <table className="w-full min-w-[900px] text-left text-sm">
                      <thead className="bg-amber-50 text-xs uppercase text-amber-700">
                        <tr>
                          <th className="px-4 py-3">
                            Designador
                          </th>
                          <th className="px-4 py-3">
                            Campos alterados
                          </th>
                          <th className="px-4 py-3">
                            Versão anterior
                          </th>
                          <th className="px-4 py-3">
                            Versão atual
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-amber-100">
                        {comparison.changed.map((change) => (
                          <tr key={change.designator}>
                            <td className="px-4 py-4 font-bold text-slate-900">
                              {change.designator}
                            </td>

                            <td className="px-4 py-4">
                              <div className="flex max-w-xs flex-wrap gap-1.5">
                                {change.changed_fields.map(
                                  (field) => (
                                    <span
                                      key={field}
                                      className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800"
                                    >
                                      {fieldLabels[field] ?? field}
                                    </span>
                                  ),
                                )}
                              </div>
                            </td>

                            <td className="px-4 py-4">
                              <ComponentDetails
                                component={change.previous}
                              />
                            </td>

                            <td className="px-4 py-4">
                              <ComponentDetails
                                component={change.current}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}