"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Download,
  Eye,
  FileCheck2,
  LoaderCircle,
  RefreshCw,
  Trash2,
  X,
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
  pcb_top_preview: "PCB - vista superior",
  pcb_bottom_preview: "PCB - vista inferior",
  assembly_top_preview: "Assembly - vista superior",
  assembly_bottom_preview: "Assembly - vista inferior",
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
  const [viewingArtifact, setViewingArtifact] =
    useState<QuotationArtifact | null>(null);
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


  const imageArtifacts = artifacts.filter(
    (artifact) =>
      artifact.media_type?.startsWith("image/") ?? false,
  );

  const otherArtifacts = artifacts.filter(
    (artifact) =>
      !artifact.media_type?.startsWith("image/"),
  );

return (
    <>
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

<div>
  {imageArtifacts.length > 0 && (
    <div className="grid gap-5 p-6 md:grid-cols-2">
      {imageArtifacts.map((artifact) => (
        <article
          key={artifact.id}
          className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
        >
          <button
            type="button"
            onClick={() => setViewingArtifact(artifact)}
            className="group relative flex h-52 w-full items-center justify-center overflow-hidden bg-slate-100 p-3"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${API_URL}/quotation-artifacts/${artifact.id}/view`}
              alt={artifactTypeLabels[artifact.artifact_type]}
              className="max-h-full max-w-full object-contain transition duration-200 group-hover:scale-[1.02]"
            />

            <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-lg bg-slate-950/75 px-3 py-1.5 text-xs font-semibold text-white opacity-0 transition group-hover:opacity-100">
              <Eye size={14} />
              Ampliar
            </span>
          </button>

          <div className="flex items-center justify-between gap-4 border-t border-slate-200 bg-white p-4">
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900">
                {artifactTypeLabels[artifact.artifact_type]}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                {formatFileSize(artifact.size_bytes)}
                {" · "}
                {formatDate(artifact.created_at)}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <a
                href={`${API_URL}/quotation-artifacts/${artifact.id}/download`}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                title="Descarregar imagem"
                aria-label={`Descarregar ${artifact.display_name}`}
              >
                <Download size={16} />
              </a>

              <button
                type="button"
                onClick={() => void deleteArtifact(artifact)}
                disabled={deletingId === artifact.id}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-700 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                title="Eliminar imagem"
                aria-label={`Eliminar ${artifact.display_name}`}
              >
                {deletingId === artifact.id ? (
                  <LoaderCircle
                    size={16}
                    className="animate-spin"
                  />
                ) : (
                  <Trash2 size={16} />
                )}
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  )}

  {otherArtifacts.length > 0 && (
    <div className="divide-y divide-slate-100 border-t border-slate-200">
      {otherArtifacts.map((artifact) => (
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
                <LoaderCircle
                  size={16}
                  className="animate-spin"
                />
              ) : (
                <Trash2 size={16} />
              )}
            </button>
          </div>
        </div>
      ))}
    </div>
  )}
</div>



          )}
      </section>

      {viewingArtifact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
          <button
            type="button"
            aria-label="Fechar imagem ampliada"
            onClick={() => setViewingArtifact(null)}
            className="absolute inset-0 bg-slate-950/80"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label={
              artifactTypeLabels[
                viewingArtifact.artifact_type
              ]
            }
            className="relative z-10 flex max-h-full w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <header className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="font-semibold text-slate-950">
                  {
                    artifactTypeLabels[
                      viewingArtifact.artifact_type
                    ]
                  }
                </h3>

                <p className="mt-1 text-xs text-slate-500">
                  {formatFileSize(viewingArtifact.size_bytes)}
                  {" · "}
                  {formatDate(viewingArtifact.created_at)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setViewingArtifact(null)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
                aria-label="Fechar"
                title="Fechar"
              >
                <X size={19} />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-4 sm:p-8">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${API_URL}/quotation-artifacts/${viewingArtifact.id}/view`}
                alt={
                  artifactTypeLabels[
                    viewingArtifact.artifact_type
                  ]
                }
                className="mx-auto max-h-[calc(100vh-10rem)] max-w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}