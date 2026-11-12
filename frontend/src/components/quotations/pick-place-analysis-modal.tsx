"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ListChecks,
  LoaderCircle,
  MapPin,
  TriangleAlert,
  X,
} from "lucide-react";

import type {
  PickPlaceAnalysisResponse,
} from "@/types/pick-place-analysis";
import type {
  PickPlaceComparisonItem,
  PickPlaceComparisonResponse,
  PickPlaceComparisonStatus,
} from "@/types/pick-place-comparison";


type PickPlaceAnalysisModalProps = {
  analysis: PickPlaceAnalysisResponse;
  comparison: PickPlaceComparisonResponse | null;
  comparisonLoading: boolean;
  comparisonError: string | null;
  onClose: () => void;
};


type ModalTab =
  | "validation"
  | "placements";


const statusLabels: Record<
  PickPlaceComparisonStatus,
  string
> = {
  exact_match: "Correspondência exata",
  probable_match: "Correspondência provável",
  value_mismatch: "Valor diferente",
  only_in_bom: "Apenas na BOM",
  only_in_pick_place: "Apenas no Pick&Place",
  dnp_in_pick_place: "DNP no Pick&Place",
};


const statusClasses: Record<
  PickPlaceComparisonStatus,
  string
> = {
  exact_match:
    "bg-emerald-50 text-emerald-700",
  probable_match:
    "bg-blue-50 text-blue-700",
  value_mismatch:
    "bg-amber-50 text-amber-700",
  only_in_bom:
    "bg-red-50 text-red-700",
  only_in_pick_place:
    "bg-violet-50 text-violet-700",
  dnp_in_pick_place:
    "bg-red-50 text-red-700",
};


function formatCoordinate(
  value: number | null,
) {
  if (value === null) {
    return "—";
  }

  return `${value.toFixed(3)} mm`;
}


function formatRotation(value: number | null) {
  if (value === null) {
    return "—";
  }

  return `${value.toFixed(0)}°`;
}


function getComparisonDesignator(
  item: PickPlaceComparisonItem,
) {
  if (
    item.bom_designator &&
    item.pick_place_designator &&
    item.bom_designator !== item.pick_place_designator
  ) {
    return (
      `${item.bom_designator} → ` +
      item.pick_place_designator
    );
  }

  return (
    item.bom_designator ??
    item.pick_place_designator ??
    "—"
  );
}


