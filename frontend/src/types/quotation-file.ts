export type QuotationFileType =
  | "bom"
  | "gerbers"
  | "pick_place"
  | "assembly"
  | "drawing"
  | "other";

export type QuotationFile = {
  id: string;
  quotation_request_id: string;
  file_type: QuotationFileType;
  original_name: string;
  media_type: string | null;
  size_bytes: number;
  sha256: string;
  revision: string | null;
  notes: string | null;
  uploaded_at: string;
};

export type QuotationFileUpdate = {
  file_type?: QuotationFileType;
  revision?: string | null;
  notes?: string | null;
};

export type QuotationFileListResponse = {
  items: QuotationFile[];
  total: number;
};