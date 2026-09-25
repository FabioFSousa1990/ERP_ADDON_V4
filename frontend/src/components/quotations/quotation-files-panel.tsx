"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  Download,
  FileText,
  LoaderCircle,
  Plus,
  Trash2,
  Upload,
  Pencil,
  Save,
  X,
} from "lucide-react";

import { API_URL, apiRequest } from "@/lib/api";
import type {
  QuotationFile,
  QuotationFileListResponse,
  QuotationFileType,
  QuotationFileUpdate,
} from "@/types/quotation-file";


type QuotationFilesPanelProps = {
  quotationRequestId: string;
};


const fileTypeLabels: Record<QuotationFileType, string> = {
  bom: "BOM",
  gerbers: "Gerbers",
  pick_place: "Pick&Place",
  assembly: "Assembly",
  drawing: "Desenho",
  other: "Outro",
};


const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";


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


export function QuotationFilesPanel({
  quotationRequestId,
}: QuotationFilesPanelProps) {
  const [files, setFiles] = useState<QuotationFile[]>([]);
  const [fileType, setFileType] =
    useState<QuotationFileType>("bom");
  const [revision, setRevision] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] =
    useState<string | null>(null);
const [editingId, setEditingId] = useState<string | null>(null);
const [savingId, setSavingId] = useState<string | null>(null);
const [editFileType, setEditFileType] =
  useState<QuotationFileType>("other");