export function PickPlaceAnalysisModal({
  analysis,
  comparison,
  comparisonLoading,
  comparisonError,
  onClose,
}: PickPlaceAnalysisModalProps) {
  const [activeTab, setActiveTab] =
    useState<ModalTab>("validation");

  const comparisonIssues =
    comparison?.items.filter(
      (item) => item.status !== "exact_match",
    ) ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-5">
      <section className="flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-sm font-semibold text-blue-600">
              Análise Pick&amp;Place
            </p>

            <h2 className="mt-1 text-xl font-bold text-slate-950">
              {analysis.original_name}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {analysis.source_format}
              {" · "}
              unidade original: {analysis.coordinate_unit}
              {" · "}
              face: {analysis.side}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            title="Fechar"
            className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:bg-slate-50"
          >
            <X size={19} />
          </button>
        </header>

        <div className="grid gap-3 border-b border-slate-200 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-blue-50 p-4">
            <p className="text-xs font-semibold uppercase text-blue-600">
              Posições
            </p>
            <p className="mt-1 text-2xl font-bold text-blue-950">
              {analysis.placement_count}
            </p>
          </div>

          <div className="rounded-xl bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase text-emerald-600">
              Posições válidas
            </p>
            <p className="mt-1 text-2xl font-bold text-emerald-950">
              {analysis.valid_placement_count}
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase text-slate-500">
              Área entre posições
            </p>
            <p className="mt-1 font-bold text-slate-900">
              {analysis.bounds.width_mm.toFixed(2)}
              {" × "}
              {analysis.bounds.height_mm.toFixed(2)}
              {" mm"}
            </p>
          </div>

          <div
            className={
              analysis.warning_count > 0
                ? "rounded-xl bg-amber-50 p-4"
                : "rounded-xl bg-emerald-50 p-4"
            }
          >
            <p
              className={
                analysis.warning_count > 0
                  ? "text-xs font-semibold uppercase text-amber-600"
                  : "text-xs font-semibold uppercase text-emerald-600"
              }
            >
              Avisos do ficheiro
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-950">
              {analysis.warning_count}
            </p>
          </div>
        </div>

        <nav className="flex gap-2 border-b border-slate-200 px-6 py-3">
          <button
            type="button"
            onClick={() => setActiveTab("validation")}
            className={
              activeTab === "validation"
                ? "inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                : "inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            }
          >
            <ListChecks size={16} />
            Validação BOM
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("placements")}
            className={
              activeTab === "placements"
                ? "inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                : "inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            }
          >
            <MapPin size={16} />
            Posições
          </button>
        </nav>

        <div className="min-h-0 flex-1 overflow-auto">
          {activeTab === "validation" && (
            <div className="p-6">
              {comparisonLoading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
                  <LoaderCircle
                    size={19}
                    className="animate-spin"
                  />
                  A comparar com a BOM atual...
                </div>
              ) : comparisonError ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  {comparisonError}
                </div>
              ) : !comparison ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
                  Não existe uma versão atual da BOM para
                  comparar com este Pick&amp;Place.
                </div>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                    <div className="rounded-lg bg-emerald-50 p-3">
                      <p className="text-xs font-semibold uppercase text-emerald-600">
                        Exatas
                      </p>
                      <p className="mt-1 text-xl font-bold text-emerald-950">
                        {comparison.exact_match_count}
                      </p>
                    </div>

                    <div className="rounded-lg bg-blue-50 p-3">
                      <p className="text-xs font-semibold uppercase text-blue-600">
                        Prováveis
                      </p>
                      <p className="mt-1 text-xl font-bold text-blue-950">
                        {comparison.probable_match_count}
                      </p>
                    </div>

                    <div className="rounded-lg bg-amber-50 p-3">
                      <p className="text-xs font-semibold uppercase text-amber-600">
                        Valor diferente
                      </p>
                      <p className="mt-1 text-xl font-bold text-amber-950">
                        {comparison.value_mismatch_count}
                      </p>
                    </div>

                    <div className="rounded-lg bg-red-50 p-3">
                      <p className="text-xs font-semibold uppercase text-red-600">
                        Só na BOM
                      </p>
                      <p className="mt-1 text-xl font-bold text-red-950">
                        {comparison.only_in_bom_count}
                      </p>
                    </div>

                    <div className="rounded-lg bg-violet-50 p-3">
                      <p className="text-xs font-semibold uppercase text-violet-600">
                        Só no P&amp;P
                      </p>
                      <p className="mt-1 text-xl font-bold text-violet-950">
                        {comparison.only_in_pick_place_count}
                      </p>
                    </div>

                    <div className="rounded-lg bg-red-50 p-3">
                      <p className="text-xs font-semibold uppercase text-red-600">
                        DNP presentes
                      </p>
                      <p className="mt-1 text-xl font-bold text-red-950">
                        {comparison.dnp_in_pick_place_count}
                      </p>
                    </div>
                  </div>

                  {comparisonIssues.length === 0 ? (
                    <div className="mt-5 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800">
                      <CheckCircle2 size={22} />
                      Todos os componentes correspondem à BOM.
                    </div>
                  ) : (
                    <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
                      <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-4 py-3 text-left font-semibold text-slate-600">
                              Estado
                            </th>
                            <th className="px-4 py-3 text-left font-semibold text-slate-600">
                              Designador
                            </th>
                            <th className="px-4 py-3 text-left font-semibold text-slate-600">
                              BOM
                            </th>
                            <th className="px-4 py-3 text-left font-semibold text-slate-600">
                              Pick&amp;Place
                            </th>
                            <th className="px-4 py-3 text-left font-semibold text-slate-600">
                              Posição
                            </th>
                            <th className="px-4 py-3 text-left font-semibold text-slate-600">
                              Motivo
                            </th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100 bg-white">
                          {comparisonIssues.map(
                            (item, index) => (
                              <tr
                                key={
                                  `${item.status}-` +
                                  `${item.bom_designator}-` +
                                  `${item.pick_place_designator}-` +
                                  index
                                }
                              >
                                <td className="px-4 py-3">
                                  <span
                                    className={
                                      "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold " +
                                      statusClasses[item.status]
                                    }
                                  >
                                    {statusLabels[item.status]}
                                  </span>
                                </td>

                                <td className="px-4 py-3 font-semibold text-slate-900">
                                  {getComparisonDesignator(item)}
                                </td>

                                <td className="px-4 py-3 text-slate-600">
                                  {item.bom_value ?? "—"}
                                </td>

                                <td className="px-4 py-3 text-slate-600">
                                  {item.pick_place_value ?? "—"}
                                </td>

                                <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                                  {formatCoordinate(item.x_mm)}
                                  <br />
                                  {formatCoordinate(item.y_mm)}
                                </td>

                                <td className="max-w-sm px-4 py-3 text-slate-600">
                                  {item.reason}
                                </td>
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === "placements" && (
            <div className="overflow-hidden">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="sticky top-0 bg-slate-100">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">
                      Linha
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">
                      Designador
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">
                      Valor
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">
                      Package
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">
                      X
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">
                      Y
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">
                      Rotação
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">
                      Face
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 bg-white">
                  {analysis.items.map((item) => (
                    <tr key={`${item.row_number}-${item.designator}`}>
                      <td className="px-4 py-3 text-slate-400">
                        {item.row_number}
                      </td>

                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {item.designator}
                      </td>

                      <td className="px-4 py-3 text-slate-700">
                        {item.value ?? "—"}
                      </td>

                      <td className="px-4 py-3 text-slate-500">
                        {item.footprint ?? "—"}
                      </td>

                      <td className="px-4 py-3 text-right text-slate-600">
                        {formatCoordinate(item.x_mm)}
                      </td>

                      <td className="px-4 py-3 text-right text-slate-600">
                        {formatCoordinate(item.y_mm)}
                      </td>

                      <td className="px-4 py-3 text-right text-slate-600">
                        {formatRotation(
                          item.rotation_degrees,
                        )}
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        {item.side}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
          <p className="flex items-center gap-2 text-xs text-slate-500">
            <TriangleAlert size={15} />
            Correspondências prováveis requerem validação humana.
          </p>

          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Fechar
          </button>
        </footer>
      </section>
    </div>
  );
}