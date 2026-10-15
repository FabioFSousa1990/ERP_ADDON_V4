export type QuotationArtifactType =
  | "pcb_top_preview"
  | "pcb_bottom_preview"
  | "assembly_top_preview"
  | "assembly_bottom_preview"
  | "normalized_bom"
  | "validation_report";


export type QuotationArtifact = {
  id: string;
  quotation_request_id: string;
  source_file_id: string | null;
  artifact_type: QuotationArtifactType;
  display_name: string;
  media_type: string | null;
  size_bytes: number;
  sha256: string;
  generator: string;
  generation_version: string;
  created_at: string;
};


export type QuotationArtifactListResponse = {
  items: QuotationArtifact[];
  total: number;
};