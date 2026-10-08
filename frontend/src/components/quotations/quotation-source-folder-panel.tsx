"use client";

import { useMemo, useState } from "react";
import {
    CheckCheck,
    FolderInput,
    FolderSearch,
    LoaderCircle,
} from "lucide-react";

import { apiRequest } from "@/lib/api";
import type {
    QuotationFileType,
    SourceFileCandidate,
    SourceFolderImportResponse,
    SourceFolderScanResponse,
} from "@/types/quotation-file";


type QuotationSourceFolderPanelProps = {
    quotationRequestId: string;
    sourceFolderPath: string | null;
    onImported: () => void;
};


const fileTypeLabels: Record<QuotationFileType, string> = {
    bom: "BOM",
    gerbers: "Gerbers",
    pick_place: "Pick&Place",
    assembly: "Assembly",
    drawing: "Desenho",
    other: "Outro",
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


export function QuotationSourceFolderPanel({
    quotationRequestId,
    sourceFolderPath,
    onImported,
}: QuotationSourceFolderPanelProps) {
    const [candidates, setCandidates] = useState<
        SourceFileCandidate[]
    >([]);
    const [selected, setSelected] = useState<
        Record<string, boolean>
    >({});
    const [fileTypes, setFileTypes] = useState<
        Record<string, QuotationFileType>
    >({});
    const [scanning, setScanning] = useState(false);
    const [importing, setImporting] = useState(false);
    const [scanned, setScanned] = useState(false);
    const [truncated, setTruncated] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const availableCandidates = useMemo(
        () =>
            candidates.filter(
                (candidate) => !candidate.already_imported,
            ),
        [candidates],
    );

    const selectedCount = useMemo(
        () =>
            availableCandidates.filter(
                (candidate) => selected[candidate.relative_path],
            ).length,
        [availableCandidates, selected],
    );

    const importedCount =
        candidates.length - availableCandidates.length;

    async function scanFolder() {
        setScanning(true);
        setError(null);
        setMessage(null);

        try {
            const data = await apiRequest<SourceFolderScanResponse>(
                `/quotation-requests/${quotationRequestId}/source-folder/scan`,
                {
                    method: "POST",
                },
            );

            setCandidates(data.items);
            setTruncated(data.truncated);
            setScanned(true);

            setSelected(
                Object.fromEntries(
                    data.items.map((candidate) => [
                        candidate.relative_path,
                        !candidate.already_imported,
                    ]),
                ),
            );

            setFileTypes(
                Object.fromEntries(
                    data.items.map((candidate) => [
                        candidate.relative_path,
                        candidate.suggested_type,
                    ]),
                ),
            );
        } catch (requestError) {
            setError(
                requestError instanceof Error
                    ? requestError.message
                    : "Não foi possível analisar a pasta.",
            );
        } finally {
            setScanning(false);
        }
    }

    function toggleAll() {
        const shouldSelect =
            selectedCount !== availableCandidates.length;

        setSelected(
            Object.fromEntries(
                candidates.map((candidate) => [
                    candidate.relative_path,
                    candidate.already_imported
                        ? false
                        : shouldSelect,
                ]),
            ),
        );
    }

    async function importSelected() {
        const items = candidates
            .filter(
                (candidate) => selected[candidate.relative_path],
            )
            .map((candidate) => ({
                relative_path: candidate.relative_path,
                file_type:
                    fileTypes[candidate.relative_path] ??
                    candidate.suggested_type,
                revision: null,
                notes: "Importado automaticamente da pasta de origem.",
            }));

        if (items.length === 0) {
            setError("Seleciona pelo menos um ficheiro.");
            return;
        }

        setImporting(true);
        setError(null);
        setMessage(null);

        try {
            const result =
                await apiRequest<SourceFolderImportResponse>(
                    `/quotation-requests/${quotationRequestId}/source-folder/import`,
                    {
                        method: "POST",
                        body: JSON.stringify({ items }),
                    },
                );

            const parts = [
                `${result.imported} ${result.imported === 1
                    ? "ficheiro importado"
                    : "ficheiros importados"
                }`,
            ];

            if (result.skipped_duplicates > 0) {
                parts.push(
                    `${result.skipped_duplicates} ${result.skipped_duplicates === 1
                        ? "duplicado ignorado"
                        : "duplicados ignorados"
                    }`,
                );
            }
            setMessage(`${parts.join(" · ")}.`);
            setCandidates([]);
            setSelected({});
            setFileTypes({});
            setScanned(false);
            setTruncated(false);
            onImported();

        } catch (requestError) {
            setError(
                requestError instanceof Error
                    ? requestError.message
                    : "Não foi possível importar os ficheiros.",
            );
        } finally {
            setImporting(false);
        }
    }

    return (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 p-5">
                <div>
                    <div className="flex items-center gap-2">
                        <FolderSearch size={19} className="text-blue-600" />

                        <h2 className="font-semibold text-slate-950">
                            Pasta de origem
                        </h2>
                    </div>

                    <p className="mt-2 break-all text-sm text-slate-500">
                        {sourceFolderPath ??
                            "Ainda não foi definida uma pasta de origem."}
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => void scanFolder()}
                    disabled={!sourceFolderPath || scanning || importing}
                    className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {scanning ? (
                        <LoaderCircle size={17} className="animate-spin" />
                    ) : (
                        <FolderSearch size={17} />
                    )}
                    Analisar pasta
                </button>
            </header>

            {error && (
                <div className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            {message && (
                <div className="border-b border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-700">
                    {message}
                </div>
            )}

            {truncated && (
                <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-700">
                    Foram apresentados apenas os primeiros 500 ficheiros.
                </div>
            )}

            {scanned && candidates.length === 0 && (
                <p className="px-5 py-8 text-center text-sm text-slate-500">
                    Não foram encontrados ficheiros nesta pasta.
                </p>
            )}

            {candidates.length > 0 && (
                <>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                                <tr>
                                    <th className="w-12 px-5 py-3">
                                        <input
                                            type="checkbox"
                                            checked={
                                                availableCandidates.length > 0 &&
                                                selectedCount === availableCandidates.length
                                            }
                                            disabled={availableCandidates.length === 0}
                                            onChange={toggleAll}
                                            className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                                        />
                                    </th>
                                    <th className="px-5 py-3 font-semibold">
                                        Ficheiro
                                    </th>
                                    <th className="px-5 py-3 font-semibold">
                                        Tamanho
                                    </th>
                                    <th className="px-5 py-3 font-semibold">
                                        Tipo
                                    </th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-slate-100">
                                {candidates.map((candidate) => (
                                    <tr key={candidate.relative_path}>
                                        <td className="px-5 py-4">
                                            <input
                                                type="checkbox"
                                                checked={
                                                    selected[candidate.relative_path] ??
                                                    false
                                                }
                                                disabled={candidate.already_imported}
                                                onChange={(event) =>
                                                    setSelected((current) => ({
                                                        ...current,
                                                        [candidate.relative_path]:
                                                            event.target.checked,
                                                    }))
                                                }
                                                className="h-4 w-4 rounded border-slate-300 accent-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
                                            />
                                        </td>

                                        <td className="px-5 py-4">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="font-medium text-slate-900">
                                                    {candidate.name}
                                                </p>

                                                {candidate.already_imported && (
                                                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                                                        Já importado
                                                    </span>
                                                )}
                                            </div>
                                            <p className="mt-1 text-xs text-slate-500">
                                                {candidate.relative_path}
                                            </p>
                                        </td>

                                        <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                                            {formatFileSize(candidate.size_bytes)}
                                        </td>

                                        <td className="min-w-44 px-5 py-4">
                                            <select
                                                value={
                                                    fileTypes[candidate.relative_path] ??
                                                    candidate.suggested_type
                                                }
                                                disabled={candidate.already_imported}
                                                onChange={(event) =>
                                                    setFileTypes((current) => ({
                                                        ...current,
                                                        [candidate.relative_path]:
                                                            event.target
                                                                .value as QuotationFileType,
                                                    }))
                                                }
                                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                            >
                                                {Object.entries(fileTypeLabels).map(
                                                    ([value, label]) => (
                                                        <option key={value} value={value}>
                                                            {label}
                                                        </option>
                                                    ),
                                                )}
                                            </select>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 px-5 py-4">
                        <span className="text-sm text-slate-500">
                            {selectedCount} selecionados
                            {importedCount > 0 &&
                                ` · ${importedCount} já importados`}
                        </span>

                        <button
                            type="button"
                            onClick={() => void importSelected()}
                            disabled={selectedCount === 0 || importing}
                            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {importing ? (
                                <LoaderCircle
                                    size={17}
                                    className="animate-spin"
                                />
                            ) : (
                                <FolderInput size={17} />
                            )}
                            Importar selecionados
                        </button>
                    </footer>
                </>
            )}

            {!scanned && (
                <div className="flex items-center gap-3 px-5 py-5 text-sm text-slate-500">
                    <CheckCheck size={18} className="text-slate-400" />
                    A análise não modifica os ficheiros originais.
                </div>
            )}
        </section>
    );
}