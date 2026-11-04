// ============================================================
// backend/swagger.js — QK7 DataHub OpenAPI 3.0
// Version: 3.0.0 — 2026-11-03
// Đã đối chiếu 1-1 với: server.js, admin-routes.js, ai-routes.js,
//   approval-workflow.js, sessions.js, route-permissions.js,
//   permissions.js, fingerprint-ws.js, audit-log-cleaner.js
// ============================================================

const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'QK7 DataHub API',
    version: '3.0.0',
    description:
      'API Gateway nội bộ QK7 — Quản lý tài liệu PDF phân cấp bảo mật 5 mức.\n\n' +

      '**Xác thực:** JWT Bearer Token (trừ endpoint công khai: `/api/auth/login`, `/api/auth/login/admin-fp-verify`, `/api/health`, `/api/meta`, `/api/test-http-error/{code}`, `/api/security/screenshot-alert`).\n\n' +

      '**WebSocket Fingerprint Agent:** `ws://<host>/ws/fingerprint?bridge_token=<token>&device_id=<id>` — Agent ZK9500 kết nối tới BE. Heartbeat ping 30s, timeout 90s.\n\n' +

      '**⚠️ 2FA Admin (hiện đang TẮT):** Khối kiểm tra vân tay Admin 2 bước trong `POST /api/auth/login` đã bị comment out — endpoint `POST /api/auth/login/admin-fp-verify` tồn tại nhưng **không thể đạt được qua luồng login chuẩn**. Hiện tại mọi user (kể cả Admin) đều nhận JWT ngay sau bước 1.\n\n' +

      '**Fingerprint + PIN cho tài liệu mật:**\n' +
      '- Cấp 1-2: xem trực tiếp\n' +
      '- Cấp 3 (Mật): cần `X-Fingerprint-Token` (5 phút)\n' +
      '- Cấp 4-5 (Tối mật / Tuyệt mật): cần FP token **có claim `pin_verified: true`** — quy trình 2 bước (`/api/auth/fingerprint/verify` → `/api/auth/pin/verify`)\n\n' +

      '**Maker-Checker (4 mắt):** Mọi thao tác có permission nằm trong bảng `PROTECTED_PERMISSION` sẽ trả **202** `{code:"APPROVAL_REQUIRED", request_id, message, required_permission}`. Protected Admin (`USR-001` hoặc role `ROL-01`) duyệt qua `POST /api/admin/approval-requests/{id}/approve`, sau đó gọi lại endpoint gốc với header `X-Approval-Override: <request_id>`.\n\n' +

      '**Đề xuất chỉnh sửa văn bản:** Nếu user không phải admin và không phải owner sửa file qua `PUT /api/documents/{fileId}`, hệ thống tự sinh `DOCUMENT_REVISION_PROPOSAL` (`PROP-xxx`) chờ duyệt thay vì cập nhật ngay.\n\n' +

      '**Tài liệu test:** `USR-001/123456789` (Admin tối cao, Cấp 5) · `USR-002/123456789` (Chỉ huy, Cấp 5) · `USR-003/123456789` (Cơ yếu, Cấp 5) · `USR-004/123456789` (Trợ lý, Cấp 2) · `USR-005/123456789` (Văn thư, Cấp 3) · `USR-006/123456789` (IT, Cấp 1).',

    contact: { name: 'Phòng CNTT QK7' },
  },

  servers: [{ url: '/', description: 'Cùng origin Swagger UI' }],

  tags: [
    { name: 'Auth',      description: 'Xác thực — Login, Logout, PIN, Vân tay, Session self-service' },
    { name: 'System',    description: 'Health check & danh mục công khai' },
    { name: 'Documents', description: 'CRUD tài liệu PDF, Thùng rác, Đề xuất chỉnh sửa' },
    { name: 'Files',     description: 'Xem / tải PDF (Watermark + DRM + Clock-tamper)' },
    { name: 'Logs',      description: 'Nhật ký truy cập & kiểm toán (tự động archive đầu tháng)' },
    { name: 'Security',  description: 'Cảnh báo an ninh (chụp màn hình)' },
    { name: 'Approval',  description: 'Maker-Checker — Phê duyệt yêu cầu thao tác nguy hiểm' },
    { name: 'Admin',     description: 'Quản trị hệ thống (Users, Roles, Units, Cấu hình)' },
    { name: 'AI Assistant', description: 'Trợ Lý AI Tác Chiến & Văn Thư (Citation-Grounded)' },
  ],

  security: [{ BearerAuth: [] }],

  paths: {
    // ═══════════════════════════════════════════════════════════
    // SYSTEM
    // ═══════════════════════════════════════════════════════════
    '/api/health': {
      get: {
        tags: ['System'],
        summary: 'Health check — kết nối SQL Server',
        security: [],
        responses: {
          200: {
            description: 'OK',
            content: { 'application/json': { schema: { type: 'object', properties: {
              ok:         { type: 'boolean', example: true },
              db:         { type: 'string', example: 'QK7_ThuVienSo' },
              login_name: { type: 'string', example: 'sa' },
              now:        { type: 'string', format: 'date-time' },
            } } } },
          },
          500: { description: 'DB không kết nối được', content: { 'application/json': { schema: { type: 'object', properties: {
            ok: { type: 'boolean', example: false }, error: { type: 'string' },
          } } } } },
        },
      },
    },

    '/api/meta': {
      get: {
        tags: ['System'],
        summary: 'Danh mục công khai — loại VB, đơn vị, mức mật, cấp bậc, chức vụ',
        security: [],
        responses: {
          200: {
            description: 'OK',
            content: { 'application/json': { schema: { type: 'object', properties: {
              types:     { type: 'array', items: { $ref: '#/components/schemas/DocumentType' } },
              units:     { type: 'array', items: { $ref: '#/components/schemas/Unit' } },
              levels:    { type: 'array', items: { $ref: '#/components/schemas/SecurityLevel' } },
              ranks:     { type: 'array', items: { $ref: '#/components/schemas/Rank' } },
              positions: { type: 'array', items: { $ref: '#/components/schemas/Position' } },
            } } } },
          },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },

    '/api/test-http-error/{code}': {
      get: {
        tags: ['System'],
        summary: 'Giả lập mã lỗi HTTP (test error boundary)',
        security: [],
        parameters: [
          { in: 'path', name: 'code', required: true, schema: { type: 'integer' }, example: 403 },
          { in: 'query', name: 'msg', schema: { type: 'string' } },
        ],
        responses: {
          default: {
            description: 'Trả đúng mã status yêu cầu',
            content: { 'application/json': { schema: { type: 'object', properties: {
              ok:        { type: 'boolean', example: false },
              code:      { type: 'integer' },
              error:     { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' },
            } } } },
          },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════
    // AUTH
    // ═══════════════════════════════════════════════════════════
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Đăng nhập — trả JWT (2FA vân tay Admin hiện đang TẮT)',
        description:
          '⚠️ **Lưu ý:** Khối kiểm tra 2FA vân tay Admin trong code hiện đang bị **COMMENT OUT** → endpoint này luôn trả **200** với JWT, không còn trả `202` + `temp_ticket`.\n\n' +
          '**Cơ chế bảo mật đang hoạt động:**\n' +
          '- IP Whitelist cho `USR-001` (nếu `ADMIN_ALLOWED_IP` set trong .env)\n' +
          '- Lockout sau `LOCKOUT_MAX_ATTEMPTS` lần sai (mặc định 6 lần / 15 phút) — chỉ áp dụng cho non-Admin\n' +
          '- IP bị chặn sau 6 lần dò username hoặc 15 lần sai mật khẩu (30 phút)\n' +
          '- Login attempt + access log ghi đầy đủ\n' +
          '- Session JWT được tạo và có thể bị revoke',
        security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: {
            type: 'object', required: ['user_id', 'password'],
            properties: {
              user_id:  { type: 'string', example: 'USR-001', description: 'Chấp nhận cả user_id lẫn username' },
              password: { type: 'string', example: '123456789' },
            },
          } } },
        },
        responses: {
          200: {
            description: 'Thành công — trả JWT + thông tin user + danh sách permissions',
            content: { 'application/json': { schema: { type: 'object', properties: {
              success:    { type: 'boolean', example: true },
              token:      { type: 'string', description: 'JWT. Payload `{ user_id, clearance_level_id, roles, iat, exp }`' },
              expires_in: { type: 'string', example: '8h' },
              user:       { $ref: '#/components/schemas/UserFull' },
            } } } },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { description: 'Sai tài khoản hoặc mật khẩu' },
          403: { description: 'Tài khoản bị khóa / vô hiệu hóa / IP Admin không hợp lệ / chưa cấp mật khẩu' },
          429: { description: 'IP bị chặn tạm thời — trả `{ error, reason, mins_left }`' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },

    '/api/auth/login/admin-fp-verify': {
      post: {
        tags: ['Auth'],
        summary: '⚠️ DEPRECATED — 2FA vân tay Admin (luồng login đã tắt)',
        deprecated: true,
        description:
          'Endpoint vẫn hoạt động nếu client có `temp_ticket` hợp lệ, nhưng vì khối tạo `temp_ticket` trong `POST /api/auth/login` đã bị comment out → **không thể đạt được qua luồng login chuẩn**.\n\n' +
          'Giữ lại cho mục đích test / tái kích hoạt sau này. Code vẫn đầy đủ: verify `temp_ticket` → load template vân tay từ DB → giải mã AES-256-GCM → gửi job quét xuống Agent → cấp JWT chính thức nếu khớp.',
        security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: {
            type: 'object', required: ['temp_ticket', 'device_id'],
            properties: {
              temp_ticket: { type: 'string' },
              device_id:   { type: 'string', example: 'DEV-73f027ff-84ea-464a-9610-bc5c556a499c' },
            },
          } } },
        },
        responses: {
          200: { description: 'Cấp JWT chính thức', content: { 'application/json': { schema: { type: 'object', properties: {
            success:    { type: 'boolean' },
            token:      { type: 'string' },
            expires_in: { type: 'string' },
            user:       { $ref: '#/components/schemas/UserFull' },
          } } } } },
          400: { description: 'Thiếu `temp_ticket` hoặc `device_id`' },
          401: { description: '`temp_ticket` hết hạn / sai purpose' },
          403: { description: 'Vân tay không khớp / chưa enroll / template vừa bị xóa' },
          404: { description: 'Không tìm thấy user' },
          408: { description: 'Timeout chờ quét' },
          500: { description: '`TEMPLATE_DECRYPT_FAILED` — template bị hỏng hoặc sai khóa `FP_ENC_KEY`' },
          503: { description: 'Agent offline / mất kết nối' },
        },
      },
    },

    '/api/auth/pin/verify': {
      post: {
        tags: ['Auth'],
        summary: 'Xác thực PIN 6 số (bước 2 cho file Cấp 4-5)',
        description:
          'Gọi sau khi `/api/auth/fingerprint/verify` trả `require_pin: true`. ' +
          'PIN challenge có hạn **2 phút**. Rate-limited **5 lần/phút/user**. ' +
          'Nếu verify thành công → cấp `fingerprint_token` chứa claim `pin_verified: true` dùng để xem file Cấp 4-5.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: {
            type: 'object', required: ['pin_challenge_token', 'pin'],
            properties: {
              pin_challenge_token: { type: 'string' },
              pin:                 { type: 'string', pattern: '^\\d{6}$', example: '123456' },
            },
          } } },
        },
        responses: {
          200: {
            description: 'Cấp fingerprint_token có `pin_verified: true`',
            content: { 'application/json': { schema: { type: 'object', properties: {
              success:           { type: 'boolean', example: true },
              fingerprint_token: { type: 'string' },
              expires_in:        { type: 'string', example: '5m' },
            } } } },
          },
          400: { description: 'Thiếu dữ liệu (`PIN_MISSING_INPUT`) / PIN sai định dạng không phải 6 số (`PIN_INVALID_FORMAT`)' },
          401: { description: 'PIN sai (`PIN_INVALID`) / challenge hết hạn (`PIN_CHALLENGE_EXPIRED`)' },
          403: { description: 'Token không khớp user (`PIN_USER_MISMATCH`) / chưa được cấp PIN (`PIN_NOT_SET`, `needs_admin_pin: true`)' },
          429: { description: 'Quá 5 lần/phút (`PIN_RATE_LIMITED`)' },
        },
      },
    },

    '/api/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Đăng xuất — revoke session hiện tại',
        responses: {
          200: { description: 'Đã thu hồi session', content: { 'application/json': { schema: { type: 'object', properties: {
            success: { type: 'boolean' },
          } } } } },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },

    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Lấy thông tin user hiện tại + roles + permissions + has_fingerprint',
        responses: {
          200: {
            description: 'Thành công',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/UserFull' } } },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════
    // FINGERPRINT VERIFY
    // ═══════════════════════════════════════════════════════════
    '/api/auth/fingerprint/verify': {
      post: {
        tags: ['Auth'],
        summary: 'Xác thực vân tay ZK9500 — Cấp 3 trả token, Cấp 4-5 trả PIN challenge',
        description:
          '**Hành vi theo cấp bảo mật của file:**\n' +
          '- **Cấp 1-2:** `{ success: true, required: false, fingerprint_token: null }` (không cần vân tay)\n' +
          '- **Cấp 3:** `{ success: true, required: true, fingerprint_token, expires_in: "5m", score }`\n' +
          '- **Cấp 4-5:** `{ success: true, required: true, require_pin: true, pin_challenge_token, pin_expires_in: "2m", score, security_level_id }` — **KHÔNG có fingerprint_token**, phải gọi tiếp `/api/auth/pin/verify`\n\n' +
          'Template vân tay được giải mã AES-256-GCM với `FP_ENC_KEY`. Nếu key sai → 500 `TEMPLATE_DECRYPT_FAILED`.\n\n' +
          '**Yêu cầu permission:** `FP_VERIFY`.',
        parameters: [
          { in: 'header', name: 'X-Device-FP', required: true, schema: { type: 'string' },
            example: 'DEV-73f027ff-84ea-464a-9610-bc5c556a499c' },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: {
            type: 'object', required: ['file_id'],
            properties: { file_id: { type: 'string', example: 'DOC-1760000000000-A1B2' } },
          } } },
        },
        responses: {
          200: {
            description: 'Tuỳ cấp bảo mật — xem description',
            content: { 'application/json': { schema: { type: 'object', properties: {
              success:             { type: 'boolean' },
              required:            { type: 'boolean' },
              fingerprint_token:   { type: 'string', nullable: true },
              expires_in:          { type: 'string', example: '5m', nullable: true },
              require_pin:         { type: 'boolean', description: 'true nếu file Cấp 4-5' },
              pin_challenge_token: { type: 'string', nullable: true },
              pin_expires_in:      { type: 'string', example: '2m', nullable: true },
              score:               { type: 'integer', example: 100 },
              security_level_id:   { type: 'integer', nullable: true },
            } } } },
          },
          400: { description: 'Thiếu `file_id` / thiếu `X-Device-FP`' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: {
            description: 'Vân tay không khớp / chưa enroll / chưa có PIN',
            content: { 'application/json': { schema: { type: 'object', properties: {
              error:          { type: 'string' },
              needs_enroll:   { type: 'boolean' },
              needs_admin_pin:{ type: 'boolean' },
              code:           { type: 'string', example: 'PIN_NOT_SET' },
              score:          { type: 'integer' },
            } } } },
          },
          404: { $ref: '#/components/responses/NotFound' },
          408: { description: 'Timeout chờ quét' },
          409: { description: 'Bị hủy bởi thao tác mới (`cancelled: true`)' },
          500: { description: '`TEMPLATE_DECRYPT_FAILED` / lỗi thiết bị',
            content: { 'application/json': { schema: { type: 'object', properties: {
              error: { type: 'string' }, code: { type: 'string', example: 'TEMPLATE_DECRYPT_FAILED' },
              device_error: { type: 'boolean' },
            } } } } },
          503: { description: 'Agent offline / `DEVICE_OFFLINE`' },
        },
      },
    },

    '/api/fingerprint/agents-online': {
      get: {
        tags: ['Auth'],
        summary: 'Danh sách Agent vân tay đang online (dành cho iPad/tablet)',
        description: 'Khác với `/api/admin/fingerprint/agents` — endpoint này **chỉ cần đăng nhập**, không yêu cầu admin. iPad dùng để biết máy nào đang sẵn sàng quét thay vì đọc từ local Agent.',
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            items: { type: 'array', items: { type: 'object', properties: {
              device_id: { type: 'string', example: 'DEV-73f027ff-84ea-464a-9610-bc5c556a499c' },
            } } },
          } } } } },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════
    // PIN SELF-SERVICE
    // ═══════════════════════════════════════════════════════════
    '/api/pin/request': {
      post: {
        tags: ['Auth'],
        summary: 'User gửi yêu cầu cấp PIN (tạo APPROVAL_REQUEST chờ ROL-01 duyệt)',
        description:
          'Tạo `APPROVAL_REQUEST` với `required_permission = "PERM-USR-08"` và `http_path = "/api/admin/users/{userId}/pin/generate"`. ' +
          'Phân biệt "cấp lần đầu" vs "cấp lại do quên" dựa vào việc user đã có `pin_hash` hay chưa. ' +
          'Chống spam: chỉ cho phép 1 request PENDING tại một thời điểm.',
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            success:    { type: 'boolean' },
            request_id: { type: 'string', example: 'REQ-PIN-1730000000000' },
            message:    { type: 'string', example: 'Đã gửi yêu cầu' },
          } } } } },
          400: { description: 'Đã có request PENDING — `"Bạn đã gửi yêu cầu rồi"`' },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },

    '/api/user/check-new-pin': {
      get: {
        tags: ['Auth'],
        summary: 'Kiểm tra user có PIN mới chưa đọc (dùng cho notification đỏ)',
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            has_new_pin: { type: 'boolean' },
          } } } } },
        },
      },
    },

    '/api/user/my-pin': {
      get: {
        tags: ['Auth'],
        summary: 'Lấy PIN mới — CHỈ XEM ĐƯỢC 1 LẦN (xóa khỏi PIN_DELIVERY ngay sau khi trả về)',
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            success: { type: 'boolean' },
            pin:     { type: 'string', example: '583920' },
          } } } } },
          404: { description: 'Không có PIN chờ' },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════
    // DOCUMENTS — SEARCH & CRUD
    // ═══════════════════════════════════════════════════════════
    '/api/documents': {
      get: {
        tags: ['Documents'],
        summary: 'Tìm kiếm / liệt kê tài liệu (tự lọc theo clearance_level_id của JWT)',
        parameters: [
          { in: 'query', name: 'q',     schema: { type: 'string' }, description: 'Tìm trong document_code, title, summary, unit name, signer' },
          { in: 'query', name: 'code',  schema: { type: 'string' }, example: '123/QĐ-BGH' },
          { in: 'query', name: 'title', schema: { type: 'string' } },
          { in: 'query', name: 'type',  schema: { type: 'string' }, example: 'QD' },
          { in: 'query', name: 'unit',  schema: { type: 'string' }, description: 'Lọc theo issuing_unit_id' },
          { in: 'query', name: 'include_children', schema: { type: 'string', enum: ['true', 'false', '1', '0'] }, description: 'Nếu true → mở rộng filter xuống đơn vị con (dùng CTE subtree)' },
          { in: 'query', name: 'from',  schema: { type: 'string', format: 'date' } },
          { in: 'query', name: 'to',    schema: { type: 'string', format: 'date' } },
          { in: 'query', name: 'lv',    schema: { type: 'integer', minimum: 1, maximum: 5 }, description: 'Nếu > clearance_level_id của user → trả 0 kết quả' },
        ],
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            total: { type: 'integer' },
            items: { type: 'array', items: { $ref: '#/components/schemas/Document' } },
          } } } } },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },

    '/api/documents/my-unit': {
      get: {
        tags: ['Documents'],
        summary: 'Lấy tài liệu theo đơn vị (scope theo unit của user hoặc query unit_id)',
        description:
          'Nếu user bị giới hạn đơn vị (không phải ROL-01/ROL-04) → tự dùng đơn vị gốc của mình + toàn bộ subtree. ' +
          'Nếu user có quyền chọn (admin/cấp cao) → dùng `?unit_id=` hoặc mặc định đơn vị của user / đơn vị gốc. ' +
          '**Yêu cầu permission:** `DOC_VIEW`.',
        parameters: [
          { in: 'query', name: 'unit_id', schema: { type: 'string' }, description: 'Chỉ có hiệu lực khi user không bị restricted' },
          { in: 'query', name: 'q',    schema: { type: 'string' } },
          { in: 'query', name: 'type', schema: { type: 'string' } },
          { in: 'query', name: 'from', schema: { type: 'string', format: 'date' } },
          { in: 'query', name: 'to',   schema: { type: 'string', format: 'date' } },
          { in: 'query', name: 'lv',   schema: { type: 'integer' } },
        ],
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            total:            { type: 'integer' },
            items:            { type: 'array', items: { $ref: '#/components/schemas/Document' } },
            unit:             { type: 'object', properties: {
              unit_id:   { type: 'string' },
              name:      { type: 'string' },
              parent_id: { type: 'string', nullable: true },
            } },
            subtree_unit_ids: { type: 'array', items: { type: 'string' } },
            can_select_unit:  { type: 'boolean' },
            selected_unit_id: { type: 'string' },
          } } } } },
          400: { description: 'Không xác định được đơn vị' },
          403: { description: 'Tài khoản chưa được gán đơn vị (`no_unit: true`)' },
          404: { description: 'Đơn vị không tồn tại (`not_found: true`)' },
        },
      },
    },

    '/api/documents/trash': {
      get: {
        tags: ['Documents'],
        summary: 'Danh sách tài liệu trong thùng rác (chỉ thấy file ≤ clearance của mình)',
        description: '**Yêu cầu permission:** `DOC_TRASH_VIEW`.',
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            total: { type: 'integer' },
            items: { type: 'array', items: { type: 'object', properties: {
              file_id:           { type: 'string' },
              document_code:     { type: 'string', nullable: true },
              title:             { type: 'string' },
              security_level_id: { type: 'integer' },
              security_name:     { type: 'string', nullable: true },
              original_name:     { type: 'string', nullable: true },
              file_size:         { type: 'integer', nullable: true },
              deleted_at:        { type: 'string', format: 'date-time' },
              deleted_reason:    { type: 'string', nullable: true },
              deleted_by_name:   { type: 'string', nullable: true },
              issuing_unit_id:   { type: 'string', nullable: true },
              unit_name:         { type: 'string', nullable: true },
            } } },
          } } } } },
        },
      },
    },

    '/api/documents/{fileId}': {
      get: {
        tags: ['Documents'],
        summary: 'Chi tiết 1 tài liệu (kể cả đã xóa nếu có DOC_TRASH_VIEW)',
        parameters: [{ $ref: '#/components/parameters/FileId' }],
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/Document' } } } },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      put: {
        tags: ['Documents'],
        summary: 'Sửa metadata — tự sinh đề xuất nếu không phải admin & không phải owner',
        description:
          '**Hành vi đặc biệt:** Nếu user **không phải admin** (ROL-01) và **không phải owner** (`uploaded_by`) → thay vì cập nhật trực tiếp, tạo bản ghi `DOCUMENT_REVISION_PROPOSAL` chờ duyệt (`PROP-xxx`) và trả `{ pending_approval: true, proposal_id }`. ' +
          'Nếu có file mới đính kèm → file được lưu vào `uploads/proposals/YYYY/MM/prop_<fileId>_<sha8>.pdf` để chờ duyệt.\n\n' +
          '**Yêu cầu permission:** `DOC_EDIT`.',
        parameters: [{ $ref: '#/components/parameters/FileId' }],
        requestBody: {
          required: true,
          content: { 'multipart/form-data': { schema: { type: 'object',
            required: ['title', 'security_level_id'],
            properties: {
              file:              { type: 'string', format: 'binary' },
              document_code:     { type: 'string' },
              title:             { type: 'string' },
              doc_type_id:       { type: 'string' },
              issued_date:       { type: 'string', format: 'date' },
              issuing_unit_id:   { type: 'string' },
              signer:            { type: 'string' },
              summary:           { type: 'string' },
              security_level_id: { type: 'integer' },
              note:              { type: 'string', description: 'Lý do đề xuất (khi bị đưa vào duyệt)' },
              proposal_note:     { type: 'string', description: 'Alias cho note' },
            },
          } } },
        },
        responses: {
          200: {
            description: 'Cập nhật trực tiếp HOẶC đã tạo đề xuất chờ duyệt',
            content: { 'application/json': { schema: { oneOf: [
              { type: 'object', properties: {
                success:       { type: 'boolean' },
                file_id:       { type: 'string' },
                replaced_file: { type: 'boolean' },
                stored_path:   { type: 'string' },
              } },
              { type: 'object', properties: {
                success:          { type: 'boolean' },
                pending_approval: { type: 'boolean', example: true },
                proposal_id:      { type: 'string', example: 'PROP-1730000000000-A1B2' },
                message:          { type: 'string' },
              } },
            ] } } },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['Documents'],
        summary: 'Xóa mềm tài liệu (chuyển vào thùng rác)',
        description: '**Yêu cầu permission:** `DOC_DELETE`. Có thể kèm `?reason=` hoặc `{ reason }` trong body.',
        parameters: [
          { $ref: '#/components/parameters/FileId' },
          { in: 'query', name: 'reason', schema: { type: 'string' }, description: 'Lý do xóa (max 500 ký tự)' },
        ],
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            success:      { type: 'boolean' },
            file_id:      { type: 'string' },
            soft_deleted: { type: 'boolean' },
          } } } } },
          400: { description: 'Tài liệu đã được xóa trước đó' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    '/api/documents/parse': {
      post: {
        tags: ['Documents'],
        summary: 'Parse PDF → metadata tự động + kiểm tra trùng SHA256/code (không lưu file, không lưu DB)',
        description:
          'Bóc tách Số hiệu, Trích yếu, Ngày ban hành, Người ký, Đơn vị ban hành. ' +
          'Tự phát hiện PDF lỗi font (garbage text) → chuyển sang OCR. Header OCR đọc vùng số hiệu ẩn dạng ảnh, Tail OCR tìm người ký trang cuối. ' +
          '**Trả kèm `duplicate_check`** — so sánh SHA256 và document_code với DB để cảnh báo trùng.\n\n' +
          '**Yêu cầu permission:** `DOC_PARSE`.',
        requestBody: {
          required: true,
          content: { 'multipart/form-data': { schema: {
            type: 'object', required: ['file'],
            properties: {
              file:          { type: 'string', format: 'binary', description: 'PDF ≤ 50 MB' },
              document_code: { type: 'string', description: 'Nếu có, dùng để kiểm tra trùng code' },
            },
          } } },
        },
        responses: {
          200: {
            description: 'Parse thành công',
            content: { 'application/json': { schema: { type: 'object', properties: {
              success:       { type: 'boolean', example: true },
              source:        { type: 'string', enum: ['digital', 'scan'] },
              usedOcr:       { type: 'boolean' },
              missingFields: { type: 'array', items: { type: 'string' }, example: ['signer'] },
              parsed: { type: 'object', properties: {
                document_code:           { type: 'string', nullable: true, example: '532/KH-CT' },
                document_number:         { type: 'string', nullable: true },
                doc_type_code:           { type: 'string', nullable: true },
                doc_type_name:           { type: 'string', nullable: true },
                title:                   { type: 'string', nullable: true },
                issued_date:             { type: 'string', nullable: true },
                signer:                  { type: 'string', nullable: true },
                signer_position:         { type: 'string', nullable: true },
                issuer_unit_name:        { type: 'string', nullable: true },
                issuer_parent_unit_name: { type: 'string', nullable: true },
                issuer_unit_id:          { type: 'string', nullable: true },
                issuer_parent_unit_id:   { type: 'string', nullable: true },
                issuer_display:          { type: 'string', nullable: true },
                parent_matched:          { type: 'boolean' },
                unit_matched:            { type: 'boolean' },
              } },
              sources: { type: 'object', additionalProperties: { type: 'string' },
                description: 'Nguồn từng trường: text / ocr / header-ocr / ocr-tail' },
              diagnostics: { type: 'object', properties: {
                totalPages:      { type: 'integer' },
                garbagePages:    { type: 'integer' },
                garbageRatio:    { type: 'number' },
                detectedGarbage: { type: 'boolean' },
              } },
              original_name: { type: 'string' },
              file_size:     { type: 'integer' },
              sha256:        { type: 'string' },
              duplicate_check: {
                type: 'object',
                properties: {
                  sha256:         { type: 'string' },
                  is_duplicate:   { type: 'boolean' },
                  sha_duplicate:  { type: 'boolean' },
                  code_duplicate: { type: 'boolean' },
                  matches: { type: 'object', properties: {
                    by_sha256: { type: 'array', items: { type: 'object' } },
                    by_code:   { type: 'array', items: { type: 'object' } },
                  } },
                },
              },
            } } } },
          },
          400: { description: 'Thiếu file PDF' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },

    '/api/documents/upload': {
      post: {
        tags: ['Documents'],
        summary: 'Upload PDF mới (≤ 50 MB) — chống trùng SHA256, tự sync lên Vector Store',
        description:
          'Kiểm tra trùng SHA256 với tài liệu chưa xóa. Nếu trùng → trả **409** `is_duplicate: true` kèm thông tin file cũ. ' +
          'Client có thể gửi `force_upload=1` (multipart field) để bỏ qua check.\n\n' +
          'Đường dẫn lưu: `uploads/YYYY/MM/YYYYMMDD_<type>_<code>_<sha8>.pdf`.\n\n' +
          '**Yêu cầu permission:** `DOC_UPLOAD`.',
        requestBody: {
          required: true,
          content: { 'multipart/form-data': { schema: {
            type: 'object', required: ['file', 'title', 'security_level_id'],
            properties: {
              file:              { type: 'string', format: 'binary' },
              document_code:     { type: 'string', example: '125/QĐ-QK7' },
              title:             { type: 'string', example: 'Quyết định bổ nhiệm' },
              doc_type_id:       { type: 'string', example: 'QD' },
              issued_date:       { type: 'string', format: 'date', example: '2026-10-14' },
              issuing_unit_id:   { type: 'string', example: 'U-BGH' },
              signer:            { type: 'string' },
              summary:           { type: 'string' },
              security_level_id: { type: 'integer', minimum: 1, maximum: 5 },
              force_upload:      { type: 'string', enum: ['0', '1'], description: '1 = bỏ qua check trùng SHA256' },
            },
          } } },
        },
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            success:     { type: 'boolean' },
            file_id:     { type: 'string' },
            stored_path: { type: 'string' },
            sha256:      { type: 'string' },
          } } } } },
          400: { $ref: '#/components/responses/BadRequest' },
          409: {
            description: 'Trùng SHA256',
            content: { 'application/json': { schema: { type: 'object', properties: {
              error:        { type: 'string' },
              is_duplicate: { type: 'boolean', example: true },
              match_type:   { type: 'string', example: 'sha256' },
              existing:     { $ref: '#/components/schemas/Document' },
            } } } },
          },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },

    '/api/documents/{fileId}/restore': {
      post: {
        tags: ['Documents'],
        summary: 'Khôi phục tài liệu từ thùng rác + tự re-ingest vào Vector Store',
        description: '**Yêu cầu permission:** `DOC_RESTORE`.',
        parameters: [{ $ref: '#/components/parameters/FileId' }],
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            success:  { type: 'boolean' },
            file_id:  { type: 'string' },
            restored: { type: 'boolean' },
          } } } } },
          400: { description: 'Tài liệu không ở trong thùng rác' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    '/api/documents/{fileId}/purge': {
      delete: {
        tags: ['Documents'],
        summary: 'Xóa vĩnh viễn (yêu cầu confirm = fileId) — xóa file vật lý + record DB',
        description:
          '**Yêu cầu permission:** `DOC_PURGE`. Permission này thường nằm trong `PROTECTED_PERMISSION` → cần duyệt Maker-Checker. ' +
          'Nếu đã duyệt → gửi kèm header `X-Approval-Override: <request_id>`.\n\n' +
          'Bắt buộc gửi `confirm` khớp chính xác với `fileId` để tránh xóa nhầm.',
        parameters: [{ $ref: '#/components/parameters/FileId' }],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', properties: {
            confirm: { type: 'string', description: 'Phải khớp chính xác với `fileId` trong path' },
          } } } },
        },
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            success: { type: 'boolean' },
            file_id: { type: 'string' },
            purged:  { type: 'boolean' },
          } } } } },
          400: { description: 'Xác nhận không khớp / tài liệu chưa xóa mềm' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════
    // DOCUMENT PROPOSALS (Maker-Checker cho chỉnh sửa nội dung)
    // ═══════════════════════════════════════════════════════════
    '/api/documents/proposals/pending': {
      get: {
        tags: ['Documents'],
        summary: 'Danh sách đề xuất chỉnh sửa văn bản đang chờ duyệt',
        description:
          '**Phân quyền:**\n' +
          '- Admin (ROL-01) → thấy tất cả\n' +
          '- Chỉ huy (ROL-02) → thấy đề xuất thuộc đơn vị mình + subtree (mở rộng lên đơn vị cha nếu có)\n' +
          '- User thường → chỉ thấy đề xuất của chính mình\n\n' +
          '**Yêu cầu permission:** `DOC_VIEW`.',
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            total: { type: 'integer' },
            items: { type: 'array', items: { type: 'object', properties: {
              proposal_id:               { type: 'string' },
              file_id:                   { type: 'string' },
              requester_id:              { type: 'string' },
              requester_name:            { type: 'string', nullable: true },
              requester_rank:            { type: 'string', nullable: true },
              requester_position:        { type: 'string', nullable: true },
              status:                    { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED'] },
              note:                      { type: 'string', nullable: true },
              review_note:               { type: 'string', nullable: true },
              reviewed_by:               { type: 'string', nullable: true },
              reviewed_at:               { type: 'string', format: 'date-time', nullable: true },
              created_at:                { type: 'string', format: 'date-time' },
              updated_at:                { type: 'string', format: 'date-time' },
              document_code:             { type: 'string', nullable: true },
              title:                     { type: 'string' },
              current_document_code:     { type: 'string', nullable: true },
              current_title:             { type: 'string' },
              current_signer:            { type: 'string', nullable: true },
              current_security_level_id: { type: 'integer', nullable: true },
              current_doc_type_id:       { type: 'string', nullable: true },
              current_issued_date:       { type: 'string', format: 'date', nullable: true },
              current_issuing_unit_id:   { type: 'string', nullable: true },
              issuing_unit_name:         { type: 'string', nullable: true },
              current_unit_name:         { type: 'string', nullable: true },
              security_level_name:       { type: 'string', nullable: true },
              current_security_name:     { type: 'string', nullable: true },
            } } },
          } } } } },
        },
      },
    },

    '/api/documents/proposals/{proposalId}/approve': {
      post: {
        tags: ['Documents'],
        summary: 'Duyệt đề xuất — áp dụng thay đổi vào DOCUMENT thật',
        description:
          'Nếu đề xuất có `new_stored_path` (đề xuất thay file) → copy file từ `uploads/proposals/...` sang `uploads/YYYY/MM/...` chuẩn. ' +
          'Sau đó UPDATE bảng `DOCUMENT` với metadata mới, sync lại Vector Store.\n\n' +
          '**Yêu cầu permission:** `DOC_EDIT`.',
        parameters: [{ in: 'path', name: 'proposalId', required: true, schema: { type: 'string' }, example: 'PROP-1730000000000-A1B2' }],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', properties: {
            review_note: { type: 'string' },
          } } } },
        },
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            file_id: { type: 'string' },
          } } } } },
          500: { description: 'Đề xuất không tồn tại / sai trạng thái' },
        },
      },
    },

    '/api/documents/proposals/{proposalId}/reject': {
      post: {
        tags: ['Documents'],
        summary: 'Từ chối đề xuất (bắt buộc nhập lý do)',
        description: '**Yêu cầu permission:** `DOC_EDIT`.',
        parameters: [{ in: 'path', name: 'proposalId', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', properties: {
            review_note: { type: 'string' },
            reason:      { type: 'string', description: 'Alias cho review_note' },
          } } } },
        },
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
          } } } } },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════
    // FILE VIEW/DOWNLOAD
    // ═══════════════════════════════════════════════════════════
    '/api/files/{fileId}/view': {
      get: {
        tags: ['Files'],
        summary: 'Xem/tải PDF — Cấp 3 cần FP token, Cấp 4-5 cần thêm `pin_verified`',
        description:
          '**Smart Document Resolver:** Nếu không tìm thấy theo `fileId`, endpoint thử fallback theo `document_code` → `stored_path`/`original_name` → dạng `PDF-xxx` (fuzzy match 16 ký tự đầu).\n\n' +
          '**DRM theo cấp:**\n' +
          '- Cấp 1-2: xem/tải bình thường\n' +
          '- Cấp 3: cần `X-Fingerprint-Token` (5 phút); **không cho tải** (`download=1` → 403)\n' +
          '- Cấp 4-5: cần FP token có `pin_verified: true`; **không cho tải**\n\n' +
          '**Clock-tamper detection:** Server trả header `X-Server-Time` (giờ chuẩn từ CPU monotonic), `X-Clock-Timestamp`, và `X-Clock-Tamper: 1` nếu phát hiện giờ máy trạm lệch > 1 phút so với giờ chuẩn.\n\n' +
          '**Symlink guard + Path validation:** chỉ chấp nhận path dạng `uploads/...` và file `.pdf`.',
        parameters: [
          { $ref: '#/components/parameters/FileId' },
          { in: 'query', name: 'download', schema: { type: 'string', enum: ['0', '1'], default: '0' } },
          { in: 'header', name: 'X-Fingerprint-Token', required: false, schema: { type: 'string' },
            description: 'Bắt buộc nếu `security_level_id >= 3`. Phải chứa `pin_verified: true` nếu `security_level_id >= 4`.' },
        ],
        responses: {
          200: {
            description: 'Stream PDF',
            headers: {
              'X-Server-Time':     { schema: { type: 'string', format: 'date-time' }, description: 'Giờ chuẩn server (tamper-proof)' },
              'X-Clock-Timestamp': { schema: { type: 'string' }, description: 'Epoch ms giờ chuẩn' },
              'X-Clock-Tamper':    { schema: { type: 'string', enum: ['0', '1'] }, description: '"1" nếu phát hiện sai lệch giờ máy trạm > 1 phút' },
              'X-Trace-Id':        { schema: { type: 'string' }, description: 'Log ID trong ACCESS_LOG' },
            },
            content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } },
          },
          400: { description: 'Path không hợp lệ' },
          403: {
            description: 'Không đủ quyền / cấp ≥ 3 không được tải / thiếu FP token / thiếu PIN',
            content: { 'application/json': { schema: { type: 'object', properties: {
              error:               { type: 'string' },
              require_fingerprint: { type: 'boolean' },
              require_pin:         { type: 'boolean', description: 'true nếu Cấp 4-5 và token thiếu `pin_verified`' },
            } } } },
          },
          404: { description: 'Không tìm thấy tài liệu / file vật lý không tồn tại' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════
    // ACCESS LOGS
    // ═══════════════════════════════════════════════════════════
    '/api/access-logs': {
      get: {
        tags: ['Logs'],
        summary: 'Nhật ký truy cập — active / archive / all (tự archive đầu tháng)',
        description:
          '**Scope:**\n' +
          '- `active` (default): log tháng hiện tại trong `ACCESS_LOG`\n' +
          '- `archive`: log cũ trong `ACCESS_LOG_ARCHIVE`\n' +
          '- `all`: UNION cả hai\n\n' +
          'Scheduler chạy mỗi 30 phút tự động archive log tháng trước sang bảng ARCHIVE và xóa khỏi ACCESS_LOG.\n\n' +
          '**Yêu cầu permission:** `AUDIT_VIEW`.',
        parameters: [
          { in: 'query', name: 'user',   schema: { type: 'string' }, description: 'Lọc theo user_id' },
          { in: 'query', name: 'action', schema: { type: 'string',
            enum: ['LOGIN', 'LOGIN_FAIL', 'LOGIN_ADMIN_2FA', 'LOGIN_BLOCKED', 'LOGOUT', 'LOGIN_DENIED_IP',
                   'VIEW', 'DOWNLOAD', 'UPLOAD', 'UPDATE', 'DELETE', 'DENIED', 'ERROR',
                   'FINGERPRINT_OK', 'FINGERPRINT_FAIL', 'FINGERPRINT_OK_PIN_PENDING',
                   'PIN_OK', 'PIN_FAIL', 'PIN_REQUEST', 'PIN_GENERATED',
                   'SCREENSHOT_ATTEMPT', 'CLOCK_TAMPER_ALERT',
                   'APPROVAL_REQUESTED', 'APPROVAL_APPROVED', 'APPROVAL_REJECTED',
                   'PROPOSAL_CREATED', 'PROPOSAL_APPROVED', 'PROPOSAL_REJECTED',
                   'KILL_SESSION', 'KILL_ALL_SESSIONS',
                   'SESSION_IP_CHANGED', 'IP_BLOCKED', 'UNBLOCK_IP'] } },
          { in: 'query', name: 'scope', schema: { type: 'string', enum: ['active', 'archive', 'all'], default: 'active' } },
        ],
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            total: { type: 'integer' },
            items: { type: 'array', items: { $ref: '#/components/schemas/AccessLog' } },
            cycle: { type: 'object', properties: {
              scope:         { type: 'string' },
              current_month: { type: 'string', example: '2026-11' },
              reset_policy:  { type: 'string', example: 'MONTHLY_FIRST_DAY_00_00' },
            } },
          } } } } },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },

    '/api/access-logs/stats': {
      get: {
        tags: ['Logs'],
        summary: 'Thống kê trạng thái chu kỳ log & kho lưu trữ',
        description: '**Yêu cầu permission:** `AUDIT_VIEW`.',
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            current_month:            { type: 'string', example: '2026-11' },
            active_month_count:       { type: 'integer' },
            total_active_table_count: { type: 'integer' },
            archive_count:            { type: 'integer' },
            last_archived_at:         { type: 'string', format: 'date-time', nullable: true },
          } } } } },
        },
      },
    },

    '/api/access-logs/archive-run': {
      post: {
        tags: ['Logs'],
        summary: 'Kích hoạt archive thủ công (chuyển log tháng cũ sang ACCESS_LOG_ARCHIVE)',
        description: '**Yêu cầu permission:** `AUDIT_VIEW`.',
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            message:       { type: 'string' },
            archivedCount: { type: 'integer' },
            cutoffDate:    { type: 'string', format: 'date-time' },
          } } } } },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════
    // SECURITY ALERTS (Screenshot detection)
    // ═══════════════════════════════════════════════════════════
    '/api/security/screenshot-alert': {
      post: {
        tags: ['Security'],
        summary: 'Ghi nhận chụp màn hình (không bắt buộc JWT)',
        description:
          'Endpoint **không bắt buộc đăng nhập** — nếu có Bearer token thì decode để lấy `user_id`, không thì dùng GUEST. ' +
          'Tự động JOIN `DOCUMENT / SECURITY_LEVEL / UNIT` để làm giàu thông tin `document` trả về. ' +
          'Ghi `ACCESS_LOG` với action `SCREENSHOT_ATTEMPT`.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: {
            file_id:       { type: 'string' },
            document_code: { type: 'string', description: 'Override nếu không tìm thấy trong DB' },
            title:         { type: 'string' },
            security_name: { type: 'string' },
            unit_name:     { type: 'string' },
            trigger_type:  { type: 'string', enum: ['PRINT_SCREEN', 'WIN_SHIFT_S'] },
          } } } },
        },
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            ok:      { type: 'boolean' },
            log_id:  { type: 'string' },
            message: { type: 'string' },
            document: { type: 'object', properties: {
              document_code: { type: 'string' },
              title:         { type: 'string' },
              security_name: { type: 'string' },
              unit_name:     { type: 'string' },
            } },
          } } } } },
          500: { description: 'Failed to record screenshot alert' },
        },
      },
    },

    '/api/security/alerts/recent': {
      get: {
        tags: ['Security'],
        summary: '10 cảnh báo chụp màn hình gần nhất',
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            ok: { type: 'boolean' },
            alerts: { type: 'array', items: { type: 'object', properties: {
              log_id:        { type: 'string' },
              user_id:       { type: 'string', nullable: true },
              full_name:     { type: 'string', nullable: true },
              file_id:       { type: 'string', nullable: true },
              document_code: { type: 'string', nullable: true },
              doc_title:     { type: 'string', nullable: true },
              action:        { type: 'string', example: 'SCREENSHOT_ATTEMPT' },
              timestamp:     { type: 'string', format: 'date-time' },
              ip:            { type: 'string', nullable: true },
              note:          { type: 'string', nullable: true },
            } } },
          } } } } },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════
    // APPROVAL WORKFLOW (Maker-Checker)
    // ═══════════════════════════════════════════════════════════
    '/api/my-approval-requests': {
      get: {
        tags: ['Approval'],
        summary: 'User xem yêu cầu của chính mình (gộp APPROVAL_REQUEST + PROPOSAL)',
        description:
          'Trả về yêu cầu từ 2 nguồn:\n' +
          '- `APPROVAL_REQUEST` (Maker-Checker cho thao tác admin)\n' +
          '- `DOCUMENT_REVISION_PROPOSAL` (đề xuất chỉnh sửa văn bản)\n\n' +
          'Mỗi item được sort theo `created_at` DESC. Proposal được map sang format giống approval (thêm `request_reason`, `document_code`, `doc_title`).',
        parameters: [
          { in: 'query', name: 'status',
            schema: { type: 'string', enum: ['PENDING_REJECTED', 'PENDING', 'REJECTED', 'ALL'], default: 'PENDING_REJECTED' },
            description: '`PENDING_REJECTED` = gộp cả 2 trạng thái' },
        ],
        responses: {
          200: { description: 'Danh sách', content: { 'application/json': { schema: { type: 'object', properties: {
            total: { type: 'integer' },
            items: { type: 'array', items: { $ref: '#/components/schemas/ApprovalRequest' } },
          } } } } },
          400: { description: 'Status không hợp lệ' },
        },
      },
    },

    '/api/admin/approval-requests': {
      get: {
        tags: ['Approval'],
        summary: 'Admin xem hàng đợi duyệt (gộp APPROVAL_REQUEST + PROPOSAL)',
        description:
          'Item từ `APPROVAL_REQUEST` có `request_id = "APV-xxx"`. ' +
          'Item từ `DOCUMENT_REVISION_PROPOSAL` có `request_id = "PROP-xxx"` và có thêm `proposal_data` (đầy đủ thông tin cũ vs mới để FE render diff).\n\n' +
          '**Yêu cầu permission:** `AUDIT_VIEW`.',
        parameters: [
          { in: 'query', name: 'status',
            schema: { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED', 'EXECUTING', 'EXECUTED', 'FAILED', 'ALL'], default: 'PENDING' } },
        ],
        responses: {
          200: { description: 'Danh sách', content: { 'application/json': { schema: { type: 'object', properties: {
            total: { type: 'integer' },
            items: { type: 'array', items: { $ref: '#/components/schemas/ApprovalRequest' } },
          } } } } },
          403: { description: 'Cần quyền AUDIT_VIEW' },
        },
      },
    },

    '/api/admin/approval-requests/{id}': {
      get: {
        tags: ['Approval'],
        summary: 'Chi tiết 1 yêu cầu — hỗ trợ cả `APV-xxx` và `PROP-xxx`',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' },
          example: 'APV-1729999999999-A1B2 hoặc PROP-1729999999999-B3C4' }],
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApprovalRequest' } } } },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    '/api/admin/approval-requests/{id}/approve': {
      post: {
        tags: ['Approval'],
        summary: '⚠️ ProtectedAdmin duyệt yêu cầu',
        description:
          '**Chỉ ProtectedAdmin** (`user_id === "USR-001"` hoặc `roles.includes("ROL-01")`) mới được duyệt. ' +
          'Nếu `id` bắt đầu bằng `PROP-` → gọi `approveProposalCore` để áp dụng thay đổi vào DOCUMENT thật. ' +
          'Ngược lại → UPDATE `APPROVAL_REQUEST` từ `PENDING` sang `APPROVED`.\n\n' +
          'Sau khi duyệt xong, user gốc gọi lại endpoint ban đầu với header `X-Approval-Override: <request_id>`.',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', properties: {
            review_note: { type: 'string' },
          } } } },
        },
        responses: {
          200: { description: 'Đã duyệt' },
          400: { description: 'Yêu cầu không ở trạng thái PENDING' },
          403: { description: 'Không phải ProtectedAdmin (`code: PROTECTED_ADMIN_ONLY`)' },
        },
      },
    },

    '/api/admin/approval-requests/{id}/reject': {
      post: {
        tags: ['Approval'],
        summary: '⚠️ ProtectedAdmin từ chối (bắt buộc lý do)',
        description: 'Nếu `id` bắt đầu bằng `PROP-` → gọi `rejectProposalCore`.',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: {
            type: 'object', required: ['review_note'],
            properties: { review_note: { type: 'string', example: 'Văn bản còn hiệu lực, không được xóa' } },
          } } },
        },
        responses: {
          200: { description: 'Đã từ chối' },
          400: { description: 'Thiếu lý do / không PENDING' },
          403: { description: 'Không phải ProtectedAdmin' },
        },
      },
    },

    '/api/admin/approval-requests/{id}/mark-executed': {
      post: {
        tags: ['Approval'],
        summary: '⚠️ ProtectedAdmin đánh dấu đã thực thi',
        description: 'Chỉ chuyển `EXECUTING` hoặc `APPROVED` → `EXECUTED`. Bỏ qua nếu `id` bắt đầu bằng `PROP-`.',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'OK' },
          403: { description: 'Không phải ProtectedAdmin' },
        },
      },
    },

    '/api/admin/protected-permissions': {
      get: {
        tags: ['Approval'],
        summary: 'Danh sách permission đang được bảo vệ (phải duyệt)',
        description: '**Yêu cầu permission:** `ROLE_VIEW`.',
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            items: { type: 'array', items: { type: 'object', properties: {
              permission_id: { type: 'string' },
              protected_by:  { type: 'string' },
              protected_at:  { type: 'string', format: 'date-time' },
              note:          { type: 'string', nullable: true },
            } } },
          } } } } },
        },
      },
    },

    '/api/admin/protected-permissions/{permissionId}': {
      post: {
        tags: ['Approval'],
        summary: '⚠️ ProtectedAdmin bật bảo vệ cho permission',
        parameters: [{ in: 'path', name: 'permissionId', required: true, schema: { type: 'string' }, example: 'PER-09' }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { note: { type: 'string' } } } } } },
        responses: {
          200: { description: 'Đã bật bảo vệ' },
          403: { description: 'Không phải ProtectedAdmin' },
        },
      },
      delete: {
        tags: ['Approval'],
        summary: '⚠️ ProtectedAdmin tắt bảo vệ',
        parameters: [{ in: 'path', name: 'permissionId', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Đã tắt bảo vệ' },
          403: { description: 'Không phải ProtectedAdmin' },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════
    // ADMIN — STATS
    // ═══════════════════════════════════════════════════════════
    '/api/admin/stats': {
      get: {
        tags: ['Admin'],
        summary: 'Thống kê KPI tổng quan',
        description: '**Yêu cầu permission:** `SYSTEM_STATS_VIEW`.',
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            users:     { type: 'integer' },
            documents: { type: 'integer' },
            totalSize: { type: 'integer' },
            byLevel:   { type: 'array', items: { type: 'object', properties: { lv: { type: 'integer' }, lvName: { type: 'string' }, n: { type: 'integer' } } } },
            byType:    { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, n: { type: 'integer' } } } },
            byUnit:    { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, n: { type: 'integer' } } } },
            logs24h:   { type: 'integer' },
          } } } } },
          403: { description: 'Cần quyền SYSTEM_STATS_VIEW' },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════
    // ADMIN — USERS
    // ═══════════════════════════════════════════════════════════
    '/api/admin/users': {
      get: {
        tags: ['Admin'],
        summary: 'Danh sách user (kèm roles, has_fingerprint, has_pin, pin_requested)',
        description:
          '**Yêu cầu permission:** `USER_VIEW`.\n\n' +
          '`pin_requested` = `true` nếu user có `APPROVAL_REQUEST` PENDING với `required_permission = "PERM-USR-08"`.',
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            total: { type: 'integer' },
            items: { type: 'array', items: { $ref: '#/components/schemas/UserFull' } },
          } } } } },
        },
      },
      post: {
        tags: ['Admin'],
        summary: 'Tạo user mới (có phân quyền tạo theo role caller)',
        description:
          '**Yêu cầu permission:** `USER_CREATE`.\n\n' +
          '**Phân quyền tạo:**\n' +
          '- Admin (ROL-01): tạo với mọi role, mọi cấp bảo mật\n' +
          '- Non-Admin: chỉ được gán role trong `NON_ADMIN_CREATABLE_ROLES` (mặc định `ROL-02` Chỉ huy + `ROL-03` Trợ lý); KHÔNG được tạo user cấp bảo mật cao hơn mình; BẮT BUỘC chọn ít nhất 1 role\n\n' +
          '**Auto-gen:** Nếu không truyền `user_id` → tự sinh `USR-NNN` (số nhỏ nhất còn trống). Nếu không truyền `username` → tự sinh `usr-NNN`.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: {
            type: 'object',
            required: ['username', 'password', 'full_name', 'clearance_level_id'],
            properties: {
              user_id:            { type: 'string', example: 'USR-005' },
              username:           { type: 'string', example: 'usr-005' },
              password:           { type: 'string', minLength: 8, example: 'Abc@12345' },
              full_name:          { type: 'string', example: 'Nguyễn Văn E' },
              rank_name:          { type: 'string', example: 'Đại tá' },
              position:           { type: 'string', example: 'Trưởng phòng' },
              unit_id:            { type: 'string', example: 'U-BGH' },
              status:             { type: 'string', enum: ['active', 'locked', 'inactive'], default: 'active' },
              clearance_level_id: { type: 'integer', minimum: 1, maximum: 5 },
              role_id:            { type: 'string', description: 'Chấp nhận cả dạng đơn' },
              roles:              { type: 'array', items: { type: 'string' }, description: 'Hoặc dạng mảng' },
            },
          } } },
        },
        responses: {
          200: { description: 'Tạo thành công', content: { 'application/json': { schema: { type: 'object', properties: {
            success:  { type: 'boolean' },
            user_id:  { type: 'string' },
            username: { type: 'string' },
            note:     { type: 'string', example: 'Tài khoản đã tạo.' },
          } } } } },
          400: { description: 'Thiếu dữ liệu / password < 8 ký tự' },
          403: {
            description: 'Non-admin vi phạm quy tắc tạo (cấp cao hơn / role ngoài whitelist / thiếu role)',
            content: { 'application/json': { schema: { type: 'object', properties: {
              error:         { type: 'string' },
              code:          { type: 'string', enum: ['PERMISSION_DENIED', 'ROLE_NOT_ALLOWED', 'ROLE_REQUIRED'] },
              allowed_roles: { type: 'array', items: { type: 'string' } },
            } } } },
          },
          409: { description: 'Trùng `user_id` hoặc `username`' },
        },
      },
    },

    '/api/admin/users/{id}': {
      put: {
        tags: ['Admin'],
        summary: 'Cập nhật hồ sơ user (KHÔNG nhận roles ở đây)',
        description:
          '**Yêu cầu permission:** `USER_EDIT`.\n\n' +
          '**⚠️ Lưu ý:** Endpoint này **không** nhận `role_id`/`roles` — phải dùng `POST/DELETE /api/admin/users/:id/roles`. ' +
          'Đổi `clearance_level_id` yêu cầu permission `USER_ROLE_ASSIGN` (trừ khi caller là ROL-01). ' +
          'Có guard defense-in-depth chống leo thang đặc quyền qua PUT.',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: {
            full_name:          { type: 'string' },
            rank_name:          { type: 'string' },
            position:           { type: 'string' },
            unit_id:            { type: 'string' },
            status:             { type: 'string', enum: ['active', 'locked', 'inactive'] },
            clearance_level_id: { type: 'integer' },
          } } } },
        },
        responses: {
          200: { description: 'OK' },
          403: { description: 'Đổi cấp không có quyền (`PERMISSION_DENIED`) / leo thang cấp (`CLEARANCE_ESCALATION_DENIED`) / đổi status user Admin khác' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['Admin'],
        summary: 'Xóa user (cascade dọn dẹp FK)',
        description:
          '**Yêu cầu permission:** `USER_DELETE` (thường là protected → cần Maker-Checker duyệt).\n\n' +
          'Xóa theo thứ tự: `USER_FINGERPRINT` → `USER_ROLE` → `USER_PERMISSION` → `USER_SESSION` → set NULL `ACCESS_LOG.user_id` / `DOCUMENT.uploaded_by` → xóa `USER`. ' +
          'Non-admin không được xóa user có cấp cao hơn mình.',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            success: { type: 'boolean' },
          } } } } },
          403: { description: 'Cấp user target cao hơn cấp caller' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    '/api/admin/users/{id}/credentials': {
      put: {
        tags: ['Admin'],
        summary: '⚠️ Đổi username / password — CHỈ ROL-01',
        description:
          '**Yêu cầu permission:** `USER_CREDENTIALS` + **inline check ROL-01** (non-ROL-01 trả 403 `CREDENTIALS_ADMIN_ONLY`).\n\n' +
          'Password không bắt buộc — nếu để trống thì chỉ đổi username. Password mới phải ≥ 8 ký tự.',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: {
            type: 'object', required: ['username'],
            properties: {
              username: { type: 'string' },
              password: { type: 'string', minLength: 8, nullable: true },
            },
          } } },
        },
        responses: {
          200: { description: 'OK' },
          400: { description: 'Thiếu username / password < 8 ký tự' },
          403: { description: 'Không phải ROL-01 (`code: CREDENTIALS_ADMIN_ONLY`)' },
          404: { $ref: '#/components/responses/NotFound' },
          409: { description: 'Username đã tồn tại' },
        },
      },
    },

    '/api/admin/users/{id}/unlock': {
      post: {
        tags: ['Admin'],
        summary: 'Mở khóa tài khoản (reset failed_attempts, locked_at, status=active)',
        description: '**Yêu cầu permission:** `USER_EDIT`.',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            success: { type: 'boolean' },
            user_id: { type: 'string' },
          } } } } },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    '/api/admin/users/{id}/roles': {
      get: {
        tags: ['Admin'],
        summary: 'Danh sách role của user',
        description: '**Yêu cầu permission:** `USER_VIEW`.',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            items: { type: 'array', items: { $ref: '#/components/schemas/Role' } },
          } } } } },
        },
      },
      post: {
        tags: ['Admin'],
        summary: 'Gán role (hoặc thu hồi nếu `force_revoke=true`)',
        description:
          '**Yêu cầu permission:** `USER_ROLE_ASSIGN` (thường là protected).\n\n' +
          '**Guard bảo mật (non-ROL-01):**\n' +
          '- Không được gán `ROL-01` (trừ Admin)\n' +
          '- Không được tự gán role cho chính mình\n' +
          '- Không được gỡ `ROL-01` của người khác\n\n' +
          '**Thời hạn:** hỗ trợ `duration_days` hoặc `expires_at`. MERGE giữ `expires_at` **xa nhất** nếu đã tồn tại.',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: {
            role_id:       { type: 'string', example: 'ROL-04' },
            duration_days: { type: 'integer', description: 'Số ngày hiệu lực tính từ bây giờ (0 = vĩnh viễn)' },
            expires_at:    { type: 'string', format: 'date', description: 'Ngày hết hạn (23:59:59.999)' },
            force_revoke:  { type: 'boolean', description: 'true = gỡ role khỏi user' },
          } } } },
        },
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            success:    { type: 'boolean' },
            role_id:    { type: 'string' },
            expires_at: { type: 'string', format: 'date-time', nullable: true },
            revoked:    { type: 'boolean' },
          } } } } },
          400: { description: 'Ngày hết hạn không hợp lệ (`INVALID_EXPIRY`)' },
          403: { description: 'Không đủ quyền' },
        },
      },
    },

    '/api/admin/users/{id}/roles/{roleId}': {
      delete: {
        tags: ['Admin'],
        summary: 'Gỡ role khỏi user',
        description:
          '**Yêu cầu permission:** `USER_ROLE_ASSIGN`.\n\n' +
          '**Trigger bảo vệ trong SQL Server:** Nếu gỡ `ROL-01` của Admin cuối cùng → DB trigger chặn và trả 403 `TRIGGER_BLOCKED`.',
        parameters: [
          { in: 'path', name: 'id',     required: true, schema: { type: 'string' } },
          { in: 'path', name: 'roleId', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'OK' },
          403: { description: 'Gỡ `ROL-01` của người khác khi non-admin / trigger chặn Admin cuối cùng' },
        },
      },
    },

    '/api/admin/users/{id}/permissions': {
      get: {
        tags: ['Admin'],
        summary: 'Xem quyền hiệu lực (role + direct grant) của user',
        description:
          '**Yêu cầu permission:** `USER_VIEW`.\n\n' +
          'Response gồm 3 phần:\n' +
          '- `effective_codes`: mảng code (đã gộp, sort)\n' +
          '- `from_roles`: chi tiết quyền từ role\n' +
          '- `direct_grants`: chi tiết quyền gán trực tiếp qua `USER_PERMISSION`',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            user_id:         { type: 'string' },
            effective_codes: { type: 'array', items: { type: 'string' } },
            from_roles: { type: 'array', items: { type: 'object', properties: {
              permission_id:     { type: 'string' },
              code:              { type: 'string' },
              description:       { type: 'string', nullable: true },
              group_code:        { type: 'string', nullable: true },
              sort_order:        { type: 'integer', nullable: true },
              subgroup_key:      { type: 'string', nullable: true },
              subgroup_label:    { type: 'string', nullable: true },
              subgroup_order:    { type: 'integer', nullable: true },
              subgroup_tone:     { type: 'string', nullable: true },
              role_id:           { type: 'string' },
              role_name:         { type: 'string' },
              role_expires_at:   { type: 'string', format: 'date-time', nullable: true },
            } } },
            direct_grants: { type: 'array', items: { type: 'object', properties: {
              permission_id: { type: 'string' },
              code:          { type: 'string' },
              description:   { type: 'string', nullable: true },
              group_code:    { type: 'string', nullable: true },
              sort_order:    { type: 'integer', nullable: true },
              subgroup_key:  { type: 'string', nullable: true },
              subgroup_label:{ type: 'string', nullable: true },
              subgroup_order:{ type: 'integer', nullable: true },
              subgroup_tone: { type: 'string', nullable: true },
              granted_by:    { type: 'string', nullable: true },
              granted_at:    { type: 'string', format: 'date-time', nullable: true },
              expires_at:    { type: 'string', format: 'date-time', nullable: true },
              note:          { type: 'string', nullable: true },
            } } },
          } } } } },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      post: {
        tags: ['Admin'],
        summary: 'Gán quyền trực tiếp (USER_PERMISSION)',
        description:
          '**Yêu cầu permission:** `USER_PERMISSION_ASSIGN` (thường là protected).\n\n' +
          'MERGE theo cặp `(user_id, permission_id)`. Nếu đã có → giữ `expires_at` xa nhất.',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['permission_id'], properties: {
            permission_id: { type: 'string', example: 'PER-09' },
            expires_at:    { type: 'string', format: 'date' },
            note:          { type: 'string', maxLength: 255 },
          } } } },
        },
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            success:       { type: 'boolean' },
            user_id:       { type: 'string' },
            permission_id: { type: 'string' },
            expires_at:    { type: 'string', format: 'date-time', nullable: true },
          } } } } },
          400: { description: 'Thiếu permission_id / ngày hết hạn không hợp lệ' },
          404: { description: 'User hoặc permission không tồn tại' },
        },
      },
    },

    '/api/admin/users/{id}/permissions/{permId}': {
      delete: {
        tags: ['Admin'],
        summary: 'Gỡ quyền trực tiếp',
        description: '**Yêu cầu permission:** `USER_PERMISSION_ASSIGN`.',
        parameters: [
          { in: 'path', name: 'id',     required: true, schema: { type: 'string' } },
          { in: 'path', name: 'permId', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            success:       { type: 'boolean' },
            user_id:       { type: 'string' },
            permission_id: { type: 'string' },
          } } } } },
          404: { description: 'User chưa được grant quyền này' },
        },
      },
    },

    '/api/admin/users/{userId}/pin/generate': {
      post: {
        tags: ['Admin'],
        summary: '⚠️ Chỉ ROL-01 — Tạo PIN 6 số cho user',
        description:
          '**Yêu cầu:** ROL-01 (inline check `roles.includes("ROL-01")`). Route này **không có** rule trong `route-permissions.js` → non-ROL-01 sẽ bị `NO_RULE` từ middleware.\n\n' +
          '**Cơ chế:**\n' +
          '1. Random 6 số → hash bcrypt → lưu `USER.pin_hash`\n' +
          '2. Đánh dấu các `APPROVAL_REQUEST` PENDING có `required_permission = "PERM-USR-08"` của user này → `EXECUTED`\n' +
          '3. Lưu PIN plaintext vào `PIN_DELIVERY` (hạn 24h) để user xem 1 lần qua `/api/user/my-pin`\n\n' +
          '**⚠️ Response trả cả PIN plaintext** để Admin copy nếu cần.',
        parameters: [{ in: 'path', name: 'userId', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            success:   { type: 'boolean' },
            user_id:   { type: 'string' },
            full_name: { type: 'string' },
            pin:       { type: 'string', example: '583920', description: 'PIN plaintext — admin copy gửi user' },
          } } } } },
          403: { description: 'Không phải ROL-01' },
          404: { description: 'Không tìm thấy user' },
        },
      },
    },

    '/api/admin/creatable-roles': {
      get: {
        tags: ['Admin'],
        summary: 'Danh sách role mà caller được phép gán khi tạo user',
        description:
          '**Yêu cầu permission:** `USER_VIEW`.\n\n' +
          '- Admin (ROL-01): trả **tất cả** role, `is_admin: true`\n' +
          '- Non-admin: chỉ trả `NON_ADMIN_CREATABLE_ROLES` (Chỉ huy + Trợ lý), `is_admin: false`',
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            items:    { type: 'array', items: { $ref: '#/components/schemas/Role' } },
            is_admin: { type: 'boolean' },
            note:     { type: 'string', example: 'Chỉ được gán vai trò Trợ lý hoặc Chỉ huy' },
          } } } } },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════
    // ADMIN — ROLES
    // ═══════════════════════════════════════════════════════════
    '/api/admin/roles': {
      get: {
        tags: ['Admin'],
        summary: 'Danh sách role',
        description: '**Yêu cầu permission:** `ROLE_VIEW`.',
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            items: { type: 'array', items: { $ref: '#/components/schemas/Role' } },
          } } } } },
        },
      },
      post: {
        tags: ['Admin'],
        summary: 'Tạo role (auto-gen `ROL-NN` nếu không truyền role_id)',
        description: '**Yêu cầu permission:** `ROLE_CREATE`.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['name'], properties: {
            role_id: { type: 'string', example: 'ROL-07', description: 'Tùy chọn — nếu trống tự sinh' },
            name:    { type: 'string', example: 'Nhân viên' },
          } } } },
        },
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            success: { type: 'boolean' }, role_id: { type: 'string' },
          } } } } },
          400: { description: 'Thiếu tên vai trò' },
          409: { description: 'Trùng role_id' },
        },
      },
    },

    '/api/admin/roles/{id}': {
      put: {
        tags: ['Admin'],
        summary: 'Sửa tên role',
        description: '**Yêu cầu permission:** `ROLE_EDIT`.',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['name'], properties: { name: { type: 'string' } } } } },
        },
        responses: {
          200: { description: 'OK' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['Admin'],
        summary: 'Xóa role (kèm USER_ROLE + ROLE_PERMISSION)',
        description: '**Yêu cầu permission:** `ROLE_DELETE`. **KHÔNG cho xóa `ROL-01`** — trả 403.',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'OK' },
          403: { description: 'Không thể xóa `ROL-01`' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    '/api/admin/roles/{id}/permissions': {
      get: {
        tags: ['Admin'],
        summary: 'Quyền của role',
        description: '**Yêu cầu permission:** `ROLE_VIEW`.',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            items: { type: 'array', items: { $ref: '#/components/schemas/Permission' } },
          } } } } },
        },
      },
      post: {
        tags: ['Admin'],
        summary: 'Gán quyền cho role (tự invalidate cache tất cả user trong role)',
        description: '**Yêu cầu permission:** `ROLE_PERMISSION_ASSIGN` (thường protected).',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['permission_id'], properties: {
            permission_id: { type: 'string' },
          } } } },
        },
        responses: {
          200: { description: 'OK' },
          409: { description: 'Đã có quyền này' },
        },
      },
    },

    '/api/admin/roles/{id}/permissions/{permId}': {
      delete: {
        tags: ['Admin'],
        summary: 'Bỏ quyền khỏi role',
        description: '**Yêu cầu permission:** `ROLE_PERMISSION_ASSIGN`.',
        parameters: [
          { in: 'path', name: 'id',     required: true, schema: { type: 'string' } },
          { in: 'path', name: 'permId', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'OK' },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════
    // ADMIN — PERMISSIONS
    // ═══════════════════════════════════════════════════════════
    '/api/admin/permissions': {
      get: {
        tags: ['Admin'],
        summary: 'Danh sách quyền (kèm group_code + subgroup metadata)',
        description: '**Yêu cầu permission:** `PERMISSION_VIEW`.',
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            items: { type: 'array', items: { $ref: '#/components/schemas/Permission' } },
          } } } } },
        },
      },
      post: {
        tags: ['Admin'],
        summary: 'Tạo quyền mới',
        description: '**Yêu cầu permission:** `PERMISSION_CREATE`.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: {
            type: 'object', required: ['permission_id', 'code'],
            properties: {
              permission_id:  { type: 'string', example: 'PER-09' },
              code:           { type: 'string', example: 'doc.approve' },
              description:    { type: 'string' },
              group_code:     { type: 'string', example: 'DOCUMENT' },
              sort_order:     { type: 'integer', default: 0 },
              subgroup_key:   { type: 'string' },
              subgroup_label: { type: 'string' },
              subgroup_order: { type: 'integer', default: 50 },
              subgroup_tone:  { type: 'string', enum: ['read', 'write', 'security', 'danger'], default: 'read' },
            },
          } } },
        },
        responses: {
          200: { description: 'OK' },
          400: { description: 'Thiếu permission_id/code' },
          409: { description: 'Trùng id hoặc code' },
        },
      },
    },

    '/api/admin/permissions/reorder': {
      put: {
        tags: ['Admin'],
        summary: 'Sắp xếp lại thứ tự hiển thị (transaction)',
        description: '**Yêu cầu permission:** `PERMISSION_EDIT`.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['items'], properties: {
            items: {
              type: 'array',
              items: { type: 'object', properties: {
                permission_id: { type: 'string' },
                sort_order:    { type: 'integer' },
              } },
            },
          } } } },
        },
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            success: { type: 'boolean' },
            updated: { type: 'integer' },
          } } } } },
          400: { description: '`items` không phải mảng' },
        },
      },
    },

    '/api/admin/permissions/{id}': {
      put: {
        tags: ['Admin'],
        summary: 'Sửa permission (description, group, subgroup, sort_order)',
        description: '**Yêu cầu permission:** `PERMISSION_EDIT`.',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: {
            description:    { type: 'string' },
            group_code:     { type: 'string' },
            sort_order:     { type: 'integer' },
            subgroup_key:   { type: 'string' },
            subgroup_label: { type: 'string' },
            subgroup_order: { type: 'integer' },
            subgroup_tone:  { type: 'string', enum: ['read', 'write', 'security', 'danger'] },
          } } } },
        },
        responses: {
          200: { description: 'OK' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['Admin'],
        summary: 'Xóa permission (KHÔNG xóa được `is_system=1`)',
        description: '**Yêu cầu permission:** `PERMISSION_DELETE` (thường protected).',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'OK' },
          403: { description: 'Không thể xóa quyền hệ thống' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════
    // ADMIN — UNITS
    // ═══════════════════════════════════════════════════════════
    '/api/admin/units': {
      get: {
        tags: ['Admin'],
        summary: 'Danh sách đơn vị',
        description: '**Yêu cầu permission:** `UNIT_VIEW`.',
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            items: { type: 'array', items: { $ref: '#/components/schemas/Unit' } },
          } } } } },
        },
      },
      post: {
        tags: ['Admin'],
        summary: 'Tạo đơn vị',
        description: '**Yêu cầu permission:** `UNIT_CREATE` (nhóm 2 — CREATE được làm ngay).',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: {
            type: 'object', required: ['unit_id', 'name'],
            properties: {
              unit_id:   { type: 'string', example: 'U-BGH' },
              name:      { type: 'string', example: 'Ban Giám hiệu' },
              parent_id: { type: 'string', nullable: true },
            },
          } } },
        },
        responses: {
          200: { description: 'OK' },
          400: { description: 'Thiếu unit_id/name' },
          409: { description: 'Trùng unit_id hoặc name' },
        },
      },
    },

    '/api/admin/units/{id}': {
      put: {
        tags: ['Admin'],
        summary: 'Sửa đơn vị',
        description: '**Yêu cầu permission:** `UNIT_EDIT` (thường protected).',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: {
            name:      { type: 'string' },
            parent_id: { type: 'string', nullable: true },
          } } } },
        },
        responses: {
          200: { description: 'OK' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['Admin'],
        summary: 'Xóa đơn vị',
        description: '**Yêu cầu permission:** `UNIT_DELETE` (thường protected).',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'OK' },
          404: { $ref: '#/components/responses/NotFound' },
          409: { description: 'Đang có user/tài liệu tham chiếu' },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════
    // ADMIN — UNIT ALIASES
    // ═══════════════════════════════════════════════════════════
    '/api/admin/unit-aliases': {
      get: {
        tags: ['Admin'],
        summary: 'Danh sách alias đơn vị (dùng bởi pdf-parser)',
        description: '**Yêu cầu permission:** `UNIT_ALIAS_VIEW`. Filter theo `?unit_id=`.',
        parameters: [
          { in: 'query', name: 'unit_id', schema: { type: 'string' }, example: 'TQS' },
        ],
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            items: { type: 'array', items: { $ref: '#/components/schemas/UnitAlias' } },
          } } } } },
        },
      },
      post: {
        tags: ['Admin'],
        summary: 'Thêm alias (auto invalidate catalog cache của pdf-parser)',
        description: '**Yêu cầu permission:** `UNIT_ALIAS_CREATE`.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: {
            type: 'object', required: ['unit_id', 'alias_text'],
            properties: {
              unit_id:    { type: 'string', example: 'TQS' },
              alias_text: { type: 'string', example: 'TRƯỜNG QUÂN SỰ QK7' },
              priority:   { type: 'integer', minimum: 0, maximum: 1000, default: 0 },
            },
          } } },
        },
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            success:  { type: 'boolean' },
            alias_id: { type: 'integer' },
          } } } } },
          400: { description: 'Thiếu dữ liệu' },
          404: { description: 'Đơn vị không tồn tại' },
          409: { description: 'Trùng `(unit_id, alias_text)`' },
        },
      },
    },

    '/api/admin/unit-aliases/{id}': {
      put: {
        tags: ['Admin'],
        summary: 'Sửa alias — CHỈ `alias_text` và `priority` (không đổi unit_id)',
        description: '**Yêu cầu permission:** `UNIT_ALIAS_EDIT`.',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' }, example: 71 }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: {
            type: 'object', required: ['alias_text'],
            properties: {
              alias_text: { type: 'string' },
              priority:   { type: 'integer', default: 0 },
            },
          } } },
        },
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            success: { type: 'boolean' },
          } } } } },
          400: { description: 'Thiếu alias_text' },
          404: { description: 'Không tìm thấy alias' },
        },
      },
      delete: {
        tags: ['Admin'],
        summary: 'Xóa alias',
        description: '**Yêu cầu permission:** `UNIT_ALIAS_DELETE`.',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            success: { type: 'boolean' },
          } } } } },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════
    // ADMIN — DOCUMENT TYPES
    // ═══════════════════════════════════════════════════════════
    '/api/admin/document-types': {
      get: {
        tags: ['Admin'],
        summary: 'Danh sách loại văn bản',
        description: '**Yêu cầu permission:** `DOCTYPE_VIEW`.',
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            items: { type: 'array', items: { $ref: '#/components/schemas/DocumentType' } },
          } } } } },
        },
      },
      post: {
        tags: ['Admin'],
        summary: 'Tạo loại văn bản',
        description: '**Yêu cầu permission:** `DOCTYPE_CREATE`.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: {
            type: 'object', required: ['type_id', 'name'],
            properties: {
              type_id:     { type: 'string', example: 'QD' },
              name:        { type: 'string', example: 'Quyết định' },
              description: { type: 'string' },
            },
          } } },
        },
        responses: {
          200: { description: 'OK' },
          409: { description: 'Trùng type_id' },
        },
      },
    },

    '/api/admin/document-types/{id}': {
      put: {
        tags: ['Admin'],
        summary: 'Sửa loại văn bản',
        description: '**Yêu cầu permission:** `DOCTYPE_EDIT`.',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: {
            name:        { type: 'string' },
            description: { type: 'string' },
          } } } },
        },
        responses: {
          200: { description: 'OK' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['Admin'],
        summary: 'Xóa loại văn bản',
        description: '**Yêu cầu permission:** `DOCTYPE_DELETE`.',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'OK' },
          404: { $ref: '#/components/responses/NotFound' },
          409: { description: 'Đang có tài liệu dùng' },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════
    // ADMIN — SECURITY LEVELS
    // ═══════════════════════════════════════════════════════════
    '/api/admin/security-levels': {
      get: {
        tags: ['Admin'],
        summary: 'Danh sách mức bảo mật',
        description: '**Yêu cầu permission:** `SECLEVEL_VIEW`.',
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            items: { type: 'array', items: { $ref: '#/components/schemas/SecurityLevel' } },
          } } } } },
        },
      },
      post: {
        tags: ['Admin'],
        summary: 'Tạo mức bảo mật (thường PROTECTED — cần duyệt)',
        description: '**Yêu cầu permission:** `SECLEVEL_MANAGE`.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: {
            type: 'object', required: ['level_id', 'code', 'name'],
            properties: {
              level_id: { type: 'integer', example: 6 },
              code:     { type: 'string', example: 'TOIUU' },
              name:     { type: 'string', example: 'Tối ưu' },
            },
          } } },
        },
        responses: {
          200: { description: 'OK' },
          409: { description: 'Trùng level_id hoặc code' },
        },
      },
    },

    '/api/admin/security-levels/{id}': {
      put: {
        tags: ['Admin'],
        summary: 'Sửa mức bảo mật',
        description: '**Yêu cầu permission:** `SECLEVEL_MANAGE`.',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: {
            code: { type: 'string' },
            name: { type: 'string' },
          } } } },
        },
        responses: {
          200: { description: 'OK' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['Admin'],
        summary: 'Xóa mức bảo mật',
        description: '**Yêu cầu permission:** `SECLEVEL_MANAGE`.',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'OK' },
          404: { $ref: '#/components/responses/NotFound' },
          409: { description: 'Đang có user/tài liệu dùng' },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════
    // ADMIN — RANKS
    // ═══════════════════════════════════════════════════════════
    '/api/admin/ranks': {
      get: {
        tags: ['Admin'],
        summary: 'Danh sách cấp bậc quân hàm (kèm `active`, `created_at`)',
        description: '**Yêu cầu permission:** `RANK_VIEW`.',
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            items: { type: 'array', items: { $ref: '#/components/schemas/Rank' } },
          } } } } },
        },
      },
      post: {
        tags: ['Admin'],
        summary: 'Tạo cấp bậc (auto-gen `R-NN` nếu không truyền rank_id)',
        description: '**Yêu cầu permission:** `RANK_CREATE`.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: {
            type: 'object', required: ['name'],
            properties: {
              rank_id:    { type: 'string', example: 'R-21', description: 'Tùy chọn — nếu trống tự sinh' },
              name:       { type: 'string', example: 'Trung sĩ QNCN' },
              sort_order: { type: 'integer', example: 210 },
            },
          } } },
        },
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            success: { type: 'boolean' }, rank_id: { type: 'string' },
          } } } } },
          400: { description: 'Thiếu tên cấp bậc' },
          409: { description: 'Trùng rank_id hoặc tên (`UQ_MRANK_NAME`)' },
        },
      },
    },

    '/api/admin/ranks/{id}': {
      put: {
        tags: ['Admin'],
        summary: 'Sửa cấp bậc',
        description: '**Yêu cầu permission:** `RANK_EDIT`.',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: {
            name:       { type: 'string' },
            sort_order: { type: 'integer' },
            active:     { type: 'boolean' },
          } } } },
        },
        responses: {
          200: { description: 'OK' },
          404: { $ref: '#/components/responses/NotFound' },
          409: { description: 'Trùng tên (`UQ_MRANK_NAME`)' },
        },
      },
      delete: {
        tags: ['Admin'],
        summary: 'Xóa cấp bậc — soft delete nếu đang có user dùng',
        description: '**Yêu cầu permission:** `RANK_DELETE`. Nếu có user đang dùng tên này → set `active=0` (soft delete) thay vì xóa.',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            success:      { type: 'boolean' },
            soft_deleted: { type: 'boolean' },
            note:         { type: 'string', description: 'VD: "3 user đang dùng → chỉ ẩn khỏi dropdown"' },
          } } } } },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════
    // ADMIN — POSITIONS
    // ═══════════════════════════════════════════════════════════
    '/api/admin/positions': {
      get: {
        tags: ['Admin'],
        summary: 'Danh sách chức vụ (kèm `active`, `created_at`)',
        description: '**Yêu cầu permission:** `POSITION_VIEW`.',
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            items: { type: 'array', items: { $ref: '#/components/schemas/Position' } },
          } } } } },
        },
      },
      post: {
        tags: ['Admin'],
        summary: 'Tạo chức vụ (auto-gen `P-NN` nếu không truyền position_id)',
        description: '**Yêu cầu permission:** `POSITION_CREATE`.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: {
            type: 'object', required: ['name'],
            properties: {
              position_id: { type: 'string', example: 'P-19', description: 'Tùy chọn — nếu trống tự sinh' },
              name:        { type: 'string', example: 'Phó phòng Kỹ thuật' },
              sort_order:  { type: 'integer', example: 190 },
            },
          } } },
        },
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            success:     { type: 'boolean' },
            position_id: { type: 'string' },
          } } } } },
          400: { description: 'Thiếu tên chức vụ' },
          409: { description: 'Trùng position_id hoặc tên (`UQ_MPOS_NAME`)' },
        },
      },
    },

    '/api/admin/positions/{id}': {
      put: {
        tags: ['Admin'],
        summary: 'Sửa chức vụ',
        description: '**Yêu cầu permission:** `POSITION_EDIT`.',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: {
            name:       { type: 'string' },
            sort_order: { type: 'integer' },
            active:     { type: 'boolean' },
          } } } },
        },
        responses: {
          200: { description: 'OK' },
          404: { $ref: '#/components/responses/NotFound' },
          409: { description: 'Trùng tên (`UQ_MPOS_NAME`)' },
        },
      },
      delete: {
        tags: ['Admin'],
        summary: 'Xóa chức vụ — soft delete nếu đang có user dùng',
        description: '**Yêu cầu permission:** `POSITION_DELETE`.',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            success:      { type: 'boolean' },
            soft_deleted: { type: 'boolean' },
            note:         { type: 'string' },
          } } } } },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════
    // ADMIN — IP BLOCKLIST & LOGIN ATTEMPTS
    // ═══════════════════════════════════════════════════════════
    '/api/admin/ip-blocklist': {
      get: {
        tags: ['Admin'],
        summary: 'Danh sách IP đang bị chặn (còn hiệu lực)',
        description: '**Yêu cầu permission:** `AUDIT_VIEW`.',
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            items: { type: 'array', items: { type: 'object', properties: {
              ip:            { type: 'string' },
              blocked_until: { type: 'string', format: 'date-time' },
              reason:        { type: 'string', nullable: true },
              blocked_at:    { type: 'string', format: 'date-time' },
            } } },
          } } } } },
        },
      },
    },

    '/api/admin/ip-blocklist/{ip}': {
      delete: {
        tags: ['Admin'],
        summary: 'Gỡ chặn IP',
        description: '**Yêu cầu permission:** `AUDIT_VIEW`.',
        parameters: [{ in: 'path', name: 'ip', required: true, schema: { type: 'string' }, example: '192.168.1.100' }],
        responses: {
          200: { description: 'OK' },
          404: { description: 'IP không có trong blocklist' },
        },
      },
    },

    '/api/admin/login-attempts': {
      get: {
        tags: ['Admin'],
        summary: 'Lịch sử đăng nhập (200 bản ghi gần nhất)',
        description: '**Yêu cầu permission:** `AUDIT_VIEW`.',
        parameters: [
          { in: 'query', name: 'ip', schema: { type: 'string' } },
          { in: 'query', name: 'result', schema: { type: 'string', enum: ['SUCCESS', 'WRONG_PASSWORD', 'USERNAME_NOT_FOUND', 'LOCKED'] } },
        ],
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            items: { type: 'array', items: { type: 'object', properties: {
              attempt_id:   { type: 'integer' },
              ip:           { type: 'string' },
              username:     { type: 'string', nullable: true },
              result:       { type: 'string' },
              attempted_at: { type: 'string', format: 'date-time' },
            } } },
          } } } } },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════
    // ADMIN — SESSIONS
    // ═══════════════════════════════════════════════════════════
    '/api/admin/sessions': {
      get: {
        tags: ['Admin'],
        summary: 'Danh sách session đang hoạt động (JOIN USER để lấy rank/position)',
        description:
          '**Yêu cầu permission:** `SESSION_VIEW`.\n\n' +
          'Chỉ trả các session **chưa revoked**, chưa hết hạn, và có `last_seen_at` trong vòng `SESSION_IDLE_TIMEOUT_MINUTES` (mặc định 30 phút) — session idle quá lâu bị coi là offline.',
        parameters: [
          { in: 'query', name: 'user_id', schema: { type: 'string' }, description: 'Lọc theo user (tùy chọn)' },
        ],
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            items: { type: 'array', items: { type: 'object', properties: {
              session_id:         { type: 'string', format: 'uuid' },
              user_id:            { type: 'string' },
              full_name:          { type: 'string', nullable: true },
              rank:               { type: 'string', nullable: true },
              position:           { type: 'string', nullable: true },
              ip:                 { type: 'string', nullable: true },
              user_agent:         { type: 'string', nullable: true },
              created_at:         { type: 'string', format: 'date-time' },
              last_seen_at:       { type: 'string', format: 'date-time' },
              expires_at:         { type: 'string', format: 'date-time' },
              minutes_idle:       { type: 'integer' },
            } } },
            total:                 { type: 'integer' },
            idle_timeout_minutes:  { type: 'integer', example: 30 },
          } } } } },
          500: { description: 'Session module chưa wire (`SESSION_MODULE_NOT_WIRED`)' },
        },
      },
    },

    '/api/admin/sessions/{sessionId}': {
      delete: {
        tags: ['Admin'],
        summary: 'Kill 1 session',
        description: '**Yêu cầu permission:** `SESSION_KILL`.',
        parameters: [{ in: 'path', name: 'sessionId', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            success:      { type: 'boolean' },
            killed_count: { type: 'integer' },
            session_id:   { type: 'string' },
          } } } } },
        },
      },
    },

    '/api/admin/sessions/user/{userId}': {
      delete: {
        tags: ['Admin'],
        summary: 'Kill toàn bộ session của 1 user',
        description: '**Yêu cầu permission:** `SESSION_KILL`.',
        parameters: [{ in: 'path', name: 'userId', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            success:       { type: 'boolean' },
            revoked_count: { type: 'integer' },
            user_id:       { type: 'string' },
          } } } } },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════
    // ADMIN — PIN REQUESTS
    // ═══════════════════════════════════════════════════════════
    '/api/admin/pin-requests': {
      get: {
        tags: ['Admin'],
        summary: '⚠️ Chỉ ROL-01 — Danh sách log PIN_REQUEST 7 ngày gần nhất',
        description:
          '**Yêu cầu:** inline check `roles.includes("ROL-01")`.\n\n' +
          'Trả về các bản ghi `ACCESS_LOG` với action `PIN_REQUEST` trong 7 ngày gần nhất. ' +
          'Đây là **log đọc** (không phải bảng APPROVAL_REQUEST) — để xem yêu cầu cấp PIN thực sự PENDING, dùng `/api/admin/approval-requests`.',
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            total: { type: 'integer' },
            items: { type: 'array', items: { type: 'object', properties: {
              log_id:    { type: 'string' },
              user_id:   { type: 'string' },
              full_name: { type: 'string', nullable: true },
              rank_name: { type: 'string', nullable: true },
              file_id:   { type: 'string', nullable: true },
              timestamp: { type: 'string', format: 'date-time' },
              ip:        { type: 'string', nullable: true },
              note:      { type: 'string', nullable: true },
              has_pin:   { type: 'integer', enum: [0, 1], description: '1 nếu user đã có pin_hash' },
            } } },
          } } } } },
          403: { description: 'Không phải ROL-01' },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════
    // ADMIN — FINGERPRINT
    // ═══════════════════════════════════════════════════════════
    '/api/admin/fingerprint/enroll/{userId}': {
      post: {
        tags: ['Admin'],
        summary: 'Enroll vân tay cho user (yêu cầu admin)',
        description:
          '**Yêu cầu permission:** `FP_ENROLL`.\n\n' +
          '**Quy trình:**\n' +
          '1. Admin lấy `device_id` từ Agent local\n' +
          '2. Gọi endpoint này kèm header `X-Device-FP`\n' +
          '3. BE gửi `enroll_request` xuống Agent (timeout 60s)\n' +
          '4. Agent chờ user đặt tay 3 lần, merge template, gửi về BE\n' +
          '5. BE mã hóa AES-256-GCM → lưu `USER_FINGERPRINT.template_enc`\n\n' +
          '**Lưu ý:** Người đặt tay phải là user đích — nếu admin đặt tay mình thì sau này user đích sẽ không quét được.',
        parameters: [
          { in: 'path', name: 'userId', required: true, schema: { type: 'string' }, example: 'USR-005' },
          { in: 'header', name: 'X-Device-FP', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            success: { type: 'boolean' }, user_id: { type: 'string' },
          } } } } },
          400: { description: 'Không có `X-Device-FP` / enroll thất bại' },
          403: { description: 'Không có quyền FP_ENROLL' },
          404: { description: 'Không tìm thấy user' },
          408: { description: 'Timeout chờ quét 3 lần (60s)' },
          409: { description: 'Bị hủy bởi thao tác mới (`cancelled: true`)' },
          503: { description: 'Agent offline' },
        },
      },
    },

    '/api/admin/fingerprint/enroll-status': {
      get: {
        tags: ['Admin'],
        summary: 'Tiến trình enroll 3 bước real-time (từ in-memory state của WS)',
        description:
          '**Yêu cầu permission:** `FP_ENROLL`.\n\n' +
          'Nếu không truyền `deviceId` và không có header `X-Device-FP` → trả tiến trình của **bất kỳ Agent nào** đang active enroll trong 2 phút qua.\n\n' +
          'State values: `idle`, `waiting_touch_1`, `captured_1`, `captured_2`, `merging`, `completed`, `timeout`, `offline`, `error`.',
        parameters: [
          { in: 'query', name: 'deviceId', required: false, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Tiến trình', content: { 'application/json': { schema: { type: 'object', properties: {
            enrolling: { type: 'boolean' },
            step:      { type: 'integer', example: 1 },
            total:     { type: 'integer', example: 3 },
            state:     { type: 'string' },
          } } } } },
        },
      },
    },

    '/api/admin/fingerprint/agents': {
      get: {
        tags: ['Admin'],
        summary: 'Danh sách Agent đang online (JOIN connected_at + last_ping)',
        description: '**Yêu cầu permission:** `FP_AGENTS_VIEW`.',
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            items: { type: 'array', items: { type: 'object', properties: {
              device_id:    { type: 'string' },
              connected_at: { type: 'string', format: 'date-time' },
              last_ping:    { type: 'string', format: 'date-time' },
            } } },
          } } } } },
        },
      },
    },

    '/api/admin/fingerprint/status/{userId}': {
      get: {
        tags: ['Admin'],
        summary: 'Kiểm tra user đã enroll vân tay chưa',
        description: '**Yêu cầu permission:** `FP_ENROLL`.',
        parameters: [{ in: 'path', name: 'userId', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            user_id:         { type: 'string' },
            has_fingerprint: { type: 'boolean' },
            enrolled_at:     { type: 'string', format: 'date-time', nullable: true },
          } } } } },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════
    // AI ASSISTANT
    // ═══════════════════════════════════════════════════════════
    '/api/ai/health': {
      get: {
        tags: ['AI Assistant'],
        summary: 'Trạng thái AI microservice (:8001) + gateway mode',
        description:
          '**Yêu cầu đăng nhập** (không cần permission cụ thể).\n\n' +
          'Nếu microservice :8001 online → trả `gateway_mode: "active_microservice"`. ' +
          'Nếu offline → trả `gateway_mode: "smart_sql_fallback"` + message thông báo.',
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            status:               { type: 'string', example: 'online' },
            service:              { type: 'string', example: 'AI_BOXCHAT' },
            port:                 { type: 'integer', example: 8001 },
            total_chunks_indexed: { type: 'integer', example: 120 },
            gateway_mode:         { type: 'string', enum: ['active_microservice', 'smart_sql_fallback'] },
            message:              { type: 'string', nullable: true },
          } } } } },
        },
      },
    },

    '/api/ai/chat': {
      post: {
        tags: ['AI Assistant'],
        summary: 'Hỏi đáp có trích dẫn + clearance filter + biometric check',
        description:
          '**Yêu cầu permission:** `AI_QUERY`.\n\n' +
          '**Luồng xử lý:**\n' +
          '1. Kiểm tra microservice :8001 (timeout 2s). Nếu online → gọi LLM (timeout 75s).\n' +
          '2. Nếu offline / 5xx / timeout → chuyển sang **Smart SQL Fallback**: query trực tiếp SQL với `security_level_id <= user_clearance`.\n' +
          '3. **Clearance Guard:** phát hiện số hiệu văn bản trong câu hỏi (regex) → nếu tồn tại nhưng vượt cấp → từ chối trích dẫn.\n' +
          '4. **Biometric per-file:** văn bản Cấp 3+ chỉ hiện `snippet` khi có `X-Fingerprint-Token` khớp `file_id` tương ứng.\n\n' +
          '**Ghi audit:** mọi lần gọi đều tạo `ACCESS_LOG` action `AI_QUERY`.',
        parameters: [
          { in: 'header', name: 'X-Fingerprint-Token', required: false, schema: { type: 'string' },
            description: 'Có thể truyền header này để mở khóa Cấp 3+ trong citations' },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: {
            type: 'object', required: ['query'],
            properties: {
              query:             { type: 'string', example: 'Quy định bảo mật tài liệu tác chiến?' },
              file_id:           { type: 'string', nullable: true, description: 'Giới hạn ngữ cảnh vào 1 file' },
              history:           { type: 'array', description: 'Chỉ 6 message cuối được gửi', items: { type: 'object' } },
              fingerprint_token: { type: 'string', description: 'Có thể truyền trong body thay vì header' },
            },
          } } },
        },
        responses: {
          200: {
            description: 'Câu trả lời kèm trích dẫn',
            content: { 'application/json': { schema: { type: 'object', properties: {
              answer: { type: 'string' },
              citations: { type: 'array', items: { type: 'object', properties: {
                file_id:             { type: 'string' },
                document_code:       { type: 'string' },
                title:               { type: 'string' },
                page:                { type: 'integer' },
                security_level_name: { type: 'string' },
                snippet:             { type: 'string' },
                requires_biometric:  { type: 'boolean', description: 'true = cần FP ZK9500 để xem chi tiết' },
              } } },
              requires_biometric: { type: 'boolean' },
              retrieval_mode:     { type: 'string', enum: ['microservice', 'sql_fallback'] },
              synthesis_mode:     { type: 'string', enum: ['microservice', 'sql_fallback', 'clearance_blocked', 'not_found'] },
              reasoning: { type: 'object', properties: {
                mem:       { type: 'string' },
                think:     { type: 'string' },
                tool_call: { type: 'string' },
              } },
            } } } },
          },
          400: { description: 'Thiếu câu hỏi' },
          504: { description: 'AI_TIMEOUT — LLM xử lý quá 75s' },
        },
      },
    },

    '/api/ai/study-book/{fileId}': {
      get: {
        tags: ['AI Assistant'],
        summary: 'Tạo Cuốn Sách 3 Tab (Tài liệu, Sơ đồ Mermaid, Quiz)',
        description:
          '**Yêu cầu permission:** `AI_STUDY_BOOK`.\n\n' +
          '**Guard:** Nếu file có `security_level_id > clearance` → 403. Nếu `security_level_id >= 3` mà thiếu FP token → 403 với `require_fingerprint: true`.',
        parameters: [{ $ref: '#/components/parameters/FileId' }],
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            file_id:       { type: 'string' },
            document_code: { type: 'string' },
            title:         { type: 'string' },
            total_pages:   { type: 'integer' },
            tab_document:  { type: 'object' },
            tab_diagram:   { type: 'object' },
            tab_quiz:      { type: 'array', items: { type: 'object' } },
          } } } } },
          403: { description: 'Không đủ cấp / thiếu FP token',
            content: { 'application/json': { schema: { type: 'object', properties: {
              error:               { type: 'string' },
              require_fingerprint: { type: 'boolean' },
            } } } } },
          503: { description: 'Trợ lý AI không khả dụng', content: { 'application/json': { schema: { type: 'object', properties: {
            error:  { type: 'string' },
            detail: { type: 'string' },
          } } } } },
        },
      },
    },

    '/api/ai/sync-all': {
      post: {
        tags: ['AI Assistant'],
        summary: 'Đồng bộ toàn bộ tài liệu chưa xóa sang Vector Store',
        description: '**Yêu cầu permission:** `AI_SYNC`. Đọc toàn bộ `DOCUMENT WHERE deleted_at IS NULL` rồi POST sang microservice.',
        responses: {
          200: { description: 'Kết quả đồng bộ', content: { 'application/json': { schema: { type: 'object', properties: {
            success:         { type: 'boolean' },
            total_documents: { type: 'integer' },
          } } } } },
          503: { description: 'Không đồng bộ được' },
        },
      },
    },

    '/api/ai/media/search': {
      get: {
        tags: ['AI Assistant'],
        summary: 'Tìm kiếm media trong kho Vector (ảnh, sơ đồ, video)',
        description: '**Yêu cầu permission:** `AI_QUERY`. **Lưu ý:** nếu microservice lỗi → trả `[]` thay vì throw.',
        parameters: [
          { in: 'query', name: 'q', required: true, schema: { type: 'string' }, example: 'sa bàn tác chiến' },
        ],
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
            items: { type: 'array', items: { type: 'object' } },
          } } } } },
        },
      },
    },
  },

  // ============================================================
  // COMPONENTS
  // ============================================================
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http', scheme: 'bearer', bearerFormat: 'JWT',
        description:
          'JWT lấy từ `POST /api/auth/login`. Header: `Authorization: Bearer <token>`. ' +
          'Hết hạn sau 8 giờ (hoặc `JWT_EXPIRES_IN`). Có thể bị revoke qua `/api/auth/logout` hoặc admin kill session.',
      },
    },

    parameters: {
      FileId: {
        in: 'path', name: 'fileId', required: true, schema: { type: 'string' },
        description: 'Mã tài liệu (VD: `DOC-1760000000000-A1B2`). Endpoint `/api/files/{fileId}/view` còn hỗ trợ fallback theo document_code hoặc dạng `PDF-xxx`.',
        example: 'DOC-1760000000000-A1B2',
      },
      ApprovalOverride: {
        in: 'header', name: 'X-Approval-Override', required: false, schema: { type: 'string' },
        description: 'Truyền `request_id` của APPROVAL_REQUEST đã được duyệt (status = APPROVED). Cần cho mọi endpoint có permission protected. Nếu request_id chưa APPROVED → 403.',
        example: 'APV-1730000000000-A1B2',
      },
    },

    responses: {
      BadRequest:   { description: 'Dữ liệu không hợp lệ', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
      Unauthorized: { description: 'Chưa xác thực / token hết hạn', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
      NotFound:     { description: 'Không tìm thấy', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
      ServerError:  { description: 'Lỗi server', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
      ApprovalRequired: {
        description: 'Thao tác cần duyệt Maker-Checker',
        content: { 'application/json': { schema: { type: 'object', properties: {
          code:                { type: 'string', example: 'APPROVAL_REQUIRED' },
          request_id:          { type: 'string', example: 'APV-1730000000000-A1B2' },
          message:             { type: 'string' },
          required_permission: { type: 'string', example: 'USER_DELETE' },
        } } } },
      },
    },

    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Không tìm thấy tài liệu' },
          code:  { type: 'string', nullable: true },
        },
      },

      ApprovalRequest: {
        type: 'object',
        description: 'Có thể là `APPROVAL_REQUEST` (request_id = `APV-xxx`) hoặc `DOCUMENT_REVISION_PROPOSAL` (request_id = `PROP-xxx`, có thêm `proposal_data`)',
        properties: {
          request_id:          { type: 'string', example: 'APV-1729999999999-A1B2' },
          requester_id:        { type: 'string' },
          requester_name:      { type: 'string', nullable: true },
          requester_rank:      { type: 'string', nullable: true },
          required_permission: { type: 'string', example: 'USER_DELETE' },
          http_method:         { type: 'string', example: 'DELETE' },
          http_path:           { type: 'string', example: '/api/admin/users/USR-005' },
          http_body:           { type: 'string', nullable: true },
          target_summary:      { type: 'string', example: 'DELETE /api/admin/users/USR-005' },
          status:              { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED', 'EXECUTING', 'EXECUTED', 'FAILED'] },
          reviewed_by:         { type: 'string', nullable: true },
          reviewer_name:       { type: 'string', nullable: true },
          reviewed_at:         { type: 'string', format: 'date-time', nullable: true },
          review_note:         { type: 'string', nullable: true },
          executed_at:         { type: 'string', format: 'date-time', nullable: true },
          execution_error:     { type: 'string', nullable: true },
          created_at:          { type: 'string', format: 'date-time' },
          request_reason:      { type: 'string', nullable: true, description: 'Chỉ có ở PROPOSAL' },
          document_code:       { type: 'string', nullable: true, description: 'Chỉ có ở PROPOSAL' },
          doc_title:           { type: 'string', nullable: true, description: 'Chỉ có ở PROPOSAL' },
          proposal_data: {
            type: 'object', nullable: true,
            description: 'Chi tiết diff cũ vs mới (chỉ có ở PROPOSAL)',
            properties: {
              proposal_id:                { type: 'string' },
              file_id:                    { type: 'string' },
              document_code:              { type: 'string', nullable: true },
              title:                      { type: 'string' },
              doc_type_id:                { type: 'string', nullable: true },
              issued_date:                { type: 'string', nullable: true },
              issuing_unit_id:            { type: 'string', nullable: true },
              issuing_unit_name:          { type: 'string', nullable: true },
              signer:                     { type: 'string', nullable: true },
              summary:                    { type: 'string', nullable: true },
              security_level_id:          { type: 'integer', nullable: true },
              security_level_name:        { type: 'string', nullable: true },
              current_document_code:      { type: 'string', nullable: true },
              current_title:              { type: 'string', nullable: true },
              current_signer:             { type: 'string', nullable: true },
              current_security_level_id:  { type: 'integer', nullable: true },
              current_security_name:      { type: 'string', nullable: true },
              current_unit_name:          { type: 'string', nullable: true },
              current_issued_date:        { type: 'string', nullable: true },
              new_original_name:          { type: 'string', nullable: true },
              new_file_size:              { type: 'integer', nullable: true },
              note:                       { type: 'string', nullable: true },
            },
          },
        },
      },

      User: {
        type: 'object',
        properties: {
          user_id:            { type: 'string', example: 'USR-001' },
          username:           { type: 'string', example: 'usr-001' },
          full_name:          { type: 'string', example: 'Nguyễn Văn A' },
          rank_name:          { type: 'string', nullable: true },
          position:           { type: 'string', nullable: true },
          unit_id:            { type: 'string', nullable: true },
          unit_name:          { type: 'string', nullable: true },
          status:             { type: 'string', enum: ['active', 'locked', 'inactive'] },
          clearance_level_id: { type: 'integer', example: 5 },
          clearance_name:     { type: 'string', nullable: true },
          clearance_code:     { type: 'string', nullable: true },
          has_fingerprint:    { type: 'boolean', description: 'true nếu đã enroll vân tay' },
          has_pin:            { type: 'boolean', description: 'true nếu đã có pin_hash' },
          pin_requested:      { type: 'boolean', description: 'true nếu đang có APPROVAL_REQUEST PENDING với perm PERM-USR-08' },
        },
      },

      UserFull: {
        allOf: [
          { $ref: '#/components/schemas/User' },
          { type: 'object', properties: {
            roles:       { type: 'array', items: { type: 'string' }, example: ['ROL-01'] },
            role_names:  { type: 'array', items: { type: 'string' }, example: ['Admin'] },
            permissions: { type: 'array', items: { type: 'string' }, description: 'Danh sách code quyền hiệu lực' },
          } },
        ],
      },

      Document: {
        type: 'object',
        properties: {
          file_id:           { type: 'string' },
          document_code:     { type: 'string', nullable: true },
          title:             { type: 'string' },
          doc_type_id:       { type: 'string', nullable: true },
          doc_type_name:     { type: 'string', nullable: true },
          issued_date:       { type: 'string', format: 'date', nullable: true },
          issuing_unit_id:   { type: 'string', nullable: true },
          unit_name:         { type: 'string', nullable: true },
          signer:            { type: 'string', nullable: true },
          summary:           { type: 'string', nullable: true },
          file_size:         { type: 'integer', nullable: true },
          security_level_id: { type: 'integer' },
          security_name:     { type: 'string', nullable: true },
          original_name:     { type: 'string', nullable: true },
          stored_path:       { type: 'string', nullable: true },
          sha256:            { type: 'string', nullable: true },
          mime_type:         { type: 'string', nullable: true, example: 'application/pdf' },
          uploaded_by:       { type: 'string', nullable: true },
          created_at:        { type: 'string', format: 'date-time' },
          updated_at:        { type: 'string', format: 'date-time', nullable: true },
          deleted_at:        { type: 'string', format: 'date-time', nullable: true },
          deleted_by:        { type: 'string', nullable: true },
          deleted_reason:    { type: 'string', nullable: true },
        },
      },

      AccessLog: {
        type: 'object',
        properties: {
          log_id:        { type: 'string', example: 'REF-LX9K2A-A1B2' },
          user_id:       { type: 'string', nullable: true },
          full_name:     { type: 'string', nullable: true },
          file_id:       { type: 'string', nullable: true },
          doc_title:     { type: 'string', nullable: true },
          document_code: { type: 'string', nullable: true },
          security_name: { type: 'string', nullable: true },
          unit_name:     { type: 'string', nullable: true },
          action:        { type: 'string' },
          timestamp:     { type: 'string', format: 'date-time' },
          ip:            { type: 'string', nullable: true },
          note:          { type: 'string', nullable: true },
          is_archived:   { type: 'integer', enum: [0, 1], description: '1 nếu bản ghi nằm trong ACCESS_LOG_ARCHIVE' },
        },
      },

      DocumentType: {
        type: 'object',
        properties: {
          type_id:     { type: 'string' },
          name:        { type: 'string' },
          description: { type: 'string', nullable: true },
        },
      },

      Unit: {
        type: 'object',
        properties: {
          unit_id:     { type: 'string' },
          name:        { type: 'string' },
          parent_id:   { type: 'string', nullable: true },
          parent_name: { type: 'string', nullable: true },
        },
      },

      Role: {
        type: 'object',
        properties: {
          role_id: { type: 'string', example: 'ROL-01' },
          name:    { type: 'string', example: 'Admin' },
        },
      },

      Permission: {
        type: 'object',
        properties: {
          permission_id:  { type: 'string', example: 'PER-01' },
          code:           { type: 'string', example: 'SEARCH_DOCUMENT' },
          description:    { type: 'string', nullable: true },
          group_code:     { type: 'string', nullable: true, example: 'DOCUMENT' },
          is_system:      { type: 'boolean', description: 'true = không được xóa' },
          sort_order:     { type: 'integer', nullable: true },
          subgroup_key:   { type: 'string', nullable: true },
          subgroup_label: { type: 'string', nullable: true },
          subgroup_order: { type: 'integer', nullable: true },
          subgroup_tone:  { type: 'string', nullable: true, enum: ['read', 'write', 'security', 'danger'] },
        },
      },

      UnitAlias: {
        type: 'object',
        description: 'Bản ghi UNIT_ALIAS — bí danh đơn vị dùng bởi pdf-parser',
        properties: {
          alias_id:   { type: 'integer', example: 71 },
          unit_id:    { type: 'string', example: 'QK7' },
          unit_name:  { type: 'string', nullable: true, example: 'QUÂN KHU 7' },
          alias_text: { type: 'string', example: 'QUÂN KHU 7' },
          priority:   { type: 'integer', example: 100 },
          created_at: { type: 'string', format: 'date-time' },
        },
      },

      SecurityLevel: {
        type: 'object',
        properties: {
          level_id: { type: 'integer' },
          code:     { type: 'string' },
          name:     { type: 'string' },
        },
      },

      Rank: {
        type: 'object',
        properties: {
          rank_id:    { type: 'string', example: 'R-01' },
          name:       { type: 'string', example: 'Đại tá' },
          sort_order: { type: 'integer', example: 10 },
          active:     { type: 'boolean', example: true },
          created_at: { type: 'string', format: 'date-time', nullable: true },
        },
      },

      Position: {
        type: 'object',
        properties: {
          position_id: { type: 'string', example: 'P-01' },
          name:        { type: 'string', example: 'Hiệu trưởng' },
          sort_order:  { type: 'integer', example: 10 },
          active:      { type: 'boolean', example: true },
          created_at:  { type: 'string', format: 'date-time', nullable: true },
        },
      },
    },
  },
};

// ─── Debug log ───
const paths = Object.keys(swaggerSpec.paths);
let opCount = 0;
for (const p of Object.values(swaggerSpec.paths)) {
  for (const op of Object.values(p)) {
    if (op && op.tags) opCount++;
  }
}
console.log('════════════════════════════════════════');
console.log('[SWAGGER] QK7 DataHub API Spec v3.0.0');
console.log('[SWAGGER] Paths     :', paths.length);
console.log('[SWAGGER] Operations:', opCount);
console.log('[SWAGGER] Tags      : Auth, System, Documents, Files, Logs, Security, Approval, Admin, AI Assistant');
console.log('════════════════════════════════════════');

module.exports = swaggerSpec;