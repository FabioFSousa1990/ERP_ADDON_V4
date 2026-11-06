export type BomAnalysisLine = {
  row_number: number;
  reference_designator: string | null;
  designators: string[];
  declared_quantity: number | null;
  calculated_quantity: number;
  name: string | null;
  description: string | null;
  do_not_place: boolean;
  footprint: string | null;
  manufacturer_reference: string | null;
  datasheet: string | null;
  is_valid: boolean;
  warnings: string[];
};

export type BomAnalysisResponse = {
status: "success";
  quotation_file_id: string;
  original_name: string;
  sheet_name: string;
  header_row: number;
  line_count: number;
  placement_count: number;
  mounted_placement_count: number;
  dnp_placement_count: number;
  dnp_line_count: number;
  valid_line_count: number;
  warning_count: number;
  items: BomAnalysisLine[];
};

export type BomColumnMapping = {
  reference_designator: number;
  quantity?: number | null;
  name?: number | null;
  description?: number | null;
  dnp?: number | null;
  footprint?: number | null;
  manufacturer_reference?: number | null;
  datasheet?: number | null;
};

export type BomManualMappingRequest = {
  sheet_name: string;
  header_row: number;
  mapping: BomColumnMapping;
};

export type BomColumnOption = {
  column_index: number;
  header: string;
  sample_values: string[];
};

export type BomMappingRequiredResponse = {
  status: "mapping_required";
  quotation_file_id: string;
  original_name: string;
  sheet_name: string;
  header_row: number;
  columns: BomColumnOption[];
};

export type BomAnalysisResult =
  | BomAnalysisResponse
  | BomMappingRequiredResponse;