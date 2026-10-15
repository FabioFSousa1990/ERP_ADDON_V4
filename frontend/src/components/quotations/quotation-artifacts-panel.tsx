"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Download,
  FileCheck2,
  LoaderCircle,
  RefreshCw,
  Trash2,
} from "lucide-react";

import { API_URL, apiRequest } from "@/lib/api";
import type {
  QuotationArtifact,
  QuotationArtifactListResponse,
  QuotationArtifactType,
} from "@/types/quotation-artifact";


type QuotationArtifactsPanelProps = {
  quotationRequestId: string;
};


const artifactTypeLabels: Record<QuotationArtifactType, string> = {
  pcb_top_preview: "PCB — vista superior",
  pcb_bottom_preview: "PCB — vista inferior",
  assembly_top_preview: "Assembly — vista superior",
  assembly_bottom_preview: "Assembly — vista inferior",
  normalized_bom: "BOM normalizada",
  validation_report: "Relatório de validação",
};


function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}


function formatDate(value: string) {
  return new Date(value).toLocaleString("pt-PT", {
    dateStyle: "short",
    timeStyle: "short",
  });
}


export function QuotationArtifactsPanel({
  quotationRequestId,
}: QuotationArtifactsPanelProps) {
  const [artifacts, setArtifacts] = useState<QuotationArtifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadArtifacts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await apiRequest<QuotationArtifactListResponse>(
        `/quotation-requests/${quotationRequestId}/artifacts`,
      );

      setArtifacts(data.items);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível carregar os resultados gerados.",
      );
    } finally {
      setLoading(false);
    }
  }, [quotationRequestId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadArtifacts();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadArtifacts]);

  async function generateValidationReport() {
    setGenerating(true);
    setError(null);

    try {
      await apiRequest<QuotationArtifact>(
        `/quotation-requests/${quotationRequestId}/artifacts/` +
          "generate-validation-report",
        {
          method: "POST",
        },
      );

      await loadArtifacts();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível gerar o relatório.",
      );
    } finally {
      setGenerating(false);
    }
  }

  async function deleteArtifact(artifact: QuotationArtifact) {
    const confirmed = window.confirm(
      `Queres eliminar o resultado "${artifact.display_name}"?`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(artifact.id);
    setError(null);

    try {
      await apiRequest<QuotationArtifact>(
        `/quotation-artifacts/${artifact.id}`,
        {
          method: "DELETE",
        },
      );

      await loadArtifacts();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível eliminar o resultado.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 p-6">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950">
            <FileCheck2 size={20} />
            Resultados gerados
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Ficheiros produzidos pela aplicação a partir dos documentos
            recebidos.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void generateValidationReport()}
          disabled={generating}
          className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {generating ? (
            <LoaderCircle size={17} className="animate-spin" />
          ) : (
            <RefreshCw size={17} />
          )}

          Gerar relatório
        </button>
      </header>

      {error && (
        <div className="border-b border-red-200 bg-red-50 px-6 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 px-6 py-12 text-sm text-slate-500">
          <LoaderCircle size={18} className="animate-spin" />
          A carregar resultados...
        </div>
      ) : artifacts.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <FileCheck2
            size={32}
            className="mx-auto text-slate-300"
          />

          <p className="mt-3 text-sm font-medium text-slate-700">
            Ainda não existem resultados gerados.
          </p>

          <p className="mt-1 text-sm text-slate-500">
            Gera o relatório para validar os ficheiros recebidos.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {artifacts.map((artifact) => (
            <div
              key={artifact.id}
              className="flex flex-wrap items-center justify-between gap-4 px-6 py-4"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900">
                  {artifact.display_name}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {artifactTypeLabels[artifact.artifact_type]}
                  {" · "}
                  {formatFileSize(artifact.size_bytes)}
                  {" · "}
                  {formatDate(artifact.created_at)}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Gerador: {artifact.generator} v
                  {artifact.generation_version}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={`${API_URL}/quotation-artifacts/${artifact.id}/download`}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                  title="Descarregar resultado"
                  aria-label={`Descarregar ${artifact.display_name}`}
                >
                  <Download size={16} />
                </a>

                <button
                  type="button"
                  onClick={() => void deleteArtifact(artifact)}
                  disabled={deletingId === artifact.id}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-700 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  title="Eliminar resultado"
                  aria-label={`Eliminar ${artifact.display_name}`}
                >
                  {deletingId === artifact.id ? (
                    <LoaderCircle size={16} className="animate-spin" />
                  ) : (
                    <Trash2 size={16} />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}