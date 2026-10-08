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

export type SourceFileCandidate = {
  relative_path: string;
  name: string;
  size_bytes: number;
  modified_at: string;
  suggested_type: QuotationFileType;
  already_imported: boolean;
};

export type SourceFolderScanResponse = {
  source_folder_path: string;
  items: SourceFileCandidate[];
  total: number;
  truncated: boolean;
};

export type SourceFileImportItem = {
  relative_path: string;
  file_type: QuotationFileType;
  revision: string | null;
  notes: string | null;
};

export type SourceFolderImportRequest = {
  items: SourceFileImportItem[];
};

export type SourceFolderImportResponse = {
  items: QuotationFile[];
  imported: number;
  skipped_duplicates: number;
};

export type SourceRootOption = {
  index: number;
  name: string;
  path: string;
};

export type SourceDirectoryEntry = {
  name: string;
  relative_path: string;
};

export type SourceFolderBrowseResponse = {
  roots: SourceRootOption[];
  root_index: number;
  root_path: string;
  current_path: string;
  current_relative_path: string;
  parent_relative_path: string | null;
  directories: SourceDirectoryEntry[];
};