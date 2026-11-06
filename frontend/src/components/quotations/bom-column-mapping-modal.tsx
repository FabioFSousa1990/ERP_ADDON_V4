"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  Columns3,
  LoaderCircle,
  TriangleAlert,
  X,
} from "lucide-react";

import type {
  BomColumnMapping,
  BomManualMappingRequest,
  BomMappingRequiredResponse,
} from "@/types/bom-analysis";


type BomColumnMappingModalProps = {
  mappingRequest: BomMappingRequiredResponse;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (payload: BomManualMappingRequest) => void;
};


type MappingField = keyof BomColumnMapping;


const mappingFields: Array<{
  field: MappingField;
  label: string;
  required: boolean;
  description: string;
}> = [
  {
    field: "reference_designator",
    label: "Designadores",
    required: true,
    description: "Ex.: R1, R2, C4 ou U1-U3",
  },
  {
    field: "quantity",
    label: "Quantidade",
    required: false,
    description: "Quantidade declarada na BOM",
  },
  {
    field: "name",
    label: "Valor / componente",
    required: false,
    description: "Ex.: 10K, 100nF ou referência do componente",
  },
  {
    field: "description",
    label: "Descrição",
    required: false,
    description: "Descrição do material",
  },
  {
    field: "dnp",
    label: "DNP / Não montar",
    required: false,
    description: "Indicação de componente não montado",
  },
  {
    field: "footprint",
    label: "Footprint / Package",
    required: false,
    description: "Encapsulamento ou footprint",
  },
  {
    field: "manufacturer_reference",
    label: "Referência do fabricante",
    required: false,
    description: "MPN ou referência de compra",
  },
  {
    field: "datasheet",
    label: "Datasheet",
    required: false,
    description: "Ligação ou referência da ficha técnica",
  },
];


export function BomColumnMappingModal({
  mappingRequest,
  saving,
  error,
  onClose,
  onSubmit,
}: BomColumnMappingModalProps) {
  const [mapping, setMapping] = useState<
    Partial<Record<MappingField, number>>
  >({});

  const duplicateColumns = useMemo(() => {
    const selectedColumns = Object.values(mapping).filter(
      (value): value is number => value !== undefined,
    );

    return selectedColumns.filter(
      (value, index) =>
        selectedColumns.indexOf(value) !== index,
    );
  }, [mapping]);

  function updateMapping(
    field: MappingField,
    value: string,
  ) {
    setMapping((current) => {
      const updated = { ...current };

      if (!value) {
        delete updated[field];
      } else {
        updated[field] = Number(value);
      }

      return updated;
    });
  }

  function formatColumnLabel(columnIndex: number) {
    const column = mappingRequest.columns.find(
      (item) => item.column_index === columnIndex,
    );

    if (!column) {
      return `Coluna ${columnIndex}`;
    }

    const samples = column.sample_values
      .filter(Boolean)
      .slice(0, 3)
      .join(" | ");

    return samples
      ? `${column.header} — ${samples}`
      : column.header;
  }

  function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      mapping.reference_designator === undefined ||
      duplicateColumns.length > 0
    ) {
      return;
    }

    onSubmit({
      sheet_name: mappingRequest.sheet_name,
      header_row: mappingRequest.header_row,
      mapping: {
        reference_designator:
          mapping.reference_designator,
        quantity: mapping.quantity ?? null,
        name: mapping.name ?? null,
        description: mapping.description ?? null,
        dnp: mapping.dnp ?? null,
        footprint: mapping.footprint ?? null,
        manufacturer_reference:
          mapping.manufacturer_reference ?? null,
        datasheet: mapping.datasheet ?? null,
      },
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <section className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-sm font-semibold text-blue-600">
              Associação manual de colunas
            </p>

            <h2 className="mt-1 text-xl font-bold text-slate-950">
              {mappingRequest.original_name}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Folha {mappingRequest.sheet_name} · cabeçalho na
              linha {mappingRequest.header_row}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            title="Fechar"
            className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X size={19} />
          </button>
        </header>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="overflow-y-auto px-6 py-5">
            <div className="mb-5 flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
              <Columns3
                size={20}
                className="mt-0.5 shrink-0"
              />

              <p>
                Não foi possível reconhecer todas as colunas
                automaticamente. Indica a função de cada coluna.
                Apenas os designadores são obrigatórios.
              </p>
            </div>

            {error && (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            {duplicateColumns.length > 0 && (
              <div className="mb-5 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <TriangleAlert
                  size={18}
                  className="shrink-0"
                />

                A mesma coluna não pode ser associada a dois
                campos diferentes.
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              {mappingFields.map((item) => (
                <label
                  key={item.field}
                  className="block rounded-xl border border-slate-200 p-4"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    {item.label}

                    {item.required && (
                      <span className="text-red-500">*</span>
                    )}
                  </span>

                  <span className="mt-1 block text-xs text-slate-500">
                    {item.description}
                  </span>

                  <select
                    value={mapping[item.field] ?? ""}
                    onChange={(event) =>
                      updateMapping(
                        item.field,
                        event.target.value,
                      )
                    }
                    required={item.required}
                    disabled={saving}
                    className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                  >
                    <option value="">
                      {item.required
                        ? "Selecionar coluna"
                        : "Não associar"}
                    </option>

                    {mappingRequest.columns.map((column) => (
                      <option
                        key={column.column_index}
                        value={column.column_index}
                      >
                        {formatColumnLabel(
                          column.column_index,
                        )}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>

          <footer className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="cursor-pointer rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={
                saving ||
                mapping.reference_designator === undefined ||
                duplicateColumns.length > 0
              }
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving && (
                <LoaderCircle
                  size={17}
                  className="animate-spin"
                />
              )}

              Analisar com estas colunas
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}