import type {
  PickPlaceSide,
} from "@/types/pick-place-analysis";


export type PickPlaceComparisonStatus =
  | "exact_match"
  | "probable_match"
  | "value_mismatch"
  | "only_in_bom"
  | "only_in_pick_place"
  | "dnp_in_pick_place";


export type PickPlaceComparisonItem = {
  status: PickPlaceComparisonStatus;
  bom_designator: string | null;
  pick_place_designator: string | null;
  bom_value: string | null;
  pick_place_value: string | null;
  bom_footprint: string | null;
  pick_place_footprint: string | null;
  do_not_place: boolean;
  x_mm: number | null;
  y_mm: number | null;
  rotation_degrees: number | null;
  side: PickPlaceSide | null;
  reason: string;
};


export type PickPlaceComparisonResponse = {
  quotation_request_id: string;
  bom_version_id: string;
  pick_place_file_id: string;
  bom_placement_count: number;
  pick_place_placement_count: number;
  exact_match_count: number;
  probable_match_count: number;
  value_mismatch_count: number;
  only_in_bom_count: number;
  only_in_pick_place_count: number;
  dnp_in_pick_place_count: number;
  items: PickPlaceComparisonItem[];
};