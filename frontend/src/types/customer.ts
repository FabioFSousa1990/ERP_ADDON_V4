export type Customer = {
  id: string;
  name: string;
  erp_code: string | null;
  vat_number: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CustomerCreate = {
  name: string;
  erp_code: string | null;
  vat_number: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
};

export type CustomerUpdate = Partial<CustomerCreate> & {
  is_active?: boolean;
};

export type CustomerListResponse = {
  items: Customer[];
  total: number;
  offset: number;
  limit: number;
};