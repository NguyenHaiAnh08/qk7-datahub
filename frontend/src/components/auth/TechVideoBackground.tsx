import React, { useRef, useEffect, useState } from 'react';

/**
 * TechVideoBackground: Video nền công nghệ số vòng lặp (Looping Tech Video Background)
 * - Tầng z-0: Phủ toàn màn hình, tự động thích ứng độ tương phản Light / Dark Mode
 * - Hỗ trợ playsInline cho iPad M4 và mobile
 * - Tích hợp gradient overlay làm nổi bật khung đăng nhập trung tâm
 * - Có cơ chế dự phòng (Fallback) nếu trình duyệt không tải được video
 */
export const TechVideoBackground: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    // Đảm bảo video tự động play mượt mà trên cả PC Widescreen và iPad Air M4
    if (videoRef.current) {
      videoRef.current.play().catch((err) => {
        // Tự động retry hoặc fallback nếu trình duyệt yêu cầu tương tác
        console.warn('Video background autoplay blocked or waiting for gesture:', err);
      });
    }
  }, []);

  return (
    <div className="fixed inset-0 w-full h-full object-cover pointer-events-none z-0 overflow-hidden bg-slate-100 dark:bg-[#090e17] transition-colors duration-500">
      {/* 1. LỚP THẺ VIDEO HTML5 CÔNG NGHỆ CHẠY VÒNG LẶP */}
      {!videoError ? (
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          onError={() => setVideoError(true)}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0 opacity-40 dark:opacity-65 [filter:brightness(1.1)_contrast(1.05)_saturate(1.2)] dark:[filter:brightness(0.85)_contrast(1.2)] transition-opacity duration-500"
        >
          <source src="/videos/tech-matrix-bg.mp4" type="video/mp4" />
        </video>
      ) : (
        /* Dự phòng (Fallback) nếu không load được video: hiển thị nền gradient công nghệ số */
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-[#090e17] to-emerald-950 opacity-90" />
      )}

      {/* 2. LỚP PHỦ GRADIENT TỐI NHẸ NỔI BẬT KHUNG ĐĂNG NHẬP Ở GIỮA */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/50 pointer-events-none z-[1]" />

      {/* 3. LƯỚI TỌA ĐỘ QUÂN SỰ PHÒNG TRỰC BAN AN NINH (DARK MODE) */}
      <div className="absolute inset-0 hidden dark:block bg-[linear-gradient(to_right,#1e293b12_1px,transparent_1px),linear-gradient(to_bottom,#1e293b12_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none z-[2]" />
    </div>
  );
};
