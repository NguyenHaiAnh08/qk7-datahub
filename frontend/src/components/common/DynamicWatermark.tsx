import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  formatUserDisplayName,
  formatWatermarkDateTime,
} from '../../hooks/useFloatingWatermark';

export interface DynamicWatermarkProps {
  /** Văn bản watermark tùy chỉnh hoàn toàn (nếu muốn override) */
  customText?: string;
  /** Tên hiển thị thủ công nếu muốn override */
  userName?: string;
  /** ID của tài liệu để làm mới kiểu dáng ngẫu nhiên khi chuyển văn bản */
  documentId?: string;
  /** Thời gian chuẩn máy chủ NTP (chống giả mạo giờ máy trạm) */
  serverTime?: Date;
  /** Mã định danh truy vết duy nhất từ ACCESS_LOG (REF-...) */
  traceId?: string;
  /** Mức độ mờ hiển thị (mặc định: 0.18, trong khoảng 0.15 - 0.22) */
  targetOpacity?: number;
  /** Tùy chọn class bổ sung */
  className?: string;
}

/**
 * 4 Vị trí Watermark trải đều các khung trên khổ giấy A4:
 * - Khung 1 (18%): Đầu trang (khóa Quốc hiệu, Tiêu ngữ, Số hiệu ban hành)
 * - Khung 2 (38%): Thân trên (khóa Trích yếu, Thẩm quyền, Căn cứ)
 * - Khung 3 (62%): Thân dưới (khóa Nội dung điều khoản, Quy chế)
 * - Khung 4 (82%): Chân trang (khóa Nơi nhận, Chữ ký chỉ huy, Con dấu)
 */
export const WATERMARK_4_POSITIONS = [
  { id: 'frame-1', top: 18, name: 'Khung đầu trang' },
  { id: 'frame-2', top: 38, name: 'Khung thân trên' },
  { id: 'frame-3', top: 62, name: 'Khung thân dưới' },
  { id: 'frame-4', top: 82, name: 'Khung chân trang' },
];

/**
 * Dynamic Security & DRM Watermark (Bộ 4 Watermark trải đều các khung, Dính chặt vào tài liệu)
 * 
 * ĐẶC ĐIỂM:
 * 1. Tổng cộng 4 watermark được trải đều 4 khung dọc theo văn bản (18%, 38%, 62%, 82%).
 * 2. Định dạng chuẩn hóa 1 hàng duy nhất: [Họ và tên] - [HH:mm - DD/MM/YYYY] (ví dụ: Lương Nhật Thắng - 11:04 - 30/10/2026).
 * 3. Chữ thanh thoát, nằm trọn vẹn trong khung A4, tuyệt đối không tràn ra ngoài nền đen.
 * 4. Khóa chặt mọi vùng trang để chống chụp trộm hoặc cắt cúp tài liệu.
 */
export const DynamicWatermark: React.FC<DynamicWatermarkProps> = ({
  customText,
  userName: propUserName,
  serverTime,
  targetOpacity = 0.18,
  className = '',
}) => {
  const { user } = useAuth();
  const timeStr = React.useMemo(() => formatWatermarkDateTime(serverTime || new Date()), [serverTime]);
  const displayName = formatUserDisplayName(propUserName || user?.full_name, user?.username);
  const watermarkText = customText || `${displayName} - ${timeStr}`;

  return (
    <div
      className="absolute inset-0 pointer-events-none select-none overflow-hidden z-50 flex items-center justify-center"
      aria-hidden="true"
    >
      {/* Khung giới hạn neo chuẩn xác theo tỷ lệ A4 (210 / 297) */}
      <div
        style={{ aspectRatio: '210 / 297' }}
        className="relative h-full max-h-[96%] w-auto aspect-[210/297] max-w-[92%] flex items-center justify-center pointer-events-none overflow-hidden"
      >
        {WATERMARK_4_POSITIONS.map((pos) => (
          <div
            key={pos.id}
            style={{
              top: `${pos.top}%`,
              left: '50%',
              transform: 'translate(-50%, -50%) rotate(-25deg)',
              opacity: targetOpacity,
            }}
            className={`absolute text-center whitespace-nowrap font-mono select-none pointer-events-none drop-shadow-xs text-[#b91c1c] text-xs sm:text-sm md:text-base lg:text-[17px] tracking-wider ${className}`}
          >
            {watermarkText}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DynamicWatermark;
