"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  FileText,
  LoaderCircle,
  Package,
  UserRound,
} from "lucide-react";

import { apiRequest } from "@/lib/api";
import type { Customer } from "@/types/customer";
import type { Product } from "@/types/product";
import type {
  QuotationRequest,
  QuotationStatus,
} from "@/types/quotation-request";


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

  const [quotation, setQuotation] =
    useState<QuotationRequest | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
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

      const customerData = await apiRequest<Customer>(
        `/customers/${productData.customer_id}`,
      );

      setQuotation(quotationData);
      setProduct(productData);
      setCustomer(customerData);
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

          <span className="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700">
            {statusLabels[quotation.status]}
          </span>
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

      <section className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6">
        <h2 className="text-lg font-semibold text-slate-950">
          Ficheiros recebidos
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          Aqui serão associados a BOM, Gerbers, Pick&amp;Place,
          Assembly e outros documentos do pedido.
        </p>
      </section>
    </div>
  );
}