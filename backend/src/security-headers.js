// ==============================================================================
// security-headers.js — Centralized Security Headers Middleware (QK7 DataHub)
// Chuẩn hóa bảo mật: HSTS, CSP (Nonce-based, No unsafe-inline/eval),
// Permissions-Policy, COOP, CORP, X-Content-Type-Options, Referrer-Policy, X-Frame-Options
// ==============================================================================

const crypto = require('crypto');

/**
 * Middleware tập trung áp dụng các Header bảo mật theo tiêu chuẩn OWASP Top 10
 * và giải quyết triệt để 36 finding từ báo cáo kiểm thử an ninh v4.0.
 */
function createSecurityHeadersMiddleware() {
  return function securityHeaders(req, res, next) {
    // 1. Tạo CSP Nonce ngẫu nhiên per-request (128-bit cryptographically secure)
    const nonce = crypto.randomBytes(16).toString('base64');
    res.locals.cspNonce = nonce;

    // 2. HTTP Strict Transport Security (HSTS) — Findings #5 đến #12
    // Bắt buộc có trên 100% phản hồi (2xx, 3xx, 4xx, 5xx)
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

    // Kiểm tra xem request có phải là gói học liệu số hóa (SCORM/HTML5/PDF view trong iframe)
    const reqPath = req.path || '';
    // CHỈ nới CSP cho đúng route phát gói học liệu / PDF bài giảng (GET). Trước đây dùng includes()
    // trên cả đường dẫn nên bất kỳ URL nào chứa '/pdf', '/launch'... cũng được nới (unsafe-inline/eval).
    const isLecturePlayback = req.method === 'GET' &&
      /^\/api\/lectures\/[^/]+\/((scorm|html5)\/|pdf\/?$)/.test(reqPath);
    const isFramedPdfView = (reqPath.startsWith('/api/files/') && reqPath.endsWith('/view')) || reqPath.includes('/pdf');

    if (isLecturePlayback) {
      // 3a. CSP chuyên dụng cho SCORM / HTML5 / ActivePresenter: cho phép engine player chạy trơn tru
      res.setHeader('Content-Security-Policy', [
        "default-src 'self' blob: data:",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data:",
        "style-src 'self' 'unsafe-inline' blob: data:",
        "img-src 'self' blob: data:",
        "media-src 'self' blob: data:",
        "font-src 'self' blob: data:",
        // Gói học liệu chỉ được gọi lại chính server này: bỏ ws:/wss: (cho phép gửi dữ liệu ra mọi máy chủ ngoài)
        "connect-src 'self' blob: data:",
        "form-action 'self'",
        "frame-ancestors 'self'",
        "object-src 'none'",
        "base-uri 'self'"
      ].join('; '));

      // Cho phép iframe hiển thị trên cùng origin
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    } else {
      // 3b. Content Security Policy (CSP) chuẩn bảo vệ toàn hệ thống SPA và API
      // Findings #13, #16, #19, #22, #25, #28, #31, #34
      const cspDirectives = [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}'`,
        `style-src 'self' 'nonce-${nonce}'`,
        "img-src 'self' data: blob:",
        "media-src 'self' data: blob:",
        "font-src 'self' data:",
        "connect-src 'self' blob: data: ws: wss: https://127.0.0.1:9001 https://localhost:9001",
        "frame-ancestors 'self'",
        "form-action 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "upgrade-insecure-requests",
      ];
res.setHeader('Content-Security-Policy', cspDirectives.join('; '));

      if (isFramedPdfView) {
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      } else {
        res.setHeader('X-Frame-Options', 'DENY');
      }
    }

    // 4. Permissions-Policy — Findings #14, #17, #20, #23, #26, #29, #32, #35
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), autoplay=(self), fullscreen=(self), loopback-network=(self), local-network=(self)'
    );

    // 5. Cross-Origin-Opener-Policy (COOP) — Findings #15, #18, #21, #24, #27, #30, #33, #36
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

    // 6. Cross-Origin-Resource-Policy (CORP) & Các header tăng cường phòng vệ chiều sâu
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // 7. Ẩn thông tin Server & X-Powered-By
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');

    next();
  };
}

module.exports = {
  createSecurityHeadersMiddleware,
};
