"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  FolderSearch,
  LoaderCircle,
  X,
} from "lucide-react";

import type { Customer } from "@/types/customer";
import type { Product } from "@/types/product";
import type {
  QuotationRequest,
  QuotationRequestCreate,
  QuotationStatus,
} from "@/types/quotation-request";
import { QuotationSourceFolderBrowser } from "@/components/quotations/quotation-source-folder-browser";

type QuotationFormProps = {
  quotation: QuotationRequest | null;
  customers: Customer[];
  products: Product[];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (payload: QuotationRequestCreate) => Promise<void>;
};


type FormState = {
  customer_id: string;
  product_id: string;
  source_folder_path: string;
  received_date: string;
  requested_deadline: string;
  status: QuotationStatus;
  customer_contact: string;
  quantities: string;
  notes: string;
};


const statusOptions: Array<{
  value: QuotationStatus;
  label: string;
}> = [
  { value: "received", label: "Recebido" },
  { value: "in_analysis", label: "Em análise" },
  { value: "waiting_customer", label: "Aguarda cliente" },
  { value: "waiting_supplier", label: "Aguarda fornecedor" },
  { value: "ready", label: "Pronto" },
  { value: "sent", label: "Enviado" },
  { value: "accepted", label: "Aceite" },
  { value: "rejected", label: "Rejeitado" },
  { value: "cancelled", label: "Cancelado" },
];


const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";


function today() {
  return new Date().toISOString().slice(0, 10);
}


function initialForm(
  quotation: QuotationRequest | null,
  products: Product[],
): FormState {
  const product = quotation
    ? products.find((item) => item.id === quotation.product_id)
    : null;

  return {
    customer_id: product?.customer_id ?? "",
    product_id: quotation?.product_id ?? "",
    source_folder_path: quotation?.source_folder_path ?? "",
    received_date: quotation?.received_date ?? today(),
    requested_deadline: quotation?.requested_deadline ?? "",
    status: quotation?.status ?? "received",
    customer_contact: quotation?.customer_contact ?? "",
    quantities:
      quotation?.quantities
        .map((item) => item.quantity)
        .join(", ") ?? "",
    notes: quotation?.notes ?? "",
  };
}


function parseQuantities(value: string): number[] {
  const parts = value
    .split(/[,;\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const quantities = parts.map(Number);

  if (
    quantities.length === 0 ||
    quantities.some(
      (quantity) =>
        !Number.isInteger(quantity) || quantity <= 0,
    )
  ) {
    throw new Error(
      "Indica pelo menos uma quantidade inteira superior a zero.",
    );
  }

  if (new Set(quantities).size !== quantities.length) {
    throw new Error("As quantidades não podem estar repetidas.");
  }

  return [...quantities].sort((a, b) => a - b);
}


export function QuotationForm({
  quotation,
  customers,
  products,
  saving,
  error,
  onClose,
  onSubmit,
}: QuotationFormProps) {
  const [form, setForm] = useState<FormState>(() =>
    initialForm(quotation, products),
  );
  const [showFolderBrowser, setShowFolderBrowser] =
  useState(false);
  const [validationError, setValidationError] = useState<string | null>(
    null,
  );

  const availableCustomers = customers.filter(
    (customer) =>
      customer.is_active || customer.id === form.customer_id,
  );

  const availableProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          product.customer_id === form.customer_id &&
          (product.is_active || product.id === quotation?.product_id),
      ),
    [
      form.customer_id,
      products,
      quotation?.product_id,
    ],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError(null);

    try {
      const quantities = parseQuantities(form.quantities);

      await onSubmit({
        product_id: form.product_id,
        source_folder_path: form.source_folder_path.trim() || null,
        received_date: form.received_date,
        requested_deadline: form.requested_deadline || null,
        status: form.status,
        customer_contact: form.customer_contact.trim() || null,
        quantities,
        notes: form.notes.trim() || null,
      });
    } catch (submitError) {
      setValidationError(
        submitError instanceof Error
          ? submitError.message
          : "Não foi possível validar o pedido.",
      );
    }
  }

  const displayedError = validationError ?? error;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40">
      <button
        type="button"
        aria-label="Fechar formulário"
        className="min-w-0 flex-1 cursor-default"
        onClick={onClose}
      />

      <aside className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              {quotation
                ? "Editar pedido de cotação"
                : "Novo pedido de cotação"}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Um pedido corresponde a um produto e pode incluir várias
              quantidades.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
          >
            <X size={19} />
          </button>
        </header>

        {displayedError && (
          <div className="border-b border-red-200 bg-red-50 px-6 py-3 text-sm text-red-700">
            {displayedError}
          </div>
        )}

        <form
          id="quotation-form"
          onSubmit={(event) => void handleSubmit(event)}
          className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-6"
        >
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Cliente *
            </span>

            <select
              required
              value={form.customer_id}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  customer_id: event.target.value,
                  product_id: "",
                }))
              }
              className={inputClass}
            >
              <option value="">Selecionar cliente...</option>

              {availableCustomers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Produto *
            </span>

            <select
              required
              disabled={!form.customer_id}
              value={form.product_id}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  product_id: event.target.value,
                }))
              }
              className={inputClass}
            >
              <option value="">
                {form.customer_id
                  ? "Selecionar produto..."
                  : "Seleciona primeiro o cliente"}
              </option>

              {availableProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                  {product.customer_reference
                    ? ` — ${product.customer_reference}`
                    : ""}
                  {product.revision
                    ? ` — Rev. ${product.revision}`
                    : ""}
                </option>
              ))}
            </select>
          </label>
