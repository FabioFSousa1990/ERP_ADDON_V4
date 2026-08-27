export type Product = {
  id: string;
  customer_id: string;
  name: string;
  customer_reference: string | null;
  revision: string | null;
  erp_code: string | null;
  folder_path: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductCreate = {
  customer_id: string;
  name: string;
  customer_reference: string | null;
  revision: string | null;
  erp_code: string | null;
  folder_path: string | null;
  notes: string | null;
};

export type ProductUpdate = Partial<ProductCreate> & {
  is_active?: boolean;
};

export type ProductListResponse = {
  items: Product[];
  total: number;
  associated: number;
  pending_association: number;
  inactive: number;
  offset: number;
  limit: number;
};