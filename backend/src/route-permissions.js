// backend/src/route-permissions.js
// ═══════════════════════════════════════════════════════════════════════════
// AUTO PERMISSIONS MAP — Phân loại 3 nhóm theo spec mới:
//   Nhóm 1 (tuyệt đối) — BẮT BUỘC duyệt: USER_DELETE, USER_ROLE_ASSIGN, ...
//   Nhóm 2 (quan trọng) — BẮT BUỘC duyệt khi EDIT/DELETE, tự do khi CREATE
//   Nhóm 3 (làm ngay) — KHÔNG duyệt: VIEW, LOGIN, UPLOAD văn bản cấp 1-2
// ═══════════════════════════════════════════════════════════════════════════

const AUTO_PERMISSIONS = {
  GET: [
    [/^\/api\/admin\/stats$/,                     'SYSTEM_STATS_VIEW'],
    [/^\/api\/admin\/users$/,                     'USER_VIEW'],
    [/^\/api\/admin\/creatable-roles$/,           'USER_VIEW'],
    [/^\/api\/admin\/users\/[^/]+\/roles$/,       'USER_VIEW'],
    [/^\/api\/admin\/users\/[^/]+\/permissions$/, 'USER_VIEW'],
    [/^\/api\/admin\/roles$/,                     'ROLE_VIEW'],
    [/^\/api\/admin\/roles\/[^/]+\/permissions$/, 'ROLE_VIEW'],
    [/^\/api\/admin\/permissions$/,               'PERMISSION_VIEW'],
    [/^\/api\/admin\/units$/,                     'UNIT_VIEW'],
    [/^\/api\/admin\/document-types$/,            'DOCTYPE_VIEW'],
    [/^\/api\/admin\/security-levels$/,           'SECLEVEL_VIEW'],
    [/^\/api\/admin\/ranks$/,                     'RANK_VIEW'],
    [/^\/api\/admin\/positions$/,                 'POSITION_VIEW'],
    [/^\/api\/admin\/unit-aliases$/,              'UNIT_ALIAS_VIEW'],
    [/^\/api\/admin\/ip-blocklist$/,              'AUDIT_VIEW'],
    [/^\/api\/admin\/login-attempts$/,            'AUDIT_VIEW'],
    [/^\/api\/admin\/sessions$/,                  'SESSION_VIEW'],
    [/^\/api\/admin\/sessions\/[^/]+$/,           'SESSION_VIEW'],
    [/^\/api\/admin\/sessions\/user\/[^/]+$/,     'SESSION_VIEW'],
    [/^\/api\/admin\/approval-requests$/,         'AUDIT_VIEW'],
    [/^\/api\/admin\/approval-requests\/[^/]+$/,  'AUDIT_VIEW'],
    [/^\/api\/admin\/protected-permissions$/,     'ROLE_VIEW'],
    [/^\/api\/documents\/trash$/,                 'DOC_TRASH_VIEW'],
    [/^\/api\/documents\/my-unit$/,               'DOC_VIEW'],
    [/^\/api\/documents\/proposals\/pending$/,     'DOC_VIEW'],
  ],

  POST: [
    // ─── NHÓM 1 (tuyệt đối — luôn phải duyệt khi bị protect) ───
    [/^\/api\/admin\/users$/,                            'USER_CREATE'],           // Tạo user
    [/^\/api\/admin\/users\/[^/]+\/roles$/,              'USER_ROLE_ASSIGN'],      // Gán role → duyệt
    [/^\/api\/admin\/users\/[^/]+\/permissions$/,        'USER_PERMISSION_ASSIGN'],// Gán perm trực tiếp → duyệt
    [/^\/api\/admin\/users\/[^/]+\/unlock$/,             'USER_EDIT'],
    [/^\/api\/admin\/roles$/,                            'ROLE_CREATE'],
    [/^\/api\/admin\/roles\/[^/]+\/permissions$/,        'ROLE_PERMISSION_ASSIGN'],// Đổi quyền role → duyệt
    [/^\/api\/admin\/permissions$/,                      'PERMISSION_CREATE'],
    [/^\/api\/admin\/security-levels$/,                  'SECLEVEL_MANAGE'],       // Đổi mức mật → duyệt
    [/^\/api\/admin\/approval-requests\/[^/]+\/(approve|reject|mark-executed)$/, 'AUDIT_VIEW'],
    [/^\/api\/admin\/protected-permissions\/[^/]+$/,     'ROLE_EDIT'],
    [/^\/api\/documents\/upload$/,                'DOC_UPLOAD'],
    [/^\/api\/documents\/parse$/,                 'DOC_PARSE'],
    [/^\/api\/documents\/[^/]+\/restore$/,        'DOC_RESTORE'],
    [/^\/api\/documents\/proposals\/[^/]+\/approve$/, 'DOC_EDIT'],
    [/^\/api\/documents\/proposals\/[^/]+\/reject$/,  'DOC_EDIT'],
    [/^\/api\/ai\/sync-all$/,                     'AI_SYNC'],
    [/^\/api\/ai\/chat$/,                         'AI_QUERY'],

    // ─── NHÓM 2 (quan trọng — CREATE thì OK, EDIT/DELETE phải duyệt) ───
    [/^\/api\/admin\/units$/,                            'UNIT_CREATE'],           // ← TÁCH riêng
    [/^\/api\/admin\/document-types$/,                   'DOCTYPE_CREATE'],        // ← TÁCH
    [/^\/api\/admin\/ranks$/,                            'RANK_CREATE'],           // ← TÁCH
    [/^\/api\/admin\/positions$/,                        'POSITION_CREATE'],       // ← TÁCH
    [/^\/api\/admin\/unit-aliases$/,                     'UNIT_ALIAS_CREATE'],     // ← TÁCH
  ],

  PUT: [
    // ─── NHÓM 1 + 2 (EDIT luôn phải duyệt) ───
    [/^\/api\/admin\/users\/[^/]+$/,                     'USER_EDIT'],
    [/^\/api\/admin\/users\/[^/]+\/credentials$/,        'USER_CREDENTIALS'],      // Reset password → duyệt
    [/^\/api\/admin\/roles\/[^/]+$/,                     'ROLE_EDIT'],
    [/^\/api\/admin\/permissions\/[^/]+$/,               'PERMISSION_EDIT'],
    [/^\/api\/admin\/units\/[^/]+$/,                     'UNIT_EDIT'],             // ← TÁCH
    [/^\/api\/admin\/document-types\/[^/]+$/,            'DOCTYPE_EDIT'],          // ← TÁCH
    [/^\/api\/admin\/security-levels\/[^/]+$/,           'SECLEVEL_MANAGE'],
    [/^\/api\/admin\/ranks\/[^/]+$/,                     'RANK_EDIT'],             // ← TÁCH
    [/^\/api\/admin\/positions\/[^/]+$/,                 'POSITION_EDIT'],         // ← TÁCH
    [/^\/api\/admin\/unit-aliases\/[^/]+$/,              'UNIT_ALIAS_EDIT'],       // ← TÁCH
    [/^\/api\/documents\/[^/]+$/,                 'DOC_EDIT'],
  ],

  DELETE: [
    // ─── NHÓM 1 + 2 (DELETE luôn phải duyệt) ───
    [/^\/api\/admin\/users\/[^/]+$/,                     'USER_DELETE'],
    [/^\/api\/admin\/users\/[^/]+\/roles\/[^/]+$/,       'USER_ROLE_ASSIGN'],      // Gỡ role → duyệt
    [/^\/api\/admin\/users\/[^/]+\/permissions\/[^/]+$/, 'USER_PERMISSION_ASSIGN'],// Gỡ perm → duyệt
    [/^\/api\/admin\/roles\/[^/]+$/,                     'ROLE_DELETE'],
    [/^\/api\/admin\/roles\/[^/]+\/permissions\/[^/]+$/, 'ROLE_PERMISSION_ASSIGN'],// Gỡ perm role → duyệt
    [/^\/api\/admin\/permissions\/[^/]+$/,               'PERMISSION_DELETE'],
    [/^\/api\/admin\/units\/[^/]+$/,                     'UNIT_DELETE'],           // ← TÁCH
    [/^\/api\/admin\/document-types\/[^/]+$/,            'DOCTYPE_DELETE'],        // ← TÁCH
    [/^\/api\/admin\/security-levels\/[^/]+$/,           'SECLEVEL_MANAGE'],
    [/^\/api\/admin\/ranks\/[^/]+$/,                     'RANK_DELETE'],           // ← TÁCH
    [/^\/api\/admin\/positions\/[^/]+$/,                 'POSITION_DELETE'],       // ← TÁCH
    [/^\/api\/admin\/unit-aliases\/[^/]+$/,              'UNIT_ALIAS_DELETE'],     // ← TÁCH
    [/^\/api\/admin\/ip-blocklist\/[^/]+$/,              'AUDIT_VIEW'],
    [/^\/api\/admin\/sessions\/user\/[^/]+$/,            'SESSION_KILL'],
    [/^\/api\/admin\/sessions\/[^/]+$/,                  'SESSION_KILL'],
    [/^\/api\/admin\/protected-permissions\/[^/]+$/,     'ROLE_EDIT'],
    [/^\/api\/documents\/[^/]+\/purge$/,          'DOC_PURGE'],
    [/^\/api\/documents\/[^/]+$/,                 'DOC_DELETE'],
  ],
};

function getAutoRequiredPermission(method, fullPath) {
  const rules = AUTO_PERMISSIONS[method] || [];
  const matched = rules.find(([regex]) => regex.test(fullPath));
  return matched ? matched[1] : null;
}

module.exports = { AUTO_PERMISSIONS, getAutoRequiredPermission };