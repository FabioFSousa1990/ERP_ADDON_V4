"use client";

import { FormEvent, useState } from "react";
import { LoaderCircle, X } from "lucide-react";

import type { Customer } from "@/types/customer";
import type { Product, ProductCreate } from "@/types/product";


type ProductFormProps = {
  product: Product | null;
  customers: Customer[];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (payload: ProductCreate) => Promise<void>;
};


type FormState = {
  customer_id: string;
  name: string;
  customer_reference: string;
  revision: string;
  erp_code: string;
  folder_path: string;
  notes: string;
};


const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";


function initialForm(product: Product | null): FormState {
  return {
    customer_id: product?.customer_id ?? "",
    name: product?.name ?? "",
    customer_reference: product?.customer_reference ?? "",
    revision: product?.revision ?? "",
    erp_code: product?.erp_code ?? "",
    folder_path: product?.folder_path ?? "",
    notes: product?.notes ?? "",
  };
}


export function ProductForm({
  product,
  customers,
  saving,
  error,
  onClose,
  onSubmit,
}: ProductFormProps) {
  const [form, setForm] = useState<FormState>(() => initialForm(product));

  const availableCustomers = customers.filter(
    (customer) =>
      customer.is_active || customer.id === product?.customer_id,
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await onSubmit({
      customer_id: form.customer_id,
      name: form.name.trim(),
      customer_reference: form.customer_reference.trim() || null,
      revision: form.revision.trim() || null,
      erp_code: form.erp_code.trim() || null,
      folder_path: form.folder_path.trim() || null,
      notes: form.notes.trim() || null,
    });
  }

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
              {product ? "Editar produto" : "Novo produto"}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              O produto pode ser criado antes da associação ao ERP.
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

        {error && (
          <div className="border-b border-red-200 bg-red-50 px-6 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form
          id="product-form"
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
              Nome do produto *
            </span>

            <input
              required
              maxLength={200}
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              className={inputClass}
              placeholder="Nome do produto"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Referência do cliente
              </span>

              <input
                value={form.customer_reference}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    customer_reference: event.target.value,
                  }))
                }
                className={inputClass}
                placeholder="Opcional"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Revisão
              </span>

              <input
                value={form.revision}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    revision: event.target.value,
                  }))
                }
                className={inputClass}
                placeholder="Ex.: A"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Código ERP
            </span>

            <input
              value={form.erp_code}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  erp_code: event.target.value,
                }))
              }
              className={inputClass}
              placeholder="Preencher após associação ao ERP"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Caminho da pasta no servidor
            </span>

            <input
              value={form.folder_path}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  folder_path: event.target.value,
                }))
              }
              className={inputClass}
              placeholder="\\servidor\Clientes\Cliente\Produto"
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
              placeholder="Informação relevante sobre o produto..."
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
            form="product-form"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving && <LoaderCircle size={17} className="animate-spin" />}
            {product ? "Guardar alterações" : "Guardar produto"}
          </button>
        </footer>
      </aside>
    </div>
  );
}