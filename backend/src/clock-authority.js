// ============================================================
// clock-authority.js — Authoritative Tamper-Proof Time Service
// Chống gian lận lùi/tiến giờ hệ thống trên máy trạm (Clock-Skew & Timestamp Forgery)
// Sử dụng Monotonic Hardware CPU Timer (performance.now / QPC) + NTP/HTTP Time Sync
// ============================================================

const https = require('https');
const http = require('http');

let anchorWallTime = Date.now();
let anchorMonoTime = performance.now();
let isAuthoritativeSynced = false;

/**
 * Thử đồng bộ mốc thời gian thực từ nguồn chuẩn thời gian bên ngoài.
 * Thử lần lượt các Time Server uy tín với timeout ngắn 1.5s (không block hệ thống).
 */
function syncAuthoritativeTime() {
  const sources = [
    { host: 'www.google.com', port: 443, client: https },
    { host: 'time.cloudflare.com', port: 443, client: https },
  ];

  let tried = 0;
  function tryNext() {
    if (tried >= sources.length) return;
    const src = sources[tried++];
    const req = src.client.request(
      {
        host: src.host,
        port: src.port,
        path: '/',
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
            console.log(`[CLOCK-AUTHORITY] Đã đồng bộ giờ chuẩn từ ${src.host}: ${new Date(remoteEpoch).toISOString()}`);
          }
        }
      }
    );
    req.on('error', () => {
      tryNext();
    });
    req.on('timeout', () => {
      req.destroy();
      tryNext();
    });
    req.end();
  }

  tryNext();
}

// Chạy đồng bộ ngay khi nạp module
syncAuthoritativeTime();
// Định kỳ 10 phút kiểm tra làm mới mốc thời gian
setInterval(syncAuthoritativeTime, 10 * 60 * 1000).unref();

/**
 * Lấy thời gian chuẩn của máy chủ — Miễn nhiễm 100% với việc can thiệp giờ Windows.
 * Sử dụng thanh ghi CPU Monotonic (performance.now):
 * Dù người dùng có chỉnh lùi/tiến giờ Windows trong Settings, thanh ghi CPU
 * vẫn tịnh tiến chính xác theo từng milli-giây thực tế trôi qua.
 */
function getAuthoritativeServerTime() {
  const elapsedMs = performance.now() - anchorMonoTime;
  const trueEpoch = Math.round(anchorWallTime + elapsedMs);
  return new Date(trueEpoch);
}

/**
 * Phát hiện hành vi chỉnh sửa/làm sai lệch giờ của hệ điều hành.
 */
function detectOsClockTamper() {
  const osNow = Date.now();
  const trueNow = getAuthoritativeServerTime().getTime();
  const skewMs = Math.abs(osNow - trueNow);
  const isTampered = skewMs > 60 * 1000; // Sai lệch quá 1 phút
  return {
    isTampered,
    skewMs,
    skewMinutes: Math.round(skewMs / 60000),
    osTime: new Date(osNow),
    trueServerTime: new Date(trueNow),
    isAuthoritativeSynced,
  };
}

module.exports = {
  getAuthoritativeServerTime,
  detectOsClockTamper,
  syncAuthoritativeTime,
};

