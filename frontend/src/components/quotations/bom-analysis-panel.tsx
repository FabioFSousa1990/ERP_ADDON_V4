"use client";

import {
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
  PackageCheck,
  X,
} from "lucide-react";

import type { BomAnalysisResponse } from "@/types/bom-analysis";


type BomAnalysisPanelProps = {
  analysis: BomAnalysisResponse;
  confirming: boolean;
  confirmedVersionNumber: number | null;
  onConfirm: () => void;
  onClose: () => void;
};


export function BomAnalysisPanel({
  analysis,
  confirming,
  confirmedVersionNumber,
  onConfirm,
  onClose,
}: BomAnalysisPanelProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <button
        type="button"
        aria-label="Fechar análise da BOM"
        className="absolute inset-0"
        onClick={onClose}
      />

      <section className="relative flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-sm font-medium text-blue-600">
              Análise da BOM
            </p>

            <h2 className="mt-1 text-xl font-bold text-slate-950">
              {analysis.original_name}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Folha {analysis.sheet_name} · cabeçalho na linha{" "}
              {analysis.header_row}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid gap-4 border-b border-slate-200 p-6 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Linhas
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-950">
                {analysis.line_count}
              </p>
            </div>

            <div className="rounded-xl bg-blue-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                Posições totais
              </p>

              <p className="mt-2 text-2xl font-bold text-blue-950">
                {analysis.placement_count}
              </p>
            </div>

            <div className="rounded-xl bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                A montar
              </p>

              <p className="mt-2 text-2xl font-bold text-emerald-950">
                {analysis.mounted_placement_count}
              </p>
            </div>

            <div className="rounded-xl bg-amber-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
                DNP
              </p>

              <p className="mt-2 text-2xl font-bold text-amber-950">
                {analysis.dnp_placement_count}
              </p>
            </div>

            <div
              className={`rounded-xl p-4 ${
                analysis.warning_count > 0
                  ? "bg-red-50"
                  : "bg-emerald-50"
              }`}
            >
              <p
                className={`text-xs font-semibold uppercase tracking-wide ${
                  analysis.warning_count > 0
                    ? "text-red-600"
                    : "text-emerald-600"
                }`}
              >
                Avisos
              </p>

              <div className="mt-2 flex items-center gap-2">
                {analysis.warning_count > 0 ? (
                  <AlertTriangle
                    size={21}
                    className="text-red-600"
                  />
                ) : (
                  <CheckCircle2
                    size={21}
                    className="text-emerald-600"
                  />
                )}

                <p
                  className={`text-2xl font-bold ${
                    analysis.warning_count > 0
                      ? "text-red-950"
                      : "text-emerald-950"
                  }`}
                >
                  {analysis.warning_count}
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-100 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">
                    Linha
                  </th>
                  <th className="px-5 py-3 font-semibold">
                    Designadores
                  </th>
                  <th className="px-5 py-3 font-semibold">
                    Qtd.
                  </th>
                  <th className="px-5 py-3 font-semibold">
                    Valor / componente
                  </th>
                  <th className="px-5 py-3 font-semibold">
                    Referência fabricante
                  </th>
                  <th className="px-5 py-3 font-semibold">
                    Footprint
                  </th>
                  <th className="px-5 py-3 font-semibold">
                    Estado
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {analysis.items.map((item) => (
                  <tr
                    key={item.row_number}
                    className={
                      item.do_not_place
                        ? "bg-amber-50/60"
                        : "bg-white"
                    }
                  >
                    <td className="whitespace-nowrap px-5 py-4 text-slate-500">
                      {item.row_number}
                    </td>

                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-900">
                        {item.reference_designator ?? "—"}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
{item.calculated_quantity === 1
  ? "1 posição"
  : `${item.calculated_quantity} posições`}
                      </p>
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-900">
                      {item.declared_quantity ?? "—"}
                    </td>

                    <td className="min-w-52 px-5 py-4">
                      <p className="font-medium text-slate-900">
                        {item.name ?? "—"}
                      </p>

                      {item.description && (
                        <p className="mt-1 text-xs text-slate-500">
                          {item.description}
                        </p>
                      )}
                    </td>

                    <td className="min-w-52 px-5 py-4 text-slate-700">
                      {item.manufacturer_reference ?? "—"}
                    </td>

                    <td className="min-w-52 px-5 py-4 text-xs text-slate-600">
                      {item.footprint ?? "—"}
                    </td>

                    <td className="px-5 py-4">
                      {item.do_not_place ? (
                        <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                          DNP
                        </span>
                      ) : item.is_valid ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                          <PackageCheck size={13} />
                          Válido
                        </span>
                      ) : (
                        <div>
                          <span className="inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                            Verificar
                          </span>

                          {item.warnings.map((warning) => (
                            <p
                              key={warning}
                              className="mt-1 max-w-64 text-xs text-red-600"
                            >
                              {warning}
                            </p>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

<footer className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 px-6 py-4">
  <div>
    {confirmedVersionNumber !== null && (
      <p className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
        <CheckCircle2 size={17} />
        BOM confirmada como versão{" "}
        {confirmedVersionNumber}
      </p>
    )}

    {analysis.warning_count > 0 && (
      <p className="text-sm font-medium text-red-600">
        Corrige os avisos antes de confirmar a BOM.
      </p>
    )}
  </div>

  <div className="flex items-center gap-3">
    <button
      type="button"
      onClick={onClose}
      disabled={confirming}
      className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
    >
      Fechar
    </button>

    <button
      type="button"
      onClick={onConfirm}
      disabled={
        confirming ||
        confirmedVersionNumber !== null ||
        analysis.warning_count > 0
      }
      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {confirming ? (
        <LoaderCircle
          size={17}
          className="animate-spin"
        />
      ) : confirmedVersionNumber !== null ? (
        <CheckCircle2 size={17} />
      ) : (
        <PackageCheck size={17} />
      )}

      {confirmedVersionNumber !== null
        ? "BOM confirmada"
        : "Confirmar BOM"}
    </button>
  </div>
</footer>
      </section>
    </div>
  );
}