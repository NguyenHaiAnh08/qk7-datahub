import React from 'react';

/**
 * DongSonDrumBackground: Trống đồng Đông Sơn & Bản đồ chữ S Việt Nam
 * - Tầng z-10: Nằm giữa lớp Video nền (z-0) và Khung Đăng nhập (z-20)
 * - Xoay chậm theo chiều kim đồng hồ (120s/vòng)
 * - Giữ 100% màu sắc gốc tự nhiên của bronze-drum-4k.png
 * - Hiệu ứng mờ dần đều ra viền ngoài (radial vignette mask) hòa quyện vào video nền
 */
export const DongSonDrumBackground: React.FC = () => {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-10 select-none">
      <div className="relative w-[680px] h-[680px] sm:w-[840px] sm:h-[840px] md:w-[1020px] md:h-[1020px] lg:w-[1180px] lg:h-[1180px] xl:w-[1280px] xl:h-[1280px] shrink-0 flex items-center justify-center bronze-drum-radial-fade">
        {/* Hình ảnh Trống đồng xoay theo chiều kim đồng hồ, giữ nguyên màu sắc gốc không phủ filter, viền mờ dần ra xung quanh */}
        <img
          src="/bronze-drum-4k.png"
          alt="Họa tiết Trống đồng Quân khu 7"
          className="w-full h-full object-contain animate-spin-slow select-none pointer-events-none"
          style={{ willChange: 'transform' }}
        />
      </div>
    </div>
  );
};
