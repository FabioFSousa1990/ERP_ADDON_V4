"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CircleCheckBig,
  Clock3,
  FileText,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  Send,
} from "lucide-react";

import { apiRequest } from "@/lib/api";
import type {
  Customer,
  CustomerListResponse,
} from "@/types/customer";
import type {
  Product,
  ProductListResponse,
} from "@/types/product";
import type {
  QuotationRequest,
  QuotationRequestCreate,
  QuotationRequestListResponse,
  QuotationStatus,
} from "@/types/quotation-request";

import { QuotationForm } from "@/components/quotations/quotation-form";

const statusLabels: Record<QuotationStatus, string> = {
  received: "Recebido",
  in_analysis: "Em análise",
  waiting_customer: "Aguarda cliente",
  waiting_supplier: "Aguarda fornecedor",
  ready: "Pronto",
  sent: "Enviado",
  accepted: "Aceite",
  rejected: "Rejeitado",
  cancelled: "Cancelado",
};


function QuotationStatusBadge({
  status,
}: {
  status: QuotationStatus;
}) {
  const styles: Record<QuotationStatus, string> = {
    received: "bg-blue-50 text-blue-700",
    in_analysis: "bg-amber-50 text-amber-700",
    waiting_customer: "bg-orange-50 text-orange-700",
    waiting_supplier: "bg-violet-50 text-violet-700",
    ready: "bg-cyan-50 text-cyan-700",
    sent: "bg-indigo-50 text-indigo-700",
    accepted: "bg-emerald-50 text-emerald-700",
    rejected: "bg-red-50 text-red-700",
    cancelled: "bg-slate-100 text-slate-600",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}


function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-PT");
}