<label className="block">
  <span className="mb-1.5 block text-sm font-medium text-slate-700">
    Pasta dos ficheiros no servidor
  </span>

<div className="flex gap-2">
  <input
    value={form.source_folder_path}
    onChange={(event) =>
      setForm((current) => ({
        ...current,
        source_folder_path: event.target.value,
      }))
    }
    className={inputClass}
    placeholder="\\servidor\Clientes\Cliente\Produto\Cotação"
  />

  <button
    type="button"
    onClick={() => setShowFolderBrowser(true)}
    className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
  >
    <FolderSearch size={17} />
    Procurar
  </button>
</div>

  <span className="mt-1.5 block text-xs text-slate-500">
    A aplicação analisará esta pasta sem alterar os ficheiros
    originais.
  </span>
</label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Data de receção *
              </span>

              <input
                required
                type="date"
                value={form.received_date}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    received_date: event.target.value,
                  }))
                }
                className={inputClass}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Prazo pedido
              </span>

              <input
                type="date"
                value={form.requested_deadline}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    requested_deadline: event.target.value,
                  }))
                }
                className={inputClass}
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Quantidades *
            </span>

            <input
              required
              value={form.quantities}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  quantities: event.target.value,
                }))
              }
              className={inputClass}
              placeholder="Ex.: 50, 100, 200"
            />

            <span className="mt-1.5 block text-xs text-slate-500">
              Separa as várias quantidades por vírgulas.
            </span>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Estado *
            </span>

            <select
              required
              value={form.status}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  status: event.target.value as QuotationStatus,
                }))
              }
              className={inputClass}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Contacto do cliente
            </span>

            <input
              value={form.customer_contact}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  customer_contact: event.target.value,
                }))
              }
              className={inputClass}
              placeholder="Nome ou email do contacto"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Observações
            </span>

            <textarea
              rows={4}
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              className={inputClass}
              placeholder="Informação relevante sobre o pedido..."
            />
          </label>
        </form>

        <footer className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            type="submit"
            form="quotation-form"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving && (
              <LoaderCircle size={17} className="animate-spin" />
            )}

            {quotation ? "Guardar alterações" : "Guardar pedido"}
          </button>
        </footer>
      </aside>

      {showFolderBrowser && (
        <QuotationSourceFolderBrowser
          onClose={() => setShowFolderBrowser(false)}
          onSelect={(path) =>
            setForm((current) => ({
              ...current,
              source_folder_path: path,
            }))
          }
        />
      )}
    </div>
  );
}