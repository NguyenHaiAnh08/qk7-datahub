// ============================================================
// QK7 DataHub — OpenAPI Spec
// Khai báo trực tiếp, không dùng swagger-jsdoc
// ============================================================

const swaggerSpec = {
    openapi: '3.0.0',
    info: {
        title: 'QK7 DataHub API',
        version: '1.0.0',
        description: 'API Gateway nội bộ kết nối các server LAN — Hệ thống quản lý tài liệu PDF',
        contact: { name: 'Phòng CNTT QK7' }
    },
    servers: [
        { url: 'http://localhost:8000', description: 'Development server' }
    ],
    tags: [
        { name: 'Dashboard', description: 'Dữ liệu tổng quan' },
        { name: 'Files', description: 'Stream file' },
        { name: 'Search', description: 'Tìm kiếm' }
    ],
    paths: {
        '/api/dashboard-data': {
            get: {
                summary: 'Lấy dữ liệu tổng quan từ tất cả server LAN',
                description: 'Gọi song song các server trong config.json. Timeout 2 giây/server.',
                tags: ['Dashboard'],
                responses: {
                    '200': {
                        description: 'Thành công',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        data: {
                                            type: 'array',
                                            items: { $ref: '#/components/schemas/ServerInfo' }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/api/stream-file': {
            get: {
                summary: 'Stream file PDF từ server LAN về client',
                description: 'Proxy stream file trực tiếp, không lưu tạm.',
                tags: ['Files'],
                parameters: [
                    { in: 'query', name: 'ip', required: true, schema: { type: 'string' }, example: '127.0.0.10' },
                    { in: 'query', name: 'port', required: true, schema: { type: 'integer' }, example: 3000 },
                    { in: 'query', name: 'fileName', required: true, schema: { type: 'string' }, example: 'Mat/baocao.pdf' }
                ],
                responses: {
                    '200': {
                        description: 'File stream',
                        content: {
                            'application/pdf': { schema: { type: 'string', format: 'binary' } }
                        }
                    },
                    '500': { description: 'Lỗi kết nối' }
                }
            }
        },
        '/api/search': {
            get: {
                summary: 'Tìm kiếm file trên tất cả server LAN',
                description: 'Gọi song song /api/search trên các server con. Từ khóa >= 2 ký tự.',
                tags: ['Search'],
                parameters: [
                    { in: 'query', name: 'q', required: true, schema: { type: 'string', minLength: 2 }, example: 'bao cao' }
                ],
                responses: {
                    '200': {
                        description: 'Kết quả',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        data: { type: 'array', items: { type: 'object' } }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    },
    components: {
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT'
            }
        },
        schemas: {
            FileItem: {
                type: 'object',
                properties: {
                    name: { type: 'string', example: 'baocao.pdf' },
                    type: { type: 'string', enum: ['file', 'folder'], example: 'file' },
                    path: { type: 'string', example: 'Mat/baocao.pdf' },
                    size: { type: 'integer', example: 2048000 }
                }
            },
            ServerInfo: {
                type: 'object',
                properties: {
                    name: { type: 'string', example: 'Máy 1 - Hành chính' },
                    ip: { type: 'string', example: '127.0.0.10' },
                    port: { type: 'integer', example: 3000 },
                    connected: { type: 'boolean', example: true },
                    files: { type: 'array', items: { $ref: '#/components/schemas/FileItem' } }
                }
            }
        }
    }
};

// DEBUG — in ra để biết spec có load được không
const pathsFound = Object.keys(swaggerSpec.paths || {});
console.log('========================================');
console.log('[SWAGGER] Spec loaded successfully');
console.log('[SWAGGER] Paths found:', pathsFound.length, pathsFound);
console.log('========================================');

module.exports = swaggerSpec;