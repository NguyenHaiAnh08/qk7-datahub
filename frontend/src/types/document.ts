import { Unit } from './user';

export interface DocumentItem {
  file_id: string;
  document_code?: string;
  title: string;
  doc_type_id?: string;
  type_id?: string;
  doc_type_name?: string;
  type_name?: string;
  issued_date?: string;
  issue_date?: string;
  issuing_unit_id?: string;
  unit_id?: string;
  unit_name?: string;
  signer?: string;
  file_size?: number | string;
  file_size_bytes?: number | string;
  summary?: string;
  security_level_id: number;
  security_name?: string;
  security_level_name?: string;
  created_at?: string;
  updated_at?: string;
  original_name?: string;
  stored_path?: string;
  sha256?: string;
  folder_id?: string;
  category_id?: string;
  uploaded_by?: string;
  mime_type?: string;
}

export interface DocumentType {
  type_id: string;
  name: string;
  description?: string;
}

export interface SecurityLevel {
  level_id: number;
  code?: string;
  name: string;
}

export interface SystemHealth {
  ok: boolean;
  db?: string;
  login_name?: string;
  now?: string;
  error?: string;
}

export interface MetaData {
  types: DocumentType[];
  units: Unit[];
  levels: SecurityLevel[];
}

export interface DocumentFilterParams {
  q?: string;
  code?: string;
  title?: string;
  type?: string;
  doc_type_id?: string;
  unit?: string;
  issuing_unit_id?: string;
  from?: string;
  to?: string;
  lv?: number | string;
  security_level_id?: number | string;
}
