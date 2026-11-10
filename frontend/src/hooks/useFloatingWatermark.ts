import { useState, useEffect, useCallback } from 'react';

/**
 * Kiểu định dạng & Hướng bố cục Watermark ngẫu nhiên (chuẩn phong cách Microsoft Word)
 */
export type WatermarkOrientationType =
  | 'diagonal-center' // Chéo dưới-trái lên trên-phải (chuẩn Word DRAFT 1 / CONFIDENTIAL 1)
  | 'horizontal-center' // Nằm ngang chính giữa trang (chuẩn Word DRAFT 2 / CONFIDENTIAL 2)
  | 'reverse-diagonal' // Chéo trên-trái xuống dưới-phải (chuẩn Word SAMPLE 1 / DO NOT COPY 1)
  | 'upper-diagonal' // Chéo phần trên (Quốc hiệu / Tiêu ngữ / Quyết định)
  | 'lower-diagonal' // Chéo phần dưới (Điều khoản / Chữ ký / Nơi nhận)
  | 'upper-horizontal' // Nằm ngang phần trên
  | 'lower-horizontal' // Nằm ngang phần dưới
  | 'dual-band-diagonal'; // Hai dải trên - dưới song song

export interface WatermarkPreset {
  id: string;
  name: string;
  type: WatermarkOrientationType;
  angle: number; // Góc nghiêng (độ)
  top: number; // % vị trí dọc trên khổ A4 (neo trung tâm)
  left: number; // % vị trí ngang trên khổ A4 (neo trung tâm)
  isDual?: boolean; // Nếu là kiểu 2 dải đặt trên đặt dưới
  dualTop1?: number;
  dualTop2?: number;
  fontSizeClass: string; // Tailwind class cho font size 1 dòng duy nhất
  titleSize?: string; // Tương thích ngược
  subSize?: string;
}

/**
 * Danh mục 8 kiểu dáng bố cục Watermark đa hướng (chuẩn Word Watermarks):
 * - Vắt chéo dưới-trái lên trên-phải (-30deg)
 * - Nằm ngang giữa trang (0deg)
 * - Vắt chéo trên-trái xuống dưới-phải (+30deg)
 * - Đặt trên, đặt dưới, nằm ngang trên, nằm ngang dưới
 * - Hai dải song song khóa cả 2 đầu văn bản
 * 
 * TẤT CẢ ĐỀU HIỂN THỊ TRÊN 1 DÒNG DUY NHẤT:
 * [TÊN CUỐI] - [HH:mm] - [DD/MM/YYYY] (Ví dụ: NAM - 08:44 - 29/10/2026)
 * Chữ to bản, đậm nét, nằm trọn vẹn trong khổ giấy A4, không bao giờ bị cắt chữ.
 */
export const WATERMARK_PRESETS: WatermarkPreset[] = [
  // 1. Chéo dưới-trái lên trên-phải (Kinh điển: CONFIDENTIAL 1 / DRAFT 1)
  {
    id: 'diagonal-center',
    name: 'Chéo trung tâm vắt lên',
    type: 'diagonal-center',
    angle: -30,
    top: 50,
    left: 50,
    fontSizeClass: 'text-base sm:text-lg md:text-xl lg:text-[22px]',
    titleSize: 'text-xl md:text-[22px]',
    subSize: 'text-sm',
  },
  // 2. Nằm ngang trung tâm (Kinh điển: CONFIDENTIAL 2 / DRAFT 2)
  {
    id: 'horizontal-center',
    name: 'Nằm ngang trung tâm',
    type: 'horizontal-center',
    angle: 0,
    top: 50,
    left: 50,
    fontSizeClass: 'text-base sm:text-lg md:text-xl lg:text-[22px]',
    titleSize: 'text-xl md:text-[22px]',
    subSize: 'text-sm',
  },
  // 3. Chéo trên-trái xuống dưới-phải (Mẫu Word: SAMPLE 1 / DO NOT COPY 1)
  {
    id: 'reverse-diagonal',
    name: 'Chéo ngược vắt xuống',
    type: 'reverse-diagonal',
    angle: 30,
    top: 50,
    left: 50,
    fontSizeClass: 'text-base sm:text-lg md:text-xl lg:text-[22px]',
    titleSize: 'text-xl md:text-[22px]',
    subSize: 'text-sm',
  },
  // 4. Chéo đặt phần trên (Khóa phần Quốc hiệu, Tiêu ngữ, Quyết định ban hành)
  {
    id: 'upper-diagonal',
    name: 'Chéo phần trên văn bản',
    type: 'upper-diagonal',
    angle: -25,
    top: 32,
    left: 50,
    fontSizeClass: 'text-base sm:text-lg md:text-xl lg:text-[21px]',
    titleSize: 'text-lg md:text-[20px]',
    subSize: 'text-sm',
  },
  // 5. Chéo đặt phần dưới (Khóa phần Thẩm quyền, Chữ ký, Nơi nhận)
  {
    id: 'lower-diagonal',
    name: 'Chéo phần dưới văn bản',
    type: 'lower-diagonal',
    angle: -25,
    top: 68,
    left: 50,
    fontSizeClass: 'text-base sm:text-lg md:text-xl lg:text-[21px]',
    titleSize: 'text-lg md:text-[20px]',
    subSize: 'text-sm',
  },
  // 6. Nằm ngang phần trên
  {
    id: 'upper-horizontal',
    name: 'Ngang phần trên văn bản',
    type: 'upper-horizontal',
    angle: 0,
    top: 34,
    left: 50,
    fontSizeClass: 'text-base sm:text-lg md:text-xl lg:text-[21px]',
    titleSize: 'text-lg md:text-[20px]',
    subSize: 'text-sm',
  },
  // 7. Nằm ngang phần dưới
  {
    id: 'lower-horizontal',
    name: 'Ngang phần dưới văn bản',
    type: 'lower-horizontal',
    angle: 0,
    top: 66,
    left: 50,
    fontSizeClass: 'text-base sm:text-lg md:text-xl lg:text-[21px]',
    titleSize: 'text-lg md:text-[20px]',
    subSize: 'text-sm',
  },
  // 8. Đặt trên đặt dưới (2 dải song song khóa cả 2 đầu văn bản)
  {
    id: 'dual-band-diagonal',
    name: 'Hai dải trên - dưới song song',
    type: 'dual-band-diagonal',
    angle: -28,
    top: 50,
    left: 50,
    isDual: true,
    dualTop1: 30,
    dualTop2: 70,
    fontSizeClass: 'text-sm sm:text-base md:text-lg lg:text-[19px]',
    titleSize: 'text-base md:text-lg',
    subSize: 'text-xs',
  },
];

