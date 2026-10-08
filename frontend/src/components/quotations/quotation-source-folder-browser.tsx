"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  ArrowUp,
  Check,
  ChevronRight,
  Folder,
  LoaderCircle,
  X,
} from "lucide-react";

import { apiRequest } from "@/lib/api";
import type {
  SourceFolderBrowseResponse,
} from "@/types/quotation-file";


type QuotationSourceFolderBrowserProps = {
  onClose: () => void;
  onSelect: (path: string) => void;
};


export function QuotationSourceFolderBrowser({
  onClose,
  onSelect,
}: QuotationSourceFolderBrowserProps) {
  const [data, setData] =
    useState<SourceFolderBrowseResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const browse = useCallback(
    async (
      rootIndex: number,
      relativePath: string,
    ) => {
      setLoading(true);
      setError(null);

      try {
        const query = new URLSearchParams({
          root_index: String(rootIndex),
          relative_path: relativePath,
        });

        const result =
          await apiRequest<SourceFolderBrowseResponse>(
            `/source-folders/browse?${query.toString()}`,
          );

        setData(result);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Não foi possível abrir a pasta.",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void browse(0, "");
    }, 0);

    return () => window.clearTimeout(timer);
  }, [browse]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4">
      <div className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Procurar no servidor
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Seleciona a pasta que contém os ficheiros
              recebidos do cliente.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Fechar navegador de pastas"
          >
            <X size={19} />
          </button>
        </header>

        {data && (
          <div className="space-y-3 border-b border-slate-200 px-6 py-4">
            {data.roots.length > 1 && (
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Localização
                </span>

                <select
                  value={data.root_index}
                  onChange={(event) =>
                    void browse(
                      Number(event.target.value),
                      "",
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  {data.roots.map((root) => (
                    <option key={root.index} value={root.index}>
                      {root.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={
                  data.parent_relative_path === null ||
                  loading
                }
                onClick={() =>
                  void browse(
                    data.root_index,
                    data.parent_relative_path ?? "",
                  )
                }
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                title="Subir uma pasta"
              >
                <ArrowUp size={17} />
              </button>

              <div className="min-w-0 flex-1 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">
                <p className="truncate" title={data.current_path}>
                  {data.current_path}
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="border-b border-red-200 bg-red-50 px-6 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="min-h-48 flex-1 overflow-y-auto px-3 py-3">
          {loading ? (
            <div className="flex min-h-48 items-center justify-center">
              <span className="inline-flex items-center gap-2 text-sm text-slate-500">
                <LoaderCircle
                  size={18}
                  className="animate-spin"
                />
                A abrir pasta...
              </span>
            </div>
          ) : data && data.directories.length === 0 ? (
            <div className="flex min-h-48 items-center justify-center text-sm text-slate-500">
              Esta pasta não contém subpastas.
            </div>
          ) : (
            data?.directories.map((directory) => (
              <button
                key={directory.relative_path}
                type="button"
                onClick={() =>
                  void browse(
                    data.root_index,
                    directory.relative_path,
                  )
                }
                className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition hover:bg-blue-50"
              >
                <Folder
                  size={20}
                  className="shrink-0 text-amber-500"
                />

                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                  {directory.name}
                </span>

                <ChevronRight
                  size={17}
                  className="shrink-0 text-slate-400"
                />
              </button>
            ))
          )}
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={!data || loading}
            onClick={() => {
              if (data) {
                onSelect(data.current_path);
                onClose();
              }
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Check size={17} />
            Selecionar esta pasta
          </button>
        </footer>
      </div>
    </div>
  );
}