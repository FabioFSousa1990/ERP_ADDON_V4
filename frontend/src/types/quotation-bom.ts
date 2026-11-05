export type QuotationBomLine = {
  id: string;
  bom_version_id: string;
  source_row_number: number;
  reference_designator: string | null;
  designators: string[];
  quantity: number;
  name: string | null;
  description: string | null;
  do_not_place: boolean;
  footprint: string | null;
  manufacturer_reference: string | null;
  datasheet: string | null;
  is_valid: boolean;
  warnings: string[];
  created_at: string;
};

export type QuotationBomVersionSummary = {
  id: string;
  quotation_request_id: string;
  source_file_id: string | null;
  version_number: number;
  source_name: string;
  source_sha256: string;
  sheet_name: string;
  header_row: number;
  line_count: number;
  placement_count: number;
  mounted_placement_count: number;
  dnp_placement_count: number;
  warning_count: number;
  is_current: boolean;
  confirmed_at: string;
};

export type QuotationBomVersion =
  QuotationBomVersionSummary & {
    lines: QuotationBomLine[];
  };

export type QuotationBomVersionListResponse = {
  items: QuotationBomVersionSummary[];
  total: number;
};