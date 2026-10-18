// ============================================================
// backend/swagger.js — QK7 DataHub OpenAPI 3.0 (FINAL)
// Bao gồm TOÀN BỘ 56 operations khớp server.js + admin-routes.js
// ============================================================

const bearerErr = (desc) => ({ description: desc });

const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'QK7 DataHub API',
    version: '1.0.0',
    description:
      'API Gateway nội bộ QK7 — Quản lý tài liệu PDF phân cấp bảo mật 5 mức.\n\n' +
      '**Xác thực:** gửi `X-User-Id` và `X-Clearance` (trừ các endpoint công khai).\n\n' +
      '**Tài khoản test:** `USR-001/123456789` (Admin, Cấp 5) · `USR-002/123456789` (Văn thư, Cấp 3) · `USR-003/123456789` (Thủ trưởng, Cấp 4)\n\n' +
      '**Quy tắc tải file:** Tài liệu Cấp ≥ 3 chỉ được **xem** (`download=0`), không được tải về.\n\n' +
      '**Quyền admin:** mọi endpoint `/api/admin/*` yêu cầu `X-Clearance >= 4`.',
    contact: { name: 'Phòng CNTT QK7' },
  },
  servers: [{ url: '/', description: 'Cùng origin Swagger UI' }],

  tags: [
    { name: 'Auth',      description: 'Xác thực & thông tin user' },
    { name: 'System',    description: 'Health check & danh mục' },
    { name: 'Documents', description: 'CRUD tài liệu PDF' },
    { name: 'Files',     description: 'Xem / tải PDF' },
    { name: 'Logs',      description: 'Nhật ký truy cập' },
    { name: 'Admin',     description: 'Quản trị hệ thống' },
    { name: 'AI Assistant', description: 'Trợ Lý AI Tác Chiến & Văn Thư (Citation-Grounded Agentic RAG)' },
  ],

  security: [{ UserHeader: [], ClearanceHeader: [] }],

  paths: {
    // ==========================================================
    // AUTH
    // ==========================================================
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Đăng nhập',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['user_id', 'password'],
                properties: {
                  user_id:  { type: 'string', example: 'USR-001' },
                  password: { type: 'string', example: '123456789' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Thành công',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    user: { $ref: '#/components/schemas/UserFull' },
                  },
                },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { description: 'Tài khoản bị khóa / chưa cấp mật khẩu' },
          429: { description: 'IP tạm thời bị chặn' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },

    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Lấy thông tin user hiện tại (theo X-User-Id)',
        responses: {
          200: {
            description: 'Thành công',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/UserFull' } } },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },

    // ==========================================================
    // SYSTEM
    // ==========================================================
    '/api/health': {
      get: {
        tags: ['System'],
        summary: 'Health check — kết nối SQL Server',
        security: [],
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok:         { type: 'boolean', example: true },
                    db:         { type: 'string', example: 'QK7_ThuVienSo' },
                    login_name: { type: 'string', example: 'sa' },
                    now:        { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },

    '/api/meta': {
      get: {
        tags: ['System'],
        summary: 'Danh mục: loại VB, đơn vị, mức mật, cấp bậc, chức vụ',
        security: [],
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    types:     { type: 'array', items: { $ref: '#/components/schemas/DocumentType' } },
                    units:     { type: 'array', items: { $ref: '#/components/schemas/Unit' } },
                    levels:    { type: 'array', items: { $ref: '#/components/schemas/SecurityLevel' } },
                    ranks:     { type: 'array', items: { $ref: '#/components/schemas/Rank' } },
                    positions: { type: 'array', items: { $ref: '#/components/schemas/Position' } },
                  },
                },
              },
            },
          },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },

    '/api/test-http-error/{code}': {
      get: {
        tags: ['System'],
        summary: 'Giả lập mã lỗi HTTP (400, 401, 403, 404, 500, 502, 503)',
        security: [],
        parameters: [
          { in: 'path', name: 'code', required: true, schema: { type: 'integer' }, example: 403 },
          { in: 'query', name: 'msg', schema: { type: 'string' } },
        ],
        responses: {
          default: {
            description: 'Trả về đúng mã status yêu cầu',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok:        { type: 'boolean' },
                    code:      { type: 'integer' },
                    error:     { type: 'string' },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ==========================================================
    // DOCUMENTS
    // ==========================================================
    '/api/documents': {
      get: {
        tags: ['Documents'],
        summary: 'Tìm kiếm / liệt kê tài liệu (tự lọc theo cấp mật)',
        parameters: [
          { in: 'query', name: 'q',     schema: { type: 'string' } },
          { in: 'query', name: 'code',  schema: { type: 'string' }, example: '123/QĐ-BGH' },
          { in: 'query', name: 'title', schema: { type: 'string' } },
          { in: 'query', name: 'type',  schema: { type: 'string' } },
          { in: 'query', name: 'unit',  schema: { type: 'string' } },
          { in: 'query', name: 'from',  schema: { type: 'string', format: 'date' } },
          { in: 'query', name: 'to',    schema: { type: 'string', format: 'date' } },
          { in: 'query', name: 'lv',    schema: { type: 'integer', minimum: 1, maximum: 5 } },
        ],
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    total: { type: 'integer' },
                    items: { type: 'array', items: { $ref: '#/components/schemas/Document' } },
                  },
                },
              },
            },
          },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },

    '/api/documents/upload': {
      post: {
        tags: ['Documents'],
        summary: 'Upload PDF mới (≤ 50 MB, tự tính SHA-256)',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file', 'title', 'security_level_id'],
                properties: {
                  file:              { type: 'string', format: 'binary' },
                  document_code:     { type: 'string', example: '125/QĐ-QK7' },
                  title:             { type: 'string', example: 'Quyết định bổ nhiệm' },
                  doc_type_id:       { type: 'string', example: 'QD' },
                  issued_date:       { type: 'string', format: 'date', example: '2026-10-14' },
                  issuing_unit_id:   { type: 'string', example: 'U-BGH' },
                  signer:            { type: 'string', example: 'Đại tá Nguyễn Văn A' },
                  summary:           { type: 'string' },
                  security_level_id: { type: 'integer', minimum: 1, maximum: 5, example: 2 },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success:     { type: 'boolean' },
                    file_id:     { type: 'string' },
                    stored_path: { type: 'string' },
                    sha256:      { type: 'string' },
                  },
                },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },

    '/api/documents/{fileId}': {
      get: {
        tags: ['Documents'],
        summary: 'Chi tiết 1 tài liệu',
        parameters: [{ $ref: '#/components/parameters/FileId' }],
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/Document' } } } },
          404: { $ref: '#/components/responses/NotFound' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
      put: {
        tags: ['Documents'],
        summary: 'Sửa metadata (tùy chọn thay file PDF)',
        parameters: [{ $ref: '#/components/parameters/FileId' }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
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
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'OK' },
          400: { $ref: '#/components/responses/BadRequest' },
          404: { $ref: '#/components/responses/NotFound' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
      delete: {
        tags: ['Documents'],
        summary: 'Xóa tài liệu (file + record)',
        parameters: [{ $ref: '#/components/parameters/FileId' }],
        responses: {
          200: { description: 'OK' },
          404: { $ref: '#/components/responses/NotFound' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },

    // ==========================================================
    // FILES
    // ==========================================================
    '/api/files/{fileId}/view': {
      get: {
        tags: ['Files'],
        summary: 'Xem (inline) hoặc tải (attachment) PDF',
        description: 'Tài liệu Cấp ≥ 3 → CHỈ xem được, `download=1` sẽ trả 403.',
        parameters: [
          { $ref: '#/components/parameters/FileId' },
          { in: 'query', name: 'download', schema: { type: 'string', enum: ['0', '1'], default: '0' } },
        ],
        responses: {
          200: { description: 'Stream PDF', content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } } },
          403: { description: 'Không đủ quyền hoặc Cấp ≥ 3 không được tải' },
          404: { $ref: '#/components/responses/NotFound' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },

    // ==========================================================
    // LOGS
    // ==========================================================
    '/api/access-logs': {
      get: {
        tags: ['Logs'],
        summary: 'Nhật ký truy cập (200 bản ghi gần nhất)',
        parameters: [
          { in: 'query', name: 'user',   schema: { type: 'string' } },
          {
            in: 'query', name: 'action',
            schema: {
              type: 'string',
              enum: ['LOGIN', 'LOGIN_FAIL', 'VIEW', 'DOWNLOAD', 'UPLOAD', 'UPDATE', 'DELETE', 'DENIED', 'ERROR'],
            },
          },
        ],
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    total: { type: 'integer' },
                    items: { type: 'array', items: { $ref: '#/components/schemas/AccessLog' } },
                  },
                },
              },
            },
          },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },

    // ==========================================================
    // ADMIN — STATS
    // ==========================================================
    '/api/admin/stats': {
      get: {
        tags: ['Admin'],
        summary: 'Thống kê KPI tổng quan',
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    users:     { type: 'integer' },
                    documents: { type: 'integer' },
                    totalSize: { type: 'integer' },
                    logs24h:   { type: 'integer' },
                    byLevel:   { type: 'array', items: { type: 'object' } },
                    byType:    { type: 'array', items: { type: 'object' } },
                    byUnit:    { type: 'array', items: { type: 'object' } },
                  },
                },
              },
            },
          },
          403: { description: 'Cần vai trò admin' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },

    // ==========================================================
    // ADMIN — USERS
    // ==========================================================
    '/api/admin/users': {
      get: {
        tags: ['Admin'],
        summary: 'Danh sách user',
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    total: { type: 'integer' },
                    items: { type: 'array', items: { $ref: '#/components/schemas/UserFull' } },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Admin'],
        summary: 'Tạo user mới',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['user_id', 'username', 'password', 'full_name', 'clearance_level_id'],
                properties: {
                  user_id:            { type: 'string', example: 'USR-005' },
                  username:           { type: 'string', example: 'nguyenvana' },
                  password:           { type: 'string', minLength: 8, example: 'MatKhau@2026' },
                  full_name:          { type: 'string', example: 'Nguyễn Văn A' },
                  rank_name:          { type: 'string', example: 'Đại tá' },
                  position:           { type: 'string', example: 'Trưởng phòng' },
                  unit_id:            { type: 'string', example: 'U-BGH' },
                  status:             { type: 'string', enum: ['active', 'locked', 'inactive'], default: 'active' },
                  clearance_level_id: { type: 'integer', minimum: 1, maximum: 5 },
                  role_id:            { type: 'string', example: 'ROL-04' },
                  roles:              { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Tạo thành công' },
          400: { $ref: '#/components/responses/BadRequest' },
          409: { description: 'Trùng user_id hoặc username' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },

    '/api/admin/users/{id}': {
      put: {
        tags: ['Admin'],
        summary: 'Cập nhật hồ sơ user',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' }, example: 'USR-005' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  full_name:          { type: 'string' },
                  rank_name:          { type: 'string' },
                  position:           { type: 'string' },
                  unit_id:            { type: 'string' },
                  status:             { type: 'string', enum: ['active', 'locked', 'inactive'] },
                  clearance_level_id: { type: 'integer' },
                  role_id:            { type: 'string' },
                  roles:              { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'OK' },
          404: { $ref: '#/components/responses/NotFound' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
      delete: {
        tags: ['Admin'],
        summary: 'Xóa user',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'OK' },
          404: { $ref: '#/components/responses/NotFound' },
          409: { description: 'Đang được tham chiếu' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },

    '/api/admin/users/{id}/credentials': {
      put: {
        tags: ['Admin'],
        summary: 'Đổi username / password',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username'],
                properties: {
                  username: { type: 'string' },
                  password: { type: 'string', minLength: 8, nullable: true },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'OK' },
          404: { $ref: '#/components/responses/NotFound' },
          409: { description: 'Username đã tồn tại' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },

    '/api/admin/users/{id}/unlock': {
      post: {
        tags: ['Admin'],
        summary: 'Mở khóa tài khoản (reset failed_attempts)',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'OK' },
          404: { $ref: '#/components/responses/NotFound' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },

    '/api/admin/users/{id}/roles': {
      get: {
        tags: ['Admin'],
        summary: 'Danh sách role của user',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'OK' } },
      },
      post: {
        tags: ['Admin'],
        summary: 'Gán role cho user',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['role_id'],
                properties: { role_id: { type: 'string', example: 'ROL-04' } },
              },
            },
          },
        },
        responses: { 200: { description: 'OK' }, 409: { description: 'Đã có role này' } },
      },
    },

    '/api/admin/users/{id}/roles/{roleId}': {
      delete: {
        tags: ['Admin'],
        summary: 'Bỏ role khỏi user',
        parameters: [
          { in: 'path', name: 'id',     required: true, schema: { type: 'string' } },
          { in: 'path', name: 'roleId', required: true, schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'OK' } },
      },
    },

    // ==========================================================
    // ADMIN — ROLES
    // ==========================================================
    '/api/admin/roles': {
      get: { tags: ['Admin'], summary: 'Danh sách role', responses: { 200: { description: 'OK' } } },
      post: {
        tags: ['Admin'],
        summary: 'Tạo role',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['role_id', 'name'],
                properties: {
                  role_id: { type: 'string', example: 'ROL-09' },
                  name:    { type: 'string', example: 'Nhân viên' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'OK' }, 409: { description: 'Trùng' } },
      },
    },

    '/api/admin/roles/{id}': {
      put: {
        tags: ['Admin'],
        summary: 'Sửa role',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', required: ['name'], properties: { name: { type: 'string' } } },
            },
          },
        },
        responses: { 200: { description: 'OK' }, 404: { $ref: '#/components/responses/NotFound' } },
      },
      delete: {
        tags: ['Admin'],
        summary: 'Xóa role (kèm USER_ROLE và ROLE_PERMISSION)',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'OK' }, 404: { $ref: '#/components/responses/NotFound' } },
      },
    },

    // ==========================================================
    // ADMIN — PERMISSIONS
    // ==========================================================
    '/api/admin/permissions': {
      get: { tags: ['Admin'], summary: 'Danh sách quyền', responses: { 200: { description: 'OK' } } },
      post: {
        tags: ['Admin'],
        summary: 'Tạo quyền',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['permission_id', 'code'],
                properties: {
                  permission_id: { type: 'string', example: 'PERM-10' },
                  code:          { type: 'string', example: 'doc.delete' },
                  description:   { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'OK' }, 409: { description: 'Trùng' } },
      },
    },

    '/api/admin/permissions/{id}': {
      delete: {
        tags: ['Admin'],
        summary: 'Xóa quyền',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'OK' }, 404: { $ref: '#/components/responses/NotFound' } },
      },
    },

    // ==========================================================
    // ADMIN — ROLE_PERMISSION
    // ==========================================================
    '/api/admin/roles/{id}/permissions': {
      get: {
        tags: ['Admin'],
        summary: 'Danh sách quyền của role',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'OK' } },
      },
      post: {
        tags: ['Admin'],
        summary: 'Gán quyền cho role',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', required: ['permission_id'], properties: { permission_id: { type: 'string' } } },
            },
          },
        },
        responses: { 200: { description: 'OK' }, 409: { description: 'Đã có' } },
      },
    },

    '/api/admin/roles/{id}/permissions/{permId}': {
      delete: {
        tags: ['Admin'],
        summary: 'Bỏ quyền khỏi role',
        parameters: [
          { in: 'path', name: 'id',     required: true, schema: { type: 'string' } },
          { in: 'path', name: 'permId', required: true, schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'OK' } },
      },
    },

    // ==========================================================
    // ADMIN — UNITS
    // ==========================================================
    '/api/admin/units': {
      get: { tags: ['Admin'], summary: 'Danh sách đơn vị', responses: { 200: { description: 'OK' } } },
      post: {
        tags: ['Admin'],
        summary: 'Tạo đơn vị',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['unit_id', 'name'],
                properties: {
                  unit_id:   { type: 'string', example: 'U-BGH' },
                  name:      { type: 'string', example: 'Ban Giám hiệu' },
                  parent_id: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'OK' }, 409: { description: 'Trùng' } },
      },
    },

    '/api/admin/units/{id}': {
      put: {
        tags: ['Admin'],
        summary: 'Sửa đơn vị',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { name: { type: 'string' }, parent_id: { type: 'string', nullable: true } },
              },
            },
          },
        },
        responses: { 200: { description: 'OK' }, 404: { $ref: '#/components/responses/NotFound' } },
      },
      delete: {
        tags: ['Admin'],
        summary: 'Xóa đơn vị',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'OK' },
          404: { $ref: '#/components/responses/NotFound' },
          409: { description: 'Đang có user/tài liệu dùng' },
        },
      },
    },

    // ==========================================================
    // ADMIN — DOCUMENT TYPES
    // ==========================================================
    '/api/admin/document-types': {
      get: { tags: ['Admin'], summary: 'Danh sách loại văn bản', responses: { 200: { description: 'OK' } } },
      post: {
        tags: ['Admin'],
        summary: 'Tạo loại văn bản',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['type_id', 'name'],
                properties: {
                  type_id:     { type: 'string', example: 'QD' },
                  name:        { type: 'string', example: 'Quyết định' },
                  description: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'OK' }, 409: { description: 'Trùng' } },
      },
    },

    '/api/admin/document-types/{id}': {
      put: {
        tags: ['Admin'],
        summary: 'Sửa loại văn bản',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { name: { type: 'string' }, description: { type: 'string' } },
              },
            },
          },
        },
        responses: { 200: { description: 'OK' }, 404: { $ref: '#/components/responses/NotFound' } },
      },
      delete: {
        tags: ['Admin'],
        summary: 'Xóa loại văn bản',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'OK' },
          404: { $ref: '#/components/responses/NotFound' },
          409: { description: 'Đang có tài liệu dùng' },
        },
      },
    },

    // ==========================================================
    // ADMIN — SECURITY LEVELS
    // ==========================================================
    '/api/admin/security-levels': {
      get: { tags: ['Admin'], summary: 'Danh sách mức bảo mật', responses: { 200: { description: 'OK' } } },
      post: {
        tags: ['Admin'],
        summary: 'Tạo mức bảo mật',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['level_id', 'code', 'name'],
                properties: {
                  level_id: { type: 'integer', example: 6 },
                  code:     { type: 'string', example: 'TOIUU' },
                  name:     { type: 'string', example: 'Tối ưu' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'OK' }, 409: { description: 'Trùng' } },
      },
    },

    '/api/admin/security-levels/{id}': {
      put: {
        tags: ['Admin'],
        summary: 'Sửa mức bảo mật',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { code: { type: 'string' }, name: { type: 'string' } },
              },
            },
          },
        },
        responses: { 200: { description: 'OK' }, 404: { $ref: '#/components/responses/NotFound' } },
      },
      delete: {
        tags: ['Admin'],
        summary: 'Xóa mức bảo mật',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'OK' },
          404: { $ref: '#/components/responses/NotFound' },
          409: { description: 'Đang có user/tài liệu dùng' },
        },
      },
    },

    // ==========================================================
    // ADMIN — RANKS
    // ==========================================================
    '/api/admin/ranks': {
      get: { tags: ['Admin'], summary: 'Danh sách cấp bậc quân hàm', responses: { 200: { description: 'OK' } } },
      post: {
        tags: ['Admin'],
        summary: 'Tạo cấp bậc quân hàm',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['rank_id', 'name'],
                properties: {
                  rank_id:    { type: 'string', example: 'MR-11' },
                  name:       { type: 'string', example: 'Thượng tá' },
                  sort_order: { type: 'integer', example: 11 },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'OK' }, 409: { description: 'Trùng rank_id hoặc tên' } },
      },
    },

    '/api/admin/ranks/{id}': {
      put: {
        tags: ['Admin'],
        summary: 'Sửa cấp bậc',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name:       { type: 'string' },
                  sort_order: { type: 'integer' },
                  active:     { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'OK' }, 404: { $ref: '#/components/responses/NotFound' } },
      },
      delete: {
        tags: ['Admin'],
        summary: 'Xóa cấp bậc (soft delete nếu đang dùng)',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'OK' }, 404: { $ref: '#/components/responses/NotFound' } },
      },
    },

    // ==========================================================
    // ADMIN — POSITIONS
    // ==========================================================
    '/api/admin/positions': {
      get: { tags: ['Admin'], summary: 'Danh sách chức vụ', responses: { 200: { description: 'OK' } } },
      post: {
        tags: ['Admin'],
        summary: 'Tạo chức vụ',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['position_id', 'name'],
                properties: {
                  position_id: { type: 'string', example: 'MP-11' },
                  name:        { type: 'string', example: 'Phó phòng' },
                  sort_order:  { type: 'integer', example: 11 },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'OK' }, 409: { description: 'Trùng position_id hoặc tên' } },
      },
    },

    '/api/admin/positions/{id}': {
      put: {
        tags: ['Admin'],
        summary: 'Sửa chức vụ',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name:       { type: 'string' },
                  sort_order: { type: 'integer' },
                  active:     { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'OK' }, 404: { $ref: '#/components/responses/NotFound' } },
      },
      delete: {
        tags: ['Admin'],
        summary: 'Xóa chức vụ (soft delete nếu đang dùng)',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'OK' }, 404: { $ref: '#/components/responses/NotFound' } },
      },
    },

    // ==========================================================
    // ADMIN — IP BLOCKLIST
    // ==========================================================
    '/api/admin/ip-blocklist': {
      get: {
        tags: ['Admin'],
        summary: 'Danh sách IP đang bị chặn',
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    items: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          ip:            { type: 'string' },
                          blocked_until: { type: 'string', format: 'date-time' },
                          reason:        { type: 'string', nullable: true },
                          blocked_at:    { type: 'string', format: 'date-time' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    '/api/admin/ip-blocklist/{ip}': {
      delete: {
        tags: ['Admin'],
        summary: 'Gỡ chặn IP',
        parameters: [{ in: 'path', name: 'ip', required: true, schema: { type: 'string' }, example: '192.168.1.100' }],
        responses: {
          200: { description: 'OK' },
          404: { description: 'IP không có trong blocklist' },
        },
      },
    },

    // ==========================================================
    // ADMIN — LOGIN ATTEMPTS
    // ==========================================================
    '/api/admin/login-attempts': {
      get: {
        tags: ['Admin'],
        summary: 'Lịch sử đăng nhập (audit 200 bản ghi gần nhất)',
        parameters: [
          { in: 'query', name: 'ip', schema: { type: 'string' } },
          {
            in: 'query', name: 'result',
            schema: {
              type: 'string',
              enum: ['SUCCESS', 'WRONG_PASSWORD', 'USERNAME_NOT_FOUND', 'LOCKED'],
            },
          },
        ],
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    items: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          attempt_id:   { type: 'integer' },
                          ip:           { type: 'string' },
                          username:     { type: 'string', nullable: true },
                          result:       { type: 'string' },
                          attempted_at: { type: 'string', format: 'date-time' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ==========================================================
    // AI ASSISTANT (TRỢ LÝ TÁC CHIẾN & VĂN THƯ)
    // ==========================================================
    '/api/ai/health': {
      get: {
        tags: ['AI Assistant'],
        summary: 'Kiểm tra trạng thái AI_BOXCHAT Microservice & Fallback',
        responses: {
          200: {
            description: 'Trạng thái hoạt động',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'online' },
                    service: { type: 'string', example: 'AI_BOXCHAT' },
                    port: { type: 'integer', example: 8001 },
                    total_chunks_indexed: { type: 'integer', example: 120 }
                  }
                }
              }
            }
          }
        }
      }
    },

    '/api/ai/chat': {
      post: {
        tags: ['AI Assistant'],
        summary: 'Hỏi đáp tác chiến & văn thư có trích dẫn số trang [p.X]',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['query'],
                properties: {
                  query: { type: 'string', example: 'Quy định bảo mật tài liệu tác chiến?' },
                  file_id: { type: 'string', nullable: true, example: 'DOC-1760000000000-A1B2' }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Câu trả lời kèm trích dẫn số trang',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    answer: { type: 'string' },
                    citations: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          file_id: { type: 'string' },
                          document_code: { type: 'string' },
                          title: { type: 'string' },
                          page: { type: 'integer' },
                          security_level_name: { type: 'string' },
                          snippet: { type: 'string' }
                        }
                      }
                    },
                    reasoning: {
                      type: 'object',
                      properties: {
                        mem: { type: 'string' },
                        think: { type: 'string' },
                        tool_call: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },

    '/api/ai/study-book/{fileId}': {
      get: {
        tags: ['AI Assistant'],
        summary: 'Tạo Cuốn Sách Riêng 3 Tab (01 Tài liệu, 02 Sơ đồ Mermaid, 03 Kiểm tra trắc nghiệm)',
        parameters: [{ $ref: '#/components/parameters/FileId' }],
        responses: {
          200: {
            description: 'Dữ liệu 3 tab chi tiết',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    file_id: { type: 'string' },
                    document_code: { type: 'string' },
                    title: { type: 'string' },
                    total_pages: { type: 'integer' },
                    tab_document: { type: 'object' },
                    tab_diagram: { type: 'object' },
                    tab_quiz: { type: 'array', items: { type: 'object' } }
                  }
                }
              }
            }
          },
          403: { $ref: '#/components/responses/Unauthorized' }
        }
      }
    },

    '/api/ai/sync-all': {
      post: {
        tags: ['AI Assistant'],
        summary: 'Đồng bộ toàn bộ metadata và file PDF từ Database sang Vector DB',
        responses: {
          200: {
            description: 'Kết quả đồng bộ',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    total_documents: { type: 'integer', example: 15 }
                  }
                }
              }
            }
          }
        }
      }
    },
  },

  // ============================================================
  // COMPONENTS
  // ============================================================
  components: {
    securitySchemes: {
      UserHeader: {
        type: 'apiKey',
        in: 'header',
        name: 'X-User-Id',
        description: 'Mã user (VD: USR-001)',
      },
      ClearanceHeader: {
        type: 'apiKey',
        in: 'header',
        name: 'X-Clearance',
        description: 'Mức bảo mật 1-5',
      },
    },

    parameters: {
      FileId: {
        in: 'path',
        name: 'fileId',
        required: true,
        schema: { type: 'string' },
        description: 'Mã tài liệu',
        example: 'DOC-1760000000000-A1B2',
      },
    },

    responses: {
      BadRequest: {
        description: 'Dữ liệu không hợp lệ',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      Unauthorized: {
        description: 'Chưa xác thực / sai thông tin',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      NotFound: {
        description: 'Không tìm thấy',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      ServerError: {
        description: 'Lỗi server',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
    },

    schemas: {
      Error: {
        type: 'object',
        properties: { error: { type: 'string', example: 'Không tìm thấy tài liệu' } },
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
        },
      },

      UserFull: {
        allOf: [
          { $ref: '#/components/schemas/User' },
          {
            type: 'object',
            properties: {
              roles:      { type: 'array', items: { type: 'string' }, example: ['ROL-01'] },
              role_names: { type: 'array', items: { type: 'string' }, example: ['Admin'] },
            },
          },
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
          created_at:        { type: 'string', format: 'date-time' },
          updated_at:        { type: 'string', format: 'date-time', nullable: true },
        },
      },

      AccessLog: {
        type: 'object',
        properties: {
          log_id:    { type: 'string' },
          user_id:   { type: 'string' },
          full_name: { type: 'string', nullable: true },
          file_id:   { type: 'string', nullable: true },
          doc_title: { type: 'string', nullable: true },
          action:    { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
          ip:        { type: 'string', nullable: true },
          note:      { type: 'string', nullable: true },
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
          rank_id:    { type: 'string', example: 'MR-01' },
          name:       { type: 'string', example: 'Đại tá' },
          sort_order: { type: 'integer', example: 1 },
          active:     { type: 'boolean', example: true },
          created_at: { type: 'string', format: 'date-time', nullable: true },
        },
      },

      Position: {
        type: 'object',
        properties: {
          position_id: { type: 'string', example: 'MP-01' },
          name:        { type: 'string', example: 'Trưởng phòng' },
          sort_order:  { type: 'integer', example: 1 },
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
console.log('[SWAGGER] QK7 DataHub API Spec loaded');
console.log('[SWAGGER] Paths     :', paths.length);
console.log('[SWAGGER] Operations:', opCount);
console.log('[SWAGGER] Tags      : Auth, System, Documents, Files, Logs, Admin');
console.log('════════════════════════════════════════');

module.exports = swaggerSpec;