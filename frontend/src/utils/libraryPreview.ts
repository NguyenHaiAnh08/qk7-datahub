import type { DocumentItem } from '../types';
import type { LibraryItem } from '../types/library';

/** Chuyển tài liệu thư viện sang dạng mà trình xem tài liệu dùng chung hiểu được */
export function toPreviewDocument(item: LibraryItem): DocumentItem {
  return {
    ...item,
    document_code: item.document_code || item.category_name,
    unit_name: item.unit_name || undefined,
    security_level_id: 1, // thư viện luôn công khai
  } as DocumentItem;
}