export function pickRandomWatermarkPreset(): WatermarkPreset {
  const index = Math.floor(Math.random() * WATERMARK_PRESETS.length);
  return WATERMARK_PRESETS[index];
}

/**
 * Định dạng tên hiển thị đầy đủ của người dùng (không bị mất chữ, hiển thị trọn vẹn họ và tên):
 * Ví dụ: "Nguyễn Mạnh Nam" -> "NGUYỄN MẠNH NAM", "Trần Văn A" -> "TRẦN VĂN A"
 */
export function toTitleCase(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function formatUserDisplayName(fullName?: string, username?: string): string {
  if (fullName && fullName.trim()) {
    return toTitleCase(fullName.trim());
  }
  if (username && username.trim()) {
    return toTitleCase(username.trim());
  }
  return 'Sĩ Quan';
}

/**
 * Trích xuất chỉ mỗi tên cuối (given name) của người dùng:
 * Ví dụ: "Nguyễn Mạnh Nam" -> "NAM", "Trần Văn A" -> "A"
 */
export function extractUserLastName(fullName?: string, username?: string): string {
  if (fullName && fullName.trim()) {
    const parts = fullName.trim().split(/\s+/);
    const last = parts[parts.length - 1];
    if (last) return toTitleCase(last);
  }
  if (username && username.trim()) {
    return toTitleCase(username.trim());
  }
  return 'Sĩ Quan';
}

/**
 * Format thời gian hiển thị watermark dạng [HH:mm] - [DD/MM/YYYY]
 */
export function formatWatermarkDateTime(date: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const day = pad(date.getDate());
  const month = pad(date.getMonth() + 1);
  const year = date.getFullYear();

  return `${hours}:${minutes} - ${day}/${month}/${year}`;
}

/**
 * Custom hook quản lý Watermark cố định đa kiểu:
 * - Khi mở tài liệu: Random chọn 1 kiểu dáng / hướng / vị trí trong số preset và GIỮ CỐ ĐỊNH vị trí đó (không nhấp nháy chuyển động).
 * - Khi đóng/mở lại tài liệu hoặc đổi tài liệu khác: Tự động đổi sang 1 kiểu dáng khác ngẫu nhiên.
 */
export function useRandomWatermarkPreset(documentId?: string) {
  const [preset, setPreset] = useState<WatermarkPreset>(pickRandomWatermarkPreset);
  const [currentTimeStr, setCurrentTimeStr] = useState<string>(() => formatWatermarkDateTime(new Date()));

  const refreshPreset = useCallback(() => {
    setPreset(pickRandomWatermarkPreset());
    setCurrentTimeStr(formatWatermarkDateTime(new Date()));
  }, []);

  // Đổi kiểu dáng mới khi mở tài liệu khác
  useEffect(() => {
    refreshPreset();
  }, [documentId, refreshPreset]);

  return {
    preset,
    currentTimeStr,
    refreshPreset,
  };
}
