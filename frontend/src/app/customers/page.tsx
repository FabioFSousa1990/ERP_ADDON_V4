"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Archive,
  Building2,
  Link2,
  LoaderCircle,
  Search,
  Unlink,
  Pencil,
  Plus,
  RotateCcw,
} from "lucide-react";

import { apiRequest } from "@/lib/api";
import { CustomerForm } from "@/components/customers/customer-form";
import type {
  Customer,
  CustomerCreate,
  CustomerListResponse,
} from "@/types/customer";


function CustomerStatus({ customer }: { customer: Customer }) {
  if (!customer.is_active) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
        <Archive size={13} />
        Inativo
      </span>
    );
  }

  if (customer.erp_code) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        <Link2 size={13} />
        Associado
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
      <Unlink size={13} />
      Por associar
    </span>
  );
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [associated, setAssociated] = useState(0);
  const [pendingAssociation, setPendingAssociation] = useState(0);
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(
    null,
  );
  const [updatingCustomerId, setUpdatingCustomerId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const query = new URLSearchParams();

      if (search.trim()) {
        query.set("search", search.trim());
      }

      if (includeInactive) {
        query.set("include_inactive", "true");
      }

      const data = await apiRequest<CustomerListResponse>(
        `/customers?${query.toString()}`,
      );

      setCustomers(data.items);
      setTotal(data.total);
      setAssociated(data.associated);
      setPendingAssociation(data.pending_association);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível carregar os clientes.",
      );
    } finally {
      setLoading(false);
    }
  }, [search, includeInactive]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCustomers();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [loadCustomers]);

  function openCreateForm() {
  setEditingCustomer(null);
  setError(null);
  setShowForm(true);
}

function openEditForm(customer: Customer) {
  setEditingCustomer(customer);
  setError(null);
  setShowForm(true);
}

function closeForm() {
  if (saving) {
    return;
  }

  setEditingCustomer(null);
  setShowForm(false);
  setError(null);
}

async function saveCustomer(payload: CustomerCreate) {
  setSaving(true);
  setError(null);

  try {
    const path = editingCustomer
      ? `/customers/${editingCustomer.id}`
      : "/customers";

    await apiRequest<Customer>(path, {
      method: editingCustomer ? "PATCH" : "POST",
      body: JSON.stringify(payload),
    });

    setEditingCustomer(null);
    setShowForm(false);
    await loadCustomers();
  } catch (requestError) {
    setError(
      requestError instanceof Error
        ? requestError.message
        : editingCustomer
          ? "Não foi possível atualizar o cliente."
          : "Não foi possível criar o cliente.",
    );
  } finally {
    setSaving(false);
  }
}
async function toggleCustomerStatus(customer: Customer) {
  const action = customer.is_active ? "desativar" : "reativar";

  const confirmed = window.confirm(
    `Queres ${action} o cliente "${customer.name}"?`,
  );

  if (!confirmed) {
    return;
  }

  setUpdatingCustomerId(customer.id);
  setError(null);

  try {
    if (customer.is_active) {
      await apiRequest<Customer>(`/customers/${customer.id}`, {
        method: "DELETE",
      });
    } else {
      await apiRequest<Customer>(`/customers/${customer.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: true }),
      });
    }

    await loadCustomers();
  } catch (requestError) {
    setError(
      requestError instanceof Error
        ? requestError.message
        : `Não foi possível ${action} o cliente.`,
    );
  } finally {
    setUpdatingCustomerId(null);
  }
}


  return (
    <div className="space-y-6">
<header className="flex items-start justify-between gap-6">
  <div>
    <p className="text-sm font-medium text-blue-600">Dados comerciais</p>

    <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
      Clientes
    </h1>

    <p className="mt-2 text-sm text-slate-500">
      Clientes registados na V4, associados ou ainda não associados ao ERP.
    </p>
  </div>

  <button
    type="button"
    onClick={openCreateForm}
    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
  >
    <Plus size={18} />
    Novo cliente
  </button>
</header>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Clientes apresentados</p>
            <Building2 size={18} className="text-slate-400" />
          </div>

          <p className="mt-3 text-3xl font-bold text-slate-950">{total}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Associados ao ERP</p>
            <Link2 size={18} className="text-emerald-500" />
          </div>

          <p className="mt-3 text-3xl font-bold text-slate-950">{associated}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Por associar</p>
            <Unlink size={18} className="text-amber-500" />
          </div>

          <p className="mt-3 text-3xl font-bold text-slate-950">
            {pendingAssociation}
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-5">
          <div className="flex flex-1 flex-wrap items-center gap-4">
            <div className="relative w-full max-w-md">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="Pesquisar nome, código ERP ou NIF..."
              />
            </div>

            <label className="flex shrink-0 items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(event) =>
                  setIncludeInactive(event.target.checked)
                }
                className="h-4 w-4 rounded border-slate-300 accent-blue-600"
              />
              Mostrar inativos
            </label>
          </div>

          <span className="shrink-0 text-sm text-slate-500">
            {total} {total === 1 ? "cliente" : "clientes"}
          </span>
        </div>

        {error && (
          <div className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Cliente</th>
                <th className="px-5 py-3 font-semibold">Código ERP</th>
                <th className="px-5 py-3 font-semibold">NIF</th>
                <th className="px-5 py-3 font-semibold">Contacto</th>
                <th className="px-5 py-3 font-semibold">Estado</th>
                <th className="px-5 py-3 text-right font-semibold">Ações</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <span className="inline-flex items-center gap-2 text-slate-500">
                      <LoaderCircle size={18} className="animate-spin" />
                      A carregar clientes...
                    </span>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-12 text-center text-slate-500"
                  >
                    Nenhum cliente encontrado.
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="transition hover:bg-slate-50"
                  >
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-900">
                        {customer.name}
                      </p>

                      {customer.notes && (
                        <p className="mt-1 max-w-sm truncate text-xs text-slate-500">
                          {customer.notes}
                        </p>
                      )}
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {customer.erp_code ?? "—"}
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {customer.vat_number ?? "—"}
                    </td>

 <td className="px-5 py-4 text-slate-600">
  {customer.email && <p>{customer.email}</p>}

  {customer.phone && (
    <p className={customer.email ? "mt-1 text-xs text-slate-500" : ""}>
      {customer.phone}
    </p>
  )}

  {!customer.email && !customer.phone && <span>—</span>}
</td>

<td className="px-5 py-4">
  <CustomerStatus customer={customer} />
</td>

<td className="px-5 py-4">
  <div className="flex justify-end gap-2">
    <button
      type="button"
      onClick={() => openEditForm(customer)}
      title="Editar cliente"
      aria-label={`Editar ${customer.name}`}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
    >
      <Pencil size={15} />
    </button>

    <button
      type="button"
      onClick={() => void toggleCustomerStatus(customer)}
      disabled={updatingCustomerId === customer.id}
      title={customer.is_active ? "Desativar cliente" : "Reativar cliente"}
      aria-label={
        customer.is_active
          ? `Desativar ${customer.name}`
          : `Reativar ${customer.name}`
      }
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {updatingCustomerId === customer.id ? (
        <LoaderCircle size={15} className="animate-spin" />
      ) : customer.is_active ? (
        <Archive size={15} />
      ) : (
        <RotateCcw size={15} />
      )}
    </button>
  </div>
</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      {showForm && (
  <CustomerForm
    key={editingCustomer?.id ?? "new"}
    customer={editingCustomer}
    saving={saving}
    error={error}
    onClose={closeForm}
    onSubmit={saveCustomer}
  />
)}
    </div>
  );
}