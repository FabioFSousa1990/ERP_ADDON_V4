export type QuotationStatus =
  | "received"
  | "in_analysis"
  | "waiting_customer"
  | "waiting_supplier"
  | "ready"
  | "sent"
  | "accepted"
  | "rejected"
  | "cancelled";

export type QuotationQuantity = {
  id: string;
  quantity: number;
  created_at: string;
};

export type QuotationRequest = {
  id: string;
  product_id: string;
  received_date: string;
  requested_deadline: string | null;
  status: QuotationStatus;
  customer_contact: string | null;
  notes: string | null;
  quantities: QuotationQuantity[];
  created_at: string;
  updated_at: string;
};

export type QuotationRequestCreate = {
  product_id: string;
  received_date: string;
  requested_deadline: string | null;
  status: QuotationStatus;
  customer_contact: string | null;
  notes: string | null;
  quantities: number[];
};

export type QuotationRequestUpdate =
  Partial<QuotationRequestCreate>;

export type QuotationRequestListResponse = {
  items: QuotationRequest[];
  total: number;
  received: number;
  in_progress: number;
  sent: number;
  closed: number;
  offset: number;
  limit: number;
};