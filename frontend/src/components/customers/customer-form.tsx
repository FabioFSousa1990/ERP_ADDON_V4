"use client";

import { FormEvent, useState } from "react";
import { LoaderCircle, X } from "lucide-react";

import type { Customer, CustomerCreate } from "@/types/customer";

type CustomerFormProps = {
  customer: Customer | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (payload: CustomerCreate) => Promise<void>;
};

type FormState = {
  name: string;
  erp_code: string;
  vat_number: string;
  email: string;
  phone: string;
  notes: string;
};

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

function initialForm(customer: Customer | null): FormState {
  return {
    name: customer?.name ?? "",
    erp_code: customer?.erp_code ?? "",
    vat_number: customer?.vat_number ?? "",
    email: customer?.email ?? "",
    phone: customer?.phone ?? "",
    notes: customer?.notes ?? "",
  };
}

export function CustomerForm({
  customer,
  saving,
  error,
  onClose,
  onSubmit,
}: CustomerFormProps) {
  const [form, setForm] = useState<FormState>(() => initialForm(customer));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await onSubmit({
      name: form.name.trim(),
      erp_code: form.erp_code.trim() || null,
      vat_number: form.vat_number.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
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

      <aside className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              {customer ? "Editar cliente" : "Novo cliente"}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {customer
                ? "Atualiza os dados ou associa o cliente ao ERP."
                : "O código ERP e o NIF podem ser indicados posteriormente."}
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
          id="customer-form"
          onSubmit={(event) => void handleSubmit(event)}
          className="flex-1 space-y-5 overflow-y-auto px-6 py-6"
        >
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Nome do cliente *
            </span>

            <input
              required
              autoFocus
              maxLength={200}
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              className={inputClass}
              placeholder="Nome do cliente"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
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
                placeholder="Opcional"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                NIF
              </span>

              <input
                value={form.vat_number}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    vat_number: event.target.value,
                  }))
                }
                className={inputClass}
                placeholder="Opcional"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Email
              </span>

              <input
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                className={inputClass}
                placeholder="email@empresa.pt"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Telefone
              </span>

              <input
                value={form.phone}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
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

            <textarea
              rows={5}
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              className={inputClass}
              placeholder="Informação relevante sobre o cliente..."
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
            form="customer-form"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving && <LoaderCircle size={17} className="animate-spin" />}
            {customer ? "Guardar alterações" : "Guardar cliente"}
          </button>
        </footer>
      </aside>
    </div>
  );
}