const [editRevision, setEditRevision] = useState("");
const [editNotes, setEditNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await apiRequest<QuotationFileListResponse>(
        `/quotation-requests/${quotationRequestId}/files`,
      );

      setFiles(data.items);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível carregar os ficheiros.",
      );
    } finally {
      setLoading(false);
    }
  }, [quotationRequestId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadFiles();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadFiles]);

  function closeUpload() {
    if (uploading) {
      return;
    }

    setShowUpload(false);
    setSelectedFile(null);
    setFileType("bom");
    setRevision("");
    setNotes("");
    setError(null);
  }

  async function handleUpload(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!selectedFile) {
      setError("Seleciona um ficheiro.");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();

      formData.append("file", selectedFile);
      formData.append("file_type", fileType);

      if (revision.trim()) {
        formData.append("revision", revision.trim());
      }

      if (notes.trim()) {
        formData.append("notes", notes.trim());
      }

      await apiRequest<QuotationFile>(
        `/quotation-requests/${quotationRequestId}/files`,
        {
          method: "POST",
          body: formData,
        },
      );

      setShowUpload(false);
      setSelectedFile(null);
      setFileType("bom");
      setRevision("");
      setNotes("");

      await loadFiles();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível carregar o ficheiro.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function deleteFile(quotationFile: QuotationFile) {
    const confirmed = window.confirm(
      `Queres remover definitivamente "${quotationFile.original_name}"?`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(quotationFile.id);
    setError(null);

    try {
      await apiRequest<QuotationFile>(
        `/quotation-files/${quotationFile.id}`,
        {
          method: "DELETE",
        },
      );

      await loadFiles();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível remover o ficheiro.",
      );
    } finally {
      setDeletingId(null);
    }
  }

function startEditing(quotationFile: QuotationFile) {
  setEditingId(quotationFile.id);
  setEditFileType(quotationFile.file_type);
  setEditRevision(quotationFile.revision ?? "");
  setEditNotes(quotationFile.notes ?? "");
  setError(null);
}

function cancelEditing() {
  if (savingId) {
    return;
  }

  setEditingId(null);
  setEditRevision("");
  setEditNotes("");
  setError(null);
}

async function saveFileMetadata(fileId: string) {
  setSavingId(fileId);
  setError(null);

  const payload: QuotationFileUpdate = {
    file_type: editFileType,
    revision: editRevision.trim() || null,
    notes: editNotes.trim() || null,
  };

  try {
    await apiRequest<QuotationFile>(
      `/quotation-files/${fileId}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );

    setEditingId(null);
    setEditRevision("");
    setEditNotes("");

    await loadFiles();
  } catch (requestError) {
    setError(
      requestError instanceof Error
        ? requestError.message
        : "Não foi possível editar o ficheiro.",
    );
  } finally {
    setSavingId(null);
  }
}

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">
            Ficheiros recebidos
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            BOM, Gerbers, Pick&amp;Place, Assembly e outros
            documentos do pedido.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setError(null);
            setShowUpload((current) => !current);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          <Plus size={17} />
          Adicionar ficheiro
        </button>
      </header>

      {error && (
        <div className="border-b border-red-200 bg-red-50 px-6 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {showUpload && (
        <form
          onSubmit={(event) => void handleUpload(event)}
          className="space-y-4 border-b border-slate-200 bg-slate-50 px-6 py-5"
        >
          <div className="grid gap-4 lg:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Ficheiro *
              </span>

              <input
                required
                type="file"
                onChange={(event) =>
                  setSelectedFile(event.target.files?.[0] ?? null)
                }
                className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2.5 file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Tipo *
              </span>

              <select
                required
                value={fileType}
                onChange={(event) =>
                  setFileType(
                    event.target.value as QuotationFileType,
                  )
                }
                className={inputClass}
              >
                {Object.entries(fileTypeLabels).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Revisão
              </span>

              <input
                value={revision}
                onChange={(event) =>
                  setRevision(event.target.value)
                }
                className={inputClass}
                placeholder="Opcional"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Observações
            </span>

            <input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className={inputClass}
              placeholder="Informação adicional sobre o ficheiro"
            />
          </label>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={closeUpload}
              disabled={uploading}
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-white disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {uploading ? (
                <LoaderCircle size={17} className="animate-spin" />
              ) : (
                <Upload size={17} />
              )}

              Carregar
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center px-6 py-12 text-sm text-slate-500">
          <LoaderCircle
            size={18}
            className="mr-2 animate-spin"
          />
          A carregar ficheiros...
        </div>
      ) : files.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <FileText
            size={30}
            className="mx-auto text-slate-300"
          />

          <p className="mt-3 text-sm font-medium text-slate-600">
            Ainda não existem ficheiros associados.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">

{files.map((quotationFile) =>
  editingId === quotationFile.id ? (
    <div
      key={quotationFile.id}
      className="space-y-4 bg-slate-50 px-6 py-5"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">
            {quotationFile.original_name}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            O ficheiro físico não será alterado.
          </p>
        </div>

        <button
          type="button"
          onClick={cancelEditing}
          disabled={savingId === quotationFile.id}
          title="Cancelar edição"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-700 transition hover:bg-white disabled:opacity-50"
        >
          <X size={16} />
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            Tipo
          </span>

          <select
            value={editFileType}
            onChange={(event) =>
              setEditFileType(
                event.target.value as QuotationFileType,
              )
            }
            className={inputClass}
          >
            {Object.entries(fileTypeLabels).map(
              ([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ),
            )}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            Revisão
          </span>

          <input
            value={editRevision}
            onChange={(event) =>
              setEditRevision(event.target.value)
            }
            className={inputClass}
            placeholder="Opcional"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            Observações
          </span>

          <input
            value={editNotes}
            onChange={(event) =>
              setEditNotes(event.target.value)
            }
            className={inputClass}
            placeholder="Opcional"
          />
        </label>
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={cancelEditing}
          disabled={savingId === quotationFile.id}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white disabled:opacity-50"
        >
          Cancelar
        </button>

        <button
          type="button"
          onClick={() =>
            void saveFileMetadata(quotationFile.id)
          }
          disabled={savingId === quotationFile.id}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {savingId === quotationFile.id ? (
            <LoaderCircle
              size={16}
              className="animate-spin"
            />
          ) : (
            <Save size={16} />
          )}

          Guardar
        </button>
      </div>
    </div>
  ) : (
    <div
      key={quotationFile.id}
      className="flex flex-wrap items-center justify-between gap-4 px-6 py-4"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          <FileText size={19} />
        </div>

        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">
            {quotationFile.original_name}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {fileTypeLabels[quotationFile.file_type]}
            {quotationFile.revision
              ? ` · Rev. ${quotationFile.revision}`
              : ""}
            {` · ${formatFileSize(quotationFile.size_bytes)}`}
            {` · ${formatDate(quotationFile.uploaded_at)}`}
          </p>

          {quotationFile.notes && (
            <p className="mt-1 text-xs text-slate-500">
              {quotationFile.notes}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <a
          href={`${API_URL}/quotation-files/${quotationFile.id}/download`}
          title="Descarregar ficheiro"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
        >
          <Download size={16} />
        </a>

        <button
          type="button"
          onClick={() => startEditing(quotationFile)}
          title="Editar informação"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
        >
          <Pencil size={16} />
        </button>

        <button
          type="button"
          onClick={() => void deleteFile(quotationFile)}
          disabled={deletingId === quotationFile.id}
          title="Remover ficheiro"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-700 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
        >
          {deletingId === quotationFile.id ? (
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
  ),
)}




        </div>
      )}
    </section>
  );
}