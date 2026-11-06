"use client";

import { useCallback, useEffect, useState } from "react";
import {
    ArrowLeftRight,
    CheckCircle2,
    Eye,
    History,
    LoaderCircle,
    PackageCheck,
    TriangleAlert,
} from "lucide-react";

import { apiRequest } from "@/lib/api";
import type {
    QuotationBomComparison,
    QuotationBomVersion,
    QuotationBomVersionListResponse,
    QuotationBomVersionSummary,
} from "@/types/quotation-bom";

import { QuotationBomVersionModal } from "@/components/quotations/quotation-bom-version-modal";
type QuotationBomVersionsPanelProps = {
    quotationRequestId: string;
    refreshKey?: number;
};
import { QuotationBomComparisonModal } from "@/components/quotations/quotation-bom-comparison-modal";


function formatDate(value: string) {
    return new Date(value).toLocaleString("pt-PT", {
        dateStyle: "short",
        timeStyle: "short",
    });
}


export function QuotationBomVersionsPanel({
    quotationRequestId,
    refreshKey = 0,
}: QuotationBomVersionsPanelProps) {
    const [versions, setVersions] = useState<
        QuotationBomVersionSummary[]
    >([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedVersion, setSelectedVersion] =
        useState<QuotationBomVersion | null>(null);
    const [selectedComparison, setSelectedComparison] =
    useState<QuotationBomComparison | null>(null);

    const [loadingComparisonId, setLoadingComparisonId] =
    useState<string | null>(null);
    const [loadingVersionId, setLoadingVersionId] =
        useState<string | null>(null);
    const loadVersions = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const data =
                await apiRequest<QuotationBomVersionListResponse>(
                    `/quotation-requests/${quotationRequestId}/bom-versions`,
                );

            setVersions(data.items);
        } catch (requestError) {
            setError(
                requestError instanceof Error
                    ? requestError.message
                    : "Não foi possível carregar as versões da BOM.",
            );
        } finally {
            setLoading(false);
        }
    }, [quotationRequestId]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void loadVersions();
        }, 0);

        return () => window.clearTimeout(timer);
    }, [loadVersions, refreshKey]);


    async function openVersion(
        version: QuotationBomVersionSummary,
    ) {
        setLoadingVersionId(version.id);
        setError(null);

        try {
            const versionDetail =
                await apiRequest<QuotationBomVersion>(
                    `/quotation-bom-versions/${version.id}`,
                );

            setSelectedVersion(versionDetail);
        } catch (requestError) {
            setError(
                requestError instanceof Error
                    ? requestError.message
                    : "Não foi possível consultar a versão da BOM.",
            );
        } finally {
            setLoadingVersionId(null);
        }
    }
    async function openComparison(
  currentVersion: QuotationBomVersionSummary,
) {
  const previousVersion = versions
    .filter(
      (version) =>
        version.version_number
        < currentVersion.version_number,
    )
    .sort(
      (first, second) =>
        second.version_number - first.version_number,
    )[0];

  if (!previousVersion) {
    return;
  }

  setLoadingComparisonId(currentVersion.id);
  setError(null);

  try {
    const comparison =
      await apiRequest<QuotationBomComparison>(
        `/quotation-bom-versions/${currentVersion.id}` +
          `/compare/${previousVersion.id}`,
      );

    setSelectedComparison(comparison);
  } catch (requestError) {
    setError(
      requestError instanceof Error
        ? requestError.message
        : "Não foi possível comparar as versões da BOM.",
    );
  } finally {
    setLoadingComparisonId(null);
  }
}
    return (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <header className="border-b border-slate-200 p-6">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950">
                    <History size={20} />
                    Versões da BOM
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                    Histórico das BOM confirmadas para esta cotação.
                </p>
            </header>

            {error && (
                <div className="border-b border-red-200 bg-red-50 px-6 py-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center gap-2 px-6 py-12 text-sm text-slate-500">
                    <LoaderCircle size={18} className="animate-spin" />
                    A carregar versões...
                </div>
            ) : versions.length === 0 ? (
                <div className="px-6 py-12 text-center">
                    <History
                        size={32}
                        className="mx-auto text-slate-300"
                    />

                    <p className="mt-3 text-sm font-medium text-slate-700">
                        Ainda não existem versões confirmadas.
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                        Analisa e confirma uma BOM nos ficheiros recebidos.
                    </p>
                </div>
            ) : (
                <div className="divide-y divide-slate-100">
                    {versions.map((version) => (
                        <article
                            key={version.id}
                            className="px-6 py-5"
                        >
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="font-semibold text-slate-900">
                                            Versão {version.version_number}
                                        </h3>

                                        {version.is_current && (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                                <CheckCircle2 size={13} />
                                                Versão atual
                                            </span>
                                        )}
                                    </div>

                                    <p className="mt-1 truncate text-sm text-slate-600">
                                        {version.source_name}
                                    </p>

                                    <p className="mt-1 text-xs text-slate-400">
                                        Confirmada em {formatDate(version.confirmed_at)}
                                    </p>
                                </div>

                                <div className="flex items-center gap-2">
                                    {version.warning_count > 0 && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                                            <TriangleAlert size={13} />
                                            {version.warning_count} avisos
                                        </span>
                                    )}
{versions.some(
  (candidate) =>
    candidate.version_number < version.version_number,
) && (
  <button
    type="button"
    onClick={() => void openComparison(version)}
    disabled={loadingComparisonId === version.id}
    title={`Comparar versão ${version.version_number} com a anterior`}
    className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-violet-300 px-3 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-60"
  >
    {loadingComparisonId === version.id ? (
      <LoaderCircle size={16} className="animate-spin" />
    ) : (
      <ArrowLeftRight size={16} />
    )}

    Comparar
  </button>
)}
                                    <button
                                        type="button"
                                        onClick={() => void openVersion(version)}
                                        disabled={loadingVersionId === version.id}
                                        title={`Consultar versão ${version.version_number}`}
                                        className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {loadingVersionId === version.id ? (
                                            <LoaderCircle size={16} className="animate-spin" />
                                        ) : (
                                            <Eye size={16} />
                                        )}

                                        Ver BOM
                                    </button>
                                </div>
                            </div>

                            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                                <div className="rounded-lg bg-slate-50 p-3">
                                    <p className="text-xs font-semibold uppercase text-slate-400">
                                        Linhas
                                    </p>
                                    <p className="mt-1 font-bold text-slate-900">
                                        {version.line_count}
                                    </p>
                                </div>

                                <div className="rounded-lg bg-blue-50 p-3">
                                    <p className="text-xs font-semibold uppercase text-blue-500">
                                        Posições
                                    </p>
                                    <p className="mt-1 font-bold text-blue-950">
                                        {version.placement_count}
                                    </p>
                                </div>

                                <div className="rounded-lg bg-emerald-50 p-3">
                                    <p className="text-xs font-semibold uppercase text-emerald-600">
                                        A montar
                                    </p>
                                    <p className="mt-1 font-bold text-emerald-950">
                                        {version.mounted_placement_count}
                                    </p>
                                </div>

                                <div className="rounded-lg bg-amber-50 p-3">
                                    <p className="text-xs font-semibold uppercase text-amber-600">
                                        DNP
                                    </p>
                                    <p className="mt-1 font-bold text-amber-950">
                                        {version.dnp_placement_count}
                                    </p>
                                </div>

                                <div className="rounded-lg bg-violet-50 p-3">
                                    <PackageCheck
                                        size={17}
                                        className="text-violet-600"
                                    />
                                    <p className="mt-1 text-xs text-violet-700">
                                        Folha: {version.sheet_name}
                                    </p>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            )}
            {selectedVersion && (
                <QuotationBomVersionModal
                    version={selectedVersion}
                    onClose={() => setSelectedVersion(null)}
                />
            )}
            {selectedComparison && (
  <QuotationBomComparisonModal
    comparison={selectedComparison}
    onClose={() => setSelectedComparison(null)}
  />
)}
        </section>
    );
}