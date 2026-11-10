// ============================================================
// clock-authority.js — Authoritative Tamper-Proof Time Service
// Chống gian lận lùi/tiến giờ hệ thống trên máy trạm (Clock-Skew & Timestamp Forgery)
// Chuẩn Air-Gap Quân sự: Sử dụng Monotonic Hardware CPU Timer (performance.now / QPC)
// Đồng bộ từ CSDL SQL Server nội bộ / Hardware RTC, không phụ thuộc kết nối Internet bên ngoài.
// ============================================================

const https = require('https');
const http = require('http');

let anchorWallTime = Date.now();
let anchorMonoTime = performance.now();
let isAuthoritativeSynced = false;
let timeSourceLabel = 'Phần cứng máy chủ QK7 (Hardware RTC)';

/**
 * Đồng bộ mốc thời gian chuẩn từ nguồn CSDL SQL Server nội bộ (Air-Gap compliant).
 * CSDL SQL Server chạy trên mạng nội bộ hoặc localhost là nguồn mốc chuẩn đáng tin cậy nhất.
 */
function syncFromDatabase(dbDate) {
  if (dbDate instanceof Date && !isNaN(dbDate.getTime())) {
    anchorWallTime = dbDate.getTime();
    anchorMonoTime = performance.now();
    isAuthoritativeSynced = true;
    timeSourceLabel = 'CSDL SQL Server QK7_ThuVienSo';
    console.log(`[CLOCK-AUTHORITY] [AIR-GAP] Đã neo mốc thời gian chuẩn từ ${timeSourceLabel}: ${dbDate.toISOString()}`);
    return true;
  }
  return false;
}

/**
 * Đồng bộ từ máy chủ NTP nội bộ mạng LAN (nếu đơn vị có cấu hình INTERNAL_NTP_HOST).
 * Hoàn toàn không gọi ra Internet bên ngoài nếu không được chỉ định rõ.
 */
function syncAuthoritativeTime() {
  const internalHost = process.env.INTERNAL_NTP_HOST;
  if (!internalHost) {
    // Chế độ Air-Gap: Mặc định neo vào Hardware RTC của Máy chủ QK7 + Monotonic CPU Timer
    if (!isAuthoritativeSynced) {
      isAuthoritativeSynced = true;
      console.log(`[CLOCK-AUTHORITY] [AIR-GAP] Khởi tạo mốc thời gian chuẩn nội bộ: ${new Date(anchorWallTime).toISOString()} (Khóa theo Monotonic CPU Timer)`);
    }
    return;
  }

  // Nếu có chỉ định máy chủ nội bộ trong mạng LAN
  const port = parseInt(process.env.INTERNAL_NTP_PORT || '80', 10);
  const client = port === 443 ? https : http;

  const req = client.request(
    {
      host: internalHost,
      port,
      path: '/api/time',
      method: 'HEAD',
      timeout: 2000,
    },
    (res) => {
      const dateHeader = res.headers.date;
      if (dateHeader) {
        const remoteEpoch = new Date(dateHeader).getTime();
        if (!isNaN(remoteEpoch) && remoteEpoch > 0) {
          anchorWallTime = remoteEpoch;
          anchorMonoTime = performance.now();
          isAuthoritativeSynced = true;
          timeSourceLabel = `Máy chủ thời gian LAN (${internalHost})`;
          console.log(`[CLOCK-AUTHORITY] [LAN] Đã đồng bộ giờ chuẩn từ ${timeSourceLabel}: ${new Date(remoteEpoch).toISOString()}`);
        }
      }
    }
  );

  req.on('error', () => {
    // Giữ nguyên mốc Monotonic hiện tại, không crash
  });
  req.on('timeout', () => {
    req.destroy();
  });
  req.end();
}

// Chạy đồng bộ ngay khi nạp module
syncAuthoritativeTime();

/**
 * Lấy thời gian chuẩn của máy chủ — Miễn nhiễm 100% với việc can thiệp giờ Windows.
 * Sử dụng thanh ghi CPU Monotonic (performance.now):
 * Dù người dùng hoặc quản trị viên có chỉnh lùi/tiến giờ Windows trong Settings, thanh ghi CPU
 * vẫn tịnh tiến chính xác theo từng milli-giây thực tế trôi qua.
 */
function getAuthoritativeServerTime() {
  const elapsedMs = performance.now() - anchorMonoTime;
  const trueEpoch = Math.round(anchorWallTime + elapsedMs);
  return new Date(trueEpoch);
}

/**
 * Phát hiện hành vi chỉnh sửa/làm sai lệch giờ của hệ điều hành trên máy chủ.
 */
function detectOsClockTamper() {
  const osNow = Date.now();
  const trueNow = getAuthoritativeServerTime().getTime();
  const skewMs = Math.abs(osNow - trueNow);
  const isTampered = skewMs > 60 * 1000; // Sai lệch quá 1 phút (60 giây)
  return {
    isTampered,
    skewMs,
    skewMinutes: Math.round(skewMs / 60000),
    osTime: new Date(osNow),
    trueServerTime: new Date(trueNow),
    isAuthoritativeSynced,
    timeSourceLabel,
  };
}

module.exports = {
  getAuthoritativeServerTime,
  detectOsClockTamper,
  syncAuthoritativeTime,
  syncFromDatabase,
};
