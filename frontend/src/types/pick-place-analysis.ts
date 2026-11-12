export type PickPlaceSide =
  | "top"
  | "bottom"
  | "unknown";


export type PickPlaceAnalysisLine = {
  row_number: number;
  designator: string;
  value: string | null;
  footprint: string | null;
  part_number: string | null;
  description: string | null;
  x_raw: number;
  y_raw: number;
  x_mm: number;
  y_mm: number;
  rotation_degrees: number;
  side: PickPlaceSide;
  is_valid: boolean;
  warnings: string[];
  additional_fields: Record<string, string | null>;
};


export type PickPlaceBounds = {
  minimum_x_mm: number;
  maximum_x_mm: number;
  minimum_y_mm: number;
  maximum_y_mm: number;
  width_mm: number;
  height_mm: number;
};


export type PickPlaceAnalysisResponse = {
  quotation_file_id: string;
  original_name: string;
  source_format: string;
  coordinate_unit:
    | "mil"
    | "mm"
    | "inch"
    | "unknown";
  side:
    | "top"
    | "bottom"
    | "mixed"
    | "unknown";
  placement_count: number;
  valid_placement_count: number;
  warning_count: number;
  bounds: PickPlaceBounds;
  items: PickPlaceAnalysisLine[];
};