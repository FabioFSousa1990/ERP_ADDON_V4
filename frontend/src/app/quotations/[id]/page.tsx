"use client";
import { QuotationFilesPanel } from "@/components/quotations/quotation-files-panel";
import { QuotationSourceFolderPanel } from "@/components/quotations/quotation-source-folder-panel";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  FileText,
  LoaderCircle,
  Package,
  Pencil,
  UserRound,
} from "lucide-react";
import { QuotationForm } from "@/components/quotations/quotation-form";
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
  QuotationStatus,
} from "@/types/quotation-request";
import { QuotationArtifactsPanel } from "@/components/quotations/quotation-artifacts-panel";


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


function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-PT");
}


export default function QuotationDetailPage() {
  const params = useParams<{ id: string }>();
  const quotationId = params.id;
  const [filesRefreshKey, setFilesRefreshKey] = useState(0);
  const [quotation, setQuotation] =
    useState<QuotationRequest | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showEditForm, setShowEditForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadQuotation = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const quotationData = await apiRequest<QuotationRequest>(
        `/quotation-requests/${quotationId}`,
      );

      const productData = await apiRequest<Product>(
        `/products/${quotationData.product_id}`,
      );

      const [
        customerData,
        customersData,
        productsData,
      ] = await Promise.all([
        apiRequest<Customer>(
          `/customers/${productData.customer_id}`,
        ),
        apiRequest<CustomerListResponse>(
          "/customers?include_inactive=true&limit=200",
        ),
        apiRequest<ProductListResponse>(
          "/products?include_inactive=true&limit=200",
        ),
      ]);

      setQuotation(quotationData);
      setProduct(productData);
      setCustomer(customerData);
      setCustomers(customersData.items);
      setProducts(productsData.items);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível carregar o pedido de cotação.",
      );
    } finally {
      setLoading(false);
    }
  }, [quotationId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadQuotation();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadQuotation]);

  function openEditForm() {
  setFormError(null);
  setShowEditForm(true);
}

function closeEditForm() {
  if (saving) {
    return;
  }

  setFormError(null);
  setShowEditForm(false);
}

async function saveQuotation(
  payload: QuotationRequestCreate,
) {
  setSaving(true);
  setFormError(null);

  try {
    await apiRequest<QuotationRequest>(
      `/quotation-requests/${quotationId}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );

    setShowEditForm(false);
    await loadQuotation();
  } catch (requestError) {
    setFormError(
      requestError instanceof Error
        ? requestError.message
        : "Não foi possível atualizar a cotação.",
    );
  } finally {
    setSaving(false);
  }
}


  if (loading) {
    return (
      <div className="flex min-h-80 items-center justify-center">
        <span className="inline-flex items-center gap-2 text-slate-500">
          <LoaderCircle size={20} className="animate-spin" />
          A carregar pedido...
        </span>
      </div>
    );
  }

  if (error || !quotation || !product || !customer) {
    return (
      <div className="space-y-5">
        <Link
          href="/quotations"
          className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
        >
          <ArrowLeft size={17} />
          Voltar às cotações
        </Link>

        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {error ?? "Pedido de cotação não encontrado."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/quotations"
          className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
        >
          <ArrowLeft size={17} />
          Voltar às cotações
        </Link>

        <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-blue-600">
              Pedido de cotação
            </p>

            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
              {product.name}
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              {customer.name}
              {product.customer_reference
                ? ` · ${product.customer_reference}`
                : ""}
              {product.revision
                ? ` · Revisão ${product.revision}`
                : ""}
            </p>
          </div>

<div className="flex items-center gap-3">
  <span className="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700">
    {statusLabels[quotation.status]}
  </span>

  <button
    type="button"
    onClick={openEditForm}
    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
  >
    <Pencil size={16} />
    Editar cotação
  </button>
</div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <UserRound size={19} className="text-blue-500" />

          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Cliente
          </p>

          <p className="mt-1 font-semibold text-slate-900">
            {customer.name}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <Package size={19} className="text-violet-500" />

          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Produto
          </p>

          <p className="mt-1 font-semibold text-slate-900">
            {product.name}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <CalendarDays size={19} className="text-amber-500" />

          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Recebido
          </p>

          <p className="mt-1 font-semibold text-slate-900">
            {formatDate(quotation.received_date)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <CalendarDays size={19} className="text-red-500" />

          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Prazo pedido
          </p>

          <p className="mt-1 font-semibold text-slate-900">
            {formatDate(quotation.requested_deadline)}
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">
          Quantidades solicitadas
        </h2>

        <div className="mt-4 flex flex-wrap gap-2">
          {quotation.quantities.map((item) => (
            <span
              key={item.id}
              className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-bold text-slate-800"
            >
              {item.quantity} un.
            </span>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950">
            <UserRound size={19} />
            Contacto
          </h2>

          <p className="mt-4 text-sm text-slate-600">
            {quotation.customer_contact ?? "Sem contacto indicado."}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950">
            <FileText size={19} />
            Observações
          </h2>

          <p className="mt-4 whitespace-pre-wrap text-sm text-slate-600">
            {quotation.notes ?? "Sem observações."}
          </p>
        </div>
      </section>

<QuotationSourceFolderPanel
  quotationRequestId={quotation.id}
  sourceFolderPath={quotation.source_folder_path}
  onImported={() =>
    setFilesRefreshKey((current) => current + 1)
  }
/>

<QuotationFilesPanel
  quotationRequestId={quotation.id}
  refreshKey={filesRefreshKey}
/>
<QuotationArtifactsPanel
  quotationRequestId={quotation.id}
/>
{showEditForm && (
  <QuotationForm
    quotation={quotation}
    customers={customers}
    products={products}
    saving={saving}
    error={formError}
    onClose={closeEditForm}
    onSubmit={saveQuotation}
  />
)}
    </div>
  );
}