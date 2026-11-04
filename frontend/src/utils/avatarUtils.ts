/**
 * Lấy 2 chữ cái đại diện Avatar theo chuẩn tiếng Việt:
 * Lấy 2 chữ cái đầu của 2 từ cuối cùng trong họ và tên.
 * 
 * Ví dụ:
 * - "Nguyễn Thị Ánh Tuyết" -> "ÁT" (Ánh + Tuyết)
 * - "Trần Thị Ánh Tuyết"  -> "ÁT" (Ánh + Tuyết)
 * - "Nguyễn Hải Anh"       -> "HA" (Hải + Anh)
 * - "Lương Nhật Thăng"     -> "NT" (Nhật + Thăng)
 * - "Nguyễn Mạnh Nam"      -> "MN" (Mạnh + Nam)
 * - "Phạm Trường Sơn"      -> "TS" (Trường + Sơn)
 * - "Hải Anh"              -> "HA" (Hải + Anh)
 * - "Nam"                  -> "NA"
 * - "Đại biểu" / "Khách"   -> "ĐB"
 */
export function getVietnameseInitials(name?: string, fallback = 'CB'): string {
  if (!name || typeof name !== 'string') return fallback;
  const clean = name.trim();
  if (!clean) return fallback;
  const lower = clean.toLowerCase();
  if (lower === 'đại biểu' || lower === 'khách' || lower === 'guest') return 'ĐB';

  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  // Lấy 2 chữ cái đầu của 2 từ cuối cùng trong tên
  const penult = parts[parts.length - 2];
  const last = parts[parts.length - 1];
  return (penult.charAt(0) + last.charAt(0)).toUpperCase();
}