export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<QuotationRequest[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [received, setReceived] = useState(0);
  const [inProgress, setInProgress] = useState(0);
  const [sent, setSent] = useState(0);
  const [closed, setClosed] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingQuotation, setEditingQuotation] =
    useState<QuotationRequest | null>(null);
  const [error, setError] = useState<string | null>(null);

  const productMap = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );

  const customerMap = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers],
  );

  const loadReferences = useCallback(async () => {
    try {
      const [customerData, productData] = await Promise.all([
        apiRequest<CustomerListResponse>(
          "/customers?include_inactive=true&limit=200",
        ),
        apiRequest<ProductListResponse>(
          "/products?include_inactive=true&limit=200",
        ),
      ]);

      setCustomers(customerData.items);
      setProducts(productData.items);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível carregar clientes e produtos.",
      );
    }
  }, []);

  const loadQuotations = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const query = new URLSearchParams();

      if (search.trim()) {
        query.set("search", search.trim());
      }

      if (statusFilter) {
        query.set("request_status", statusFilter);
      }

      const data = await apiRequest<QuotationRequestListResponse>(
        `/quotation-requests?${query.toString()}`,
      );

      setQuotations(data.items);
      setTotal(data.total);
      setReceived(data.received);
      setInProgress(data.in_progress);
      setSent(data.sent);
      setClosed(data.closed);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível carregar os pedidos de cotação.",
      );
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadReferences();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadReferences]);

  useEffect(() => {
  const timer = window.setTimeout(() => {
    void loadQuotations();
  }, 250);

  return () => window.clearTimeout(timer);
}, [loadQuotations]);

  function openCreateForm() {
    setEditingQuotation(null);
    setError(null);
    setShowForm(true);
  }

  function openEditForm(quotation: QuotationRequest) {
    setEditingQuotation(quotation);
    setError(null);
    setShowForm(true);
  }

  function closeForm() {
    if (saving) {
      return;
    }

    setEditingQuotation(null);
    setShowForm(false);
    setError(null);
  }

  async function saveQuotation(payload: QuotationRequestCreate) {
    setSaving(true);
    setError(null);

    try {
      const path = editingQuotation
        ? `/quotation-requests/${editingQuotation.id}`
        : "/quotation-requests";

      await apiRequest<QuotationRequest>(path, {
        method: editingQuotation ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });

      setEditingQuotation(null);
      setShowForm(false);
      await loadQuotations();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : editingQuotation
            ? "Não foi possível atualizar o pedido."
            : "Não foi possível criar o pedido.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="space-y-6">
<header className="flex items-start justify-between gap-6">
  <div>
    <p className="text-sm font-medium text-blue-600">
      Fluxo comercial
    </p>

    <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
      Cotações
    </h1>

    <p className="mt-2 text-sm text-slate-500">
      Pedidos de cotação recebidos, respetivas quantidades e estado
      de preparação.
    </p>
  </div>

  <button
    type="button"
    onClick={openCreateForm}
    className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
  >
    <Plus size={18} />
    Novo pedido
  </button>
</header>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Recebidos</p>
            <FileText size={18} className="text-blue-500" />
          </div>

          <p className="mt-3 text-3xl font-bold text-slate-950">
            {received}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Em curso</p>
            <Clock3 size={18} className="text-amber-500" />
          </div>

          <p className="mt-3 text-3xl font-bold text-slate-950">
            {inProgress}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Enviados</p>
            <Send size={18} className="text-indigo-500" />
          </div>

          <p className="mt-3 text-3xl font-bold text-slate-950">
            {sent}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Fechados</p>
            <CircleCheckBig size={18} className="text-emerald-500" />
          </div>

          <p className="mt-3 text-3xl font-bold text-slate-950">
            {closed}
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-5">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <div className="relative w-full max-w-md">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="Pesquisar cliente, produto ou referência..."
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">Todos os estados</option>

              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <span className="text-sm text-slate-500">
            {total} {total === 1 ? "pedido" : "pedidos"}
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
                <th className="px-5 py-3 font-semibold">Recebido</th>
                <th className="px-5 py-3 font-semibold">Cliente</th>
                <th className="px-5 py-3 font-semibold">Produto</th>
                <th className="px-5 py-3 font-semibold">Quantidades</th>
                <th className="px-5 py-3 font-semibold">Prazo pedido</th>
                <th className="px-5 py-3 font-semibold">Estado</th>
                <th className="px-5 py-3 text-right font-semibold">
  Ações
</th>

              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center">
                    <span className="inline-flex items-center gap-2 text-slate-500">
                      <LoaderCircle size={18} className="animate-spin" />
                      A carregar pedidos...
                    </span>
                  </td>
                </tr>
              ) : quotations.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center text-slate-500"
                  >
                    Nenhum pedido de cotação encontrado.
                  </td>
                </tr>
              ) : (
                quotations.map((quotation) => {
                  const product = productMap.get(quotation.product_id);
                  const customer = product
                    ? customerMap.get(product.customer_id)
                    : undefined;

                  return (
                    <tr
                      key={quotation.id}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="px-5 py-4 text-slate-600">
                        {formatDate(quotation.received_date)}
                      </td>

                      <td className="px-5 py-4 font-medium text-slate-900">
                        {customer?.name ?? "Cliente desconhecido"}
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900">
                          {product?.name ?? "Produto desconhecido"}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {product?.customer_reference ?? "Sem referência"}
                          {product?.revision
                            ? ` · Rev. ${product.revision}`
                            : ""}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {quotation.quantities.map((item) => (
                            <span
                              key={item.id}
                              className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700"
                            >
                              {item.quantity}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {formatDate(quotation.requested_deadline)}
                      </td>

                      <td className="px-5 py-4">
                        <QuotationStatusBadge status={quotation.status} />
                      </td>
                      
                      <td className="px-5 py-4">
  <div className="flex justify-end">
    <button
      type="button"
      onClick={() => openEditForm(quotation)}
      title="Editar pedido"
      aria-label="Editar pedido de cotação"
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
    >
      <Pencil size={15} />
    </button>
  </div>
</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
      {showForm && (
  <QuotationForm
    key={editingQuotation?.id ?? "new"}
    quotation={editingQuotation}
    customers={customers}
    products={products}
    saving={saving}
    error={error}
    onClose={closeForm}
    onSubmit={saveQuotation}
  />
)}
    </div>
  );
}