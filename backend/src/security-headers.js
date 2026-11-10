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

    // 3. Content Security Policy (CSP) — Findings #13, #16, #19, #22, #25, #28, #31, #34
    // TUYỆT ĐỐI KHÔNG chứa 'unsafe-inline' hoặc 'unsafe-eval'
    const cspDirectives = [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}'`,
      `style-src 'self' 'nonce-${nonce}'`,
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' blob: data: ws: wss:",
      "frame-ancestors 'self'",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ];
    res.setHeader('Content-Security-Policy', cspDirectives.join('; '));

    // 4. Permissions-Policy — Findings #14, #17, #20, #23, #26, #29, #32, #35
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
    );

    // 5. Cross-Origin-Opener-Policy (COOP) — Findings #15, #18, #21, #24, #27, #30, #33, #36
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

    // 6. Cross-Origin-Resource-Policy (CORP) & Các header tăng cường phòng vệ chiều sâu
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');

    // 7. Ẩn thông tin Server & X-Powered-By
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');

    next();
  };
}

module.exports = {
  createSecurityHeadersMiddleware,
};

