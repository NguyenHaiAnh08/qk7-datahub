// ============================================================
// QK7 DataHub — OpenAPI 3.0 Spec
// Khai báo tập trung toàn bộ REST API
// ============================================================

const swaggerSpec = {
    openapi: '3.0.0',
    info: {
        title: 'QK7 DataHub API',
        version: '1.0.0',
        description:
            'API Gateway nội bộ QK7 — Quản lý tài liệu PDF với phân cấp bảo mật 5 mức.\n\n' +
            '**Xác thực:** gửi kèm header `X-User-Id` và `X-Clearance` trên mọi request (trừ `/api/auth/login`).',
        contact: { name: 'Phòng CNTT QK7' }
    },
    servers: [
        { url: '/', description: 'Cùng origin với Swagger UI' }
    ],

    tags: [
        { name: 'Auth',       description: 'Xác thực & thông tin user' },
        { name: 'System',     description: 'Health check & danh mục' },
        { name: 'Documents',  description: 'CRUD tài liệu PDF' },
        { name: 'Files',      description: 'Xem / tải PDF' },
        { name: 'Logs',       description: 'Nhật ký truy cập' },
        { name: 'Admin',      description: 'Quản trị hệ thống (cần mức 4+)' }
    ],

    // ─── Bảo mật: dùng header tùy chỉnh ───
    security: [{ UserHeader: [], ClearanceHeader: [] }],

    paths: {

        // ============================================================
        // AUTH
        // ============================================================
        '/api/auth/login': {
            post: {
                tags: ['Auth'],
                summary: 'Đăng nhập',
                description: 'Xác thực user bằng `username` hoặc `user_id` + mật khẩu. Trả về thông tin user kèm roles.',
                security: [],   // Không cần header
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['user_id', 'password'],
                                properties: {
                                    user_id:  { type: 'string', example: 'usr-001' },
                                    password: { type: 'string', example: '123456789' }
                                }
                            }
                        }
                    }
                },
                responses: {
                    200: {
                        description: 'Đăng nhập thành công',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        user: { $ref: '#/components/schemas/UserFull' }
                                    }
                                }
                            }
                        }
                    },
                    400: { $ref: '#/components/responses/BadRequest' },
                    401: { $ref: '#/components/responses/Unauthorized' },
                    403: { description: 'Tài khoản bị khóa hoặc chưa cấp mật khẩu' },
                    500: { $ref: '#/components/responses/ServerError' }
                }
            }
        },

        '/api/auth/me': {
            get: {
                tags: ['Auth'],
                summary: 'Lấy thông tin user đang đăng nhập',
                description: 'Dựa vào header `X-User-Id` để tra thông tin user + roles.',
                responses: {
                    200: {
                        description: 'Thành công',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/UserFull' }
                            }
                        }
                    },
                    401: { $ref: '#/components/responses/Unauthorized' },
                    404: { $ref: '#/components/responses/NotFound' },
                    500: { $ref: '#/components/responses/ServerError' }
                }
            }
        },

        // ============================================================
        // SYSTEM
        // ============================================================
        '/api/health': {
            get: {
                tags: ['System'],
                summary: 'Health check — kết nối DB',
                responses: {
                    200: {
                        description: 'Thành công',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        ok:         { type: 'boolean', example: true },
                                        db:         { type: 'string', example: 'QK7_ThuVienSo' },
                                        login_name: { type: 'string', example: 'sa' },
                                        now:        { type: 'string', format: 'date-time' }
                                    }
                                }
                            }
                        }
                    },
                    500: { $ref: '#/components/responses/ServerError' }
                }
            }
        },

        '/api/meta': {
            get: {
                tags: ['System'],
                summary: 'Lấy danh mục: loại văn bản, đơn vị, mức bảo mật',
                responses: {
                    200: {
                        description: 'Thành công',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        types:  { type: 'array', items: { $ref: '#/components/schemas/DocumentType' } },
                                        units:  { type: 'array', items: { $ref: '#/components/schemas/Unit' } },
                                        levels: { type: 'array', items: { $ref: '#/components/schemas/SecurityLevel' } }
                                    }
                                }
                            }
                        }
                    },
                    500: { $ref: '#/components/responses/ServerError' }
                }
            }
        },

        // ============================================================
        // DOCUMENTS
        // ============================================================
        '/api/documents': {
            get: {
                tags: ['Documents'],
                summary: 'Tìm kiếm / liệt kê tài liệu',
                description: 'Tự động lọc theo mức bảo mật của user (không thấy tài liệu vượt cấp).',
                parameters: [
                    { in: 'query', name: 'code',  schema: { type: 'string' }, description: 'Mã/số ký hiệu', example: '123/QĐ-BGH' },
                    { in: 'query', name: 'title', schema: { type: 'string' }, description: 'Trích yếu' },
                    { in: 'query', name: 'type',  schema: { type: 'string' }, description: 'Mã loại văn bản' },
                    { in: 'query', name: 'unit',  schema: { type: 'string' }, description: 'Mã đơn vị ban hành' },
                    { in: 'query', name: 'from',  schema: { type: 'string', format: 'date' }, description: 'Từ ngày' },
                    { in: 'query', name: 'to',    schema: { type: 'string', format: 'date' }, description: 'Đến ngày' },
                    { in: 'query', name: 'lv',    schema: { type: 'integer', minimum: 1, maximum: 5 }, description: 'Mức bảo mật tối đa' }
                ],
                responses: {
                    200: {
                        description: 'Thành công',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        total: { type: 'integer', example: 12 },
                                        items: { type: 'array', items: { $ref: '#/components/schemas/Document' } }
                                    }
                                }
                            }
                        }
                    },
                    500: { $ref: '#/components/responses/ServerError' }
                }
            }
        },

        '/api/documents/upload': {
            post: {
                tags: ['Documents'],
                summary: 'Upload PDF mới',
                description: 'File ≤ 50 MB. Hệ thống tự tính SHA-256, lưu theo `uploads/YYYY/MM/`.',
                requestBody: {
                    required: true,
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: 'object',
                                required: ['file', 'title', 'security_level_id'],
                                properties: {
                                    file:               { type: 'string', format: 'binary', description: 'File PDF' },
                                    document_code:      { type: 'string', example: '123/QĐ-BGH' },
                                    title:              { type: 'string', example: 'Quyết định bổ nhiệm' },
                                    doc_type_id:        { type: 'string', example: 'QD' },
                                    issued_date:        { type: 'string', format: 'date', example: '2026-10-14' },
                                    issuing_unit_id:    { type: 'string', example: 'U-BGH' },
                                    signer:             { type: 'string', example: 'Đại tá Nguyễn Văn A' },
                                    summary:            { type: 'string' },
                                    security_level_id:  { type: 'integer', minimum: 1, maximum: 5, example: 2 }
                                }
                            }
                        }
                    }
                },
                responses: {
                    200: {
                        description: 'Upload thành công',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success:     { type: 'boolean', example: true },
                                        file_id:     { type: 'string', example: 'DOC-1760000000000-A1B2' },
                                        stored_path: { type: 'string', example: 'uploads/2026/10/20261014_QD_123-QD-BGH_ab12cd34.pdf' },
                                        sha256:      { type: 'string' }
                                    }
                                }
                            }
                        }
                    },
                    400: { $ref: '#/components/responses/BadRequest' },
                    500: { $ref: '#/components/responses/ServerError' }
                }
            }
        },

        '/api/documents/{fileId}': {
            get: {
                tags: ['Documents'],
                summary: 'Lấy chi tiết 1 tài liệu',
                parameters: [{ $ref: '#/components/parameters/FileId' }],
                responses: {
                    200: {
                        description: 'Thành công',
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/Document' } } }
                    },
                    404: { $ref: '#/components/responses/NotFound' },
                    500: { $ref: '#/components/responses/ServerError' }
                }
            },
            put: {
                tags: ['Documents'],
                summary: 'Sửa metadata (tùy chọn thay file PDF mới)',
                parameters: [{ $ref: '#/components/parameters/FileId' }],
                requestBody: {
                    required: true,
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: 'object',
                                required: ['title', 'security_level_id'],
                                properties: {
                                    file:               { type: 'string', format: 'binary', description: 'File mới (tùy chọn)' },
                                    document_code:      { type: 'string' },
                                    title:              { type: 'string' },
                                    doc_type_id:        { type: 'string' },
                                    issued_date:        { type: 'string', format: 'date' },
                                    issuing_unit_id:    { type: 'string' },
                                    signer:             { type: 'string' },
                                    summary:            { type: 'string' },
                                    security_level_id:  { type: 'integer' }
                                }
                            }
                        }
                    }
                },
                responses: {
                    200: { description: 'Cập nhật thành công' },
                    400: { $ref: '#/components/responses/BadRequest' },
                    404: { $ref: '#/components/responses/NotFound' },
                    500: { $ref: '#/components/responses/ServerError' }
                }
            },
            delete: {
                tags: ['Documents'],
                summary: 'Xóa tài liệu (file + DB record)',
                parameters: [{ $ref: '#/components/parameters/FileId' }],
                responses: {
                    200: { description: 'Xóa thành công' },
                    404: { $ref: '#/components/responses/NotFound' },
                    500: { $ref: '#/components/responses/ServerError' }
                }
            }
        },

        // ============================================================
        // FILES — xem / tải PDF
        // ============================================================
        '/api/files/{fileId}/view': {
            get: {
                tags: ['Files'],
                summary: 'Xem hoặc tải PDF',
                description: 'Kiểm tra mức bảo mật trước khi stream. Ghi log VIEW hoặc DOWNLOAD.',
                parameters: [
                    { $ref: '#/components/parameters/FileId' },
                    { in: 'query', name: 'download', schema: { type: 'string', enum: ['0', '1'] }, description: '1 = tải về (attachment), 0 = xem (inline)' }
                ],
                responses: {
                    200: {
                        description: 'Stream PDF',
                        content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } }
                    },
                    403: { description: 'Không đủ quyền (mức bảo mật thấp hơn)' },
                    404: { $ref: '#/components/responses/NotFound' },
                    500: { $ref: '#/components/responses/ServerError' }
                }
            }
        },

        // ============================================================
        // LOGS
        // ============================================================
        '/api/access-logs': {
            get: {
                tags: ['Logs'],
                summary: 'Nhật ký truy cập (200 bản ghi gần nhất)',
                parameters: [
                    { in: 'query', name: 'user',   schema: { type: 'string' }, description: 'Lọc theo user_id' },
                    { in: 'query', name: 'action', schema: { type: 'string', enum: ['LOGIN', 'LOGIN_FAIL', 'VIEW', 'DOWNLOAD', 'UPLOAD', 'UPDATE', 'DELETE', 'DENIED', 'ERROR'] } }
                ],
                responses: {
                    200: {
                        description: 'Thành công',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        total: { type: 'integer' },
                                        items: { type: 'array', items: { $ref: '#/components/schemas/AccessLog' } }
                                    }
                                }
                            }
                        }
                    },
                    500: { $ref: '#/components/responses/ServerError' }
                }
            }
        },

        // ============================================================
        // ADMIN — STATS
        // ============================================================
        '/api/admin/stats': {
            get: {
                tags: ['Admin'],
                summary: 'Thống kê tổng quan',
                description: 'Yêu cầu mức bảo mật ≥ 4.',
                responses: {
                    200: {
                        description: 'Thành công',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        users:     { type: 'integer' },
                                        documents: { type: 'integer' },
                                        totalSize: { type: 'integer', description: 'Tổng dung lượng (bytes)' },
                                        logs24h:   { type: 'integer' },
                                        byLevel:   { type: 'array', items: { type: 'object', properties: { lv: { type: 'integer' }, lvName: { type: 'string' }, n: { type: 'integer' } } } },
                                        byType:    { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, n: { type: 'integer' } } } },
                                        byUnit:    { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, n: { type: 'integer' } } } }
                                    }
                                }
                            }
                        }
                    },
                    403: { description: 'Cần mức 4+' },
                    500: { $ref: '#/components/responses/ServerError' }
                }
            }
        },

        // ============================================================
        // ADMIN — USERS
        // ============================================================
        '/api/admin/users': {
            get: {
                tags: ['Admin'],
                summary: 'Danh sách user',
                responses: {
                    200: {
                        description: 'Thành công',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        total: { type: 'integer' },
                                        items: { type: 'array', items: { $ref: '#/components/schemas/User' } }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            post: {
                tags: ['Admin'],
                summary: 'Tạo user mới (kèm username + password)',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['user_id', 'username', 'password', 'full_name', 'clearance_level_id'],
                                properties: {
                                    user_id:            { type: 'string', example: 'USR-005' },
                                    username:           { type: 'string', example: 'nguyenvana', description: 'Chỉ chữ, số, ., _, -' },
                                    password:           { type: 'string', minLength: 8, example: 'MatKhau@2026' },
                                    full_name:          { type: 'string', example: 'Nguyễn Văn A' },
                                    rank_name:          { type: 'string', example: 'Đại tá' },
                                    position:           { type: 'string', example: 'Trưởng phòng' },
                                    unit_id:            { type: 'string', example: 'U-BGH' },
                                    status:             { type: 'string', enum: ['active', 'locked', 'inactive'], default: 'active' },
                                    clearance_level_id: { type: 'integer', minimum: 1, maximum: 5 }
                                }
                            }
                        }
                    }
                },
                responses: {
                    200: { description: 'Tạo thành công' },
                    400: { $ref: '#/components/responses/BadRequest' },
                    409: { description: 'Trùng user_id hoặc username' },
                    500: { $ref: '#/components/responses/ServerError' }
                }
            }
        },

        '/api/admin/users/{id}': {
            put: {
                tags: ['Admin'],
                summary: 'Cập nhật hồ sơ user (không đổi username/password)',
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
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
                                    clearance_level_id: { type: 'integer' }
                                }
                            }
                        }
                    }
                },
                responses: {
                    200: { description: 'Cập nhật thành công' },
                    404: { $ref: '#/components/responses/NotFound' },
                    500: { $ref: '#/components/responses/ServerError' }
                }
            },
            delete: {
                tags: ['Admin'],
                summary: 'Xóa user',
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Xóa thành công' },
                    404: { $ref: '#/components/responses/NotFound' },
                    409: { description: 'User đang được tham chiếu' },
                    500: { $ref: '#/components/responses/ServerError' }
                }
            }
        },

        '/api/admin/users/{id}/credentials': {
            put: {
                tags: ['Admin'],
                summary: 'Cập nhật username và/hoặc password',
                description: 'Password rỗng → chỉ đổi username. Backend hash bcrypt trước khi lưu.',
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
                                    password: { type: 'string', minLength: 8, nullable: true }
                                }
                            }
                        }
                    }
                },
                responses: {
                    200: { description: 'Cập nhật thành công' },
                    404: { $ref: '#/components/responses/NotFound' },
                    409: { description: 'Username đã tồn tại' },
                    500: { $ref: '#/components/responses/ServerError' }
                }
            }
        },

        '/api/admin/users/{id}/roles': {
            get: {
                tags: ['Admin'],
                summary: 'Danh sách role của user',
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
                responses: { 200: { description: 'Thành công' } }
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
                                properties: { role_id: { type: 'string', example: 'ROL-04' } }
                            }
                        }
                    }
                },
                responses: {
                    200: { description: 'Gán thành công' },
                    409: { description: 'Đã có role này' }
                }
            }
        },

        '/api/admin/users/{id}/roles/{roleId}': {
            delete: {
                tags: ['Admin'],
                summary: 'Bỏ role khỏi user',
                parameters: [
                    { in: 'path', name: 'id', required: true, schema: { type: 'string' } },
                    { in: 'path', name: 'roleId', required: true, schema: { type: 'string' } }
                ],
                responses: { 200: { description: 'Thành công' } }
            }
        },

        // ============================================================
        // ADMIN — ROLES
        // ============================================================
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
                                    name:    { type: 'string', example: 'Nhân viên' }
                                }
                            }
                        }
                    }
                },
                responses: { 200: { description: 'OK' }, 409: { description: 'Trùng' } }
            }
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
                            schema: { type: 'object', required: ['name'], properties: { name: { type: 'string' } } }
                        }
                    }
                },
                responses: { 200: { description: 'OK' }, 404: { $ref: '#/components/responses/NotFound' } }
            },
            delete: {
                tags: ['Admin'],
                summary: 'Xóa role (kèm USER_ROLE và ROLE_PERMISSION)',
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
                responses: { 200: { description: 'OK' }, 404: { $ref: '#/components/responses/NotFound' } }
            }
        },

        // ============================================================
        // ADMIN — PERMISSIONS
        // ============================================================
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
                                    description:   { type: 'string' }
                                }
                            }
                        }
                    }
                },
                responses: { 200: { description: 'OK' }, 409: { description: 'Trùng' } }
            }
        },

        '/api/admin/permissions/{id}': {
            delete: {
                tags: ['Admin'],
                summary: 'Xóa quyền',
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
                responses: { 200: { description: 'OK' }, 404: { $ref: '#/components/responses/NotFound' } }
            }
        },

        // ============================================================
        // ADMIN — ROLE_PERMISSION
        // ============================================================
        '/api/admin/roles/{id}/permissions': {
            get: {
                tags: ['Admin'],
                summary: 'Danh sách quyền của role',
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
                responses: { 200: { description: 'OK' } }
            },
            post: {
                tags: ['Admin'],
                summary: 'Gán quyền cho role',
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { type: 'object', required: ['permission_id'], properties: { permission_id: { type: 'string' } } }
                        }
                    }
                },
                responses: { 200: { description: 'OK' }, 409: { description: 'Đã có' } }
            }
        },

        '/api/admin/roles/{id}/permissions/{permId}': {
            delete: {
                tags: ['Admin'],
                summary: 'Bỏ quyền khỏi role',
                parameters: [
                    { in: 'path', name: 'id', required: true, schema: { type: 'string' } },
                    { in: 'path', name: 'permId', required: true, schema: { type: 'string' } }
                ],
                responses: { 200: { description: 'OK' } }
            }
        },

        // ============================================================
        // ADMIN — UNITS
        // ============================================================
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
                                    parent_id: { type: 'string', nullable: true }
                                }
                            }
                        }
                    }
                },
                responses: { 200: { description: 'OK' }, 409: { description: 'Trùng' } }
            }
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
                                properties: { name: { type: 'string' }, parent_id: { type: 'string', nullable: true } }
                            }
                        }
                    }
                },
                responses: { 200: { description: 'OK' }, 404: { $ref: '#/components/responses/NotFound' } }
            },
            delete: {
                tags: ['Admin'],
                summary: 'Xóa đơn vị',
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'OK' },
                    404: { $ref: '#/components/responses/NotFound' },
                    409: { description: 'Đang có user/tài liệu dùng' }
                }
            }
        },

        // ============================================================
        // ADMIN — DOCUMENT TYPES
        // ============================================================
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
                                    description: { type: 'string' }
                                }
                            }
                        }
                    }
                },
                responses: { 200: { description: 'OK' }, 409: { description: 'Trùng' } }
            }
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
                                properties: { name: { type: 'string' }, description: { type: 'string' } }
                            }
                        }
                    }
                },
                responses: { 200: { description: 'OK' }, 404: { $ref: '#/components/responses/NotFound' } }
            },
            delete: {
                tags: ['Admin'],
                summary: 'Xóa loại văn bản',
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'OK' },
                    404: { $ref: '#/components/responses/NotFound' },
                    409: { description: 'Đang có tài liệu dùng' }
                }
            }
        },

        // ============================================================
        // ADMIN — SECURITY LEVELS
        // ============================================================
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
                                    name:     { type: 'string', example: 'Tối ưu' }
                                }
                            }
                        }
                    }
                },
                responses: { 200: { description: 'OK' }, 409: { description: 'Trùng' } }
            }
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
                                properties: { code: { type: 'string' }, name: { type: 'string' } }
                            }
                        }
                    }
                },
                responses: { 200: { description: 'OK' }, 404: { $ref: '#/components/responses/NotFound' } }
            },
            delete: {
                tags: ['Admin'],
                summary: 'Xóa mức bảo mật',
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
                responses: {
                    200: { description: 'OK' },
                    404: { $ref: '#/components/responses/NotFound' },
                    409: { description: 'Đang có user/tài liệu dùng' }
                }
            }
        },

        // ============================================================
        // ADMIN — CLEAR LOGS
        // ============================================================
        '/api/admin/access-logs/clear': {
            delete: {
                tags: ['Admin'],
                summary: 'Xóa toàn bộ nhật ký (nguy hiểm)',
                responses: { 200: { description: 'Đã xóa' } }
            }
        }
    },

    // ============================================================
    // COMPONENTS — Schemas, Parameters, Responses, Security
    // ============================================================
    components: {

        // ─── Security schemes ───
        securitySchemes: {
            UserHeader: {
                type: 'apiKey',
                in: 'header',
                name: 'X-User-Id',
                description: 'Mã user (VD: USR-001)'
            },
            ClearanceHeader: {
                type: 'apiKey',
                in: 'header',
                name: 'X-Clearance',
                description: 'Mức bảo mật 1-5'
            }
        },

        // ─── Reusable parameters ───
        parameters: {
            FileId: {
                in: 'path',
                name: 'fileId',
                required: true,
                schema: { type: 'string' },
                description: 'Mã tài liệu',
                example: 'DOC-1760000000000-A1B2'
            }
        },

        // ─── Reusable responses ───
        responses: {
            BadRequest: {
                description: 'Dữ liệu không hợp lệ',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' }
                    }
                }
            },
            Unauthorized: {
                description: 'Chưa xác thực / sai thông tin',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' }
                    }
                }
            },
            NotFound: {
                description: 'Không tìm thấy',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' }
                    }
                }
            },
            ServerError: {
                description: 'Lỗi server',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' }
                    }
                }
            }
        },

        // ─── Reusable schemas ───
        schemas: {
            Error: {
                type: 'object',
                properties: {
                    error: { type: 'string', example: 'Không tìm thấy tài liệu' }
                }
            },

            User: {
                type: 'object',
                properties: {
                    user_id:            { type: 'string', example: 'USR-001' },
                    username:           { type: 'string', example: 'usr-001' },
                    full_name:          { type: 'string', example: 'Nguyễn Văn A' },
                    rank_name:          { type: 'string', nullable: true, example: 'Đại tá' },
                    position:           { type: 'string', nullable: true, example: 'Trưởng phòng' },
                    unit_id:            { type: 'string', nullable: true, example: 'U-BGH' },
                    unit_name:          { type: 'string', nullable: true },
                    status:             { type: 'string', enum: ['active', 'locked', 'inactive'] },
                    clearance_level_id: { type: 'integer', example: 5 },
                    clearance_name:     { type: 'string', nullable: true, example: 'Tuyệt mật' },
                    clearance_code:     { type: 'string', nullable: true, example: 'TUYETMAT' }
                }
            },

            UserFull: {
                allOf: [
                    { $ref: '#/components/schemas/User' },
                    {
                        type: 'object',
                        properties: {
                            roles:      { type: 'array', items: { type: 'string' }, example: ['ROL-01'] },
                            role_names: { type: 'array', items: { type: 'string' }, example: ['Admin'] }
                        }
                    }
                ]
            },

            Document: {
                type: 'object',
                properties: {
                    file_id:           { type: 'string', example: 'DOC-1760000000000-A1B2' },
                    document_code:     { type: 'string', nullable: true, example: '123/QĐ-BGH' },
                    title:             { type: 'string', example: 'Quyết định bổ nhiệm' },
                    doc_type_id:       { type: 'string', nullable: true, example: 'QD' },
                    doc_type_name:     { type: 'string', nullable: true, example: 'Quyết định' },
                    issued_date:       { type: 'string', format: 'date', nullable: true },
                    issuing_unit_id:   { type: 'string', nullable: true },
                    unit_name:         { type: 'string', nullable: true },
                    signer:            { type: 'string', nullable: true },
                    summary:           { type: 'string', nullable: true },
                    file_size:         { type: 'integer', nullable: true },
                    security_level_id: { type: 'integer' },
                    security_name:     { type: 'string', nullable: true },
                    created_at:        { type: 'string', format: 'date-time' },
                    updated_at:        { type: 'string', format: 'date-time', nullable: true }
                }
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
                    note:      { type: 'string', nullable: true }
                }
            },

            DocumentType: {
                type: 'object',
                properties: {
                    type_id:     { type: 'string' },
                    name:        { type: 'string' },
                    description: { type: 'string', nullable: true }
                }
            },

            Unit: {
                type: 'object',
                properties: {
                    unit_id:   { type: 'string' },
                    name:      { type: 'string' },
                    parent_id: { type: 'string', nullable: true }
                }
            },

            SecurityLevel: {
                type: 'object',
                properties: {
                    level_id: { type: 'integer' },
                    code:     { type: 'string' },
                    name:     { type: 'string' }
                }
            }
        }
    }
};

// DEBUG log khi nạp
const pathsFound = Object.keys(swaggerSpec.paths || {});
const tagsSet = new Set();
for (const path of Object.values(swaggerSpec.paths)) {
    for (const op of Object.values(path)) {
        if (Array.isArray(op?.tags)) op.tags.forEach(t => tagsSet.add(t));
    }
}
console.log('========================================');
console.log('[SWAGGER] QK7 DataHub API Spec loaded');
console.log('[SWAGGER] Endpoints:', pathsFound.length);
console.log('[SWAGGER] Tags:', [...tagsSet].join(', '));
console.log('========================================');

module.exports = swaggerSpec;