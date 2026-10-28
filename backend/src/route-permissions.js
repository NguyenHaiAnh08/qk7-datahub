// backend/src/route-permissions.js
// ═══════════════════════════════════════════════════════════════════════════
// AUTO PERMISSIONS MAP — Phân loại 3 nhóm theo spec Approval Workflow:
//
//   🔴 NHÓM 1 (tuyệt đối) — Luôn phải duyệt khi bị admin protect:
//       USER_CREATE (user cấp cao), USER_ROLE_ASSIGN, USER_PERMISSION_ASSIGN,
//       USER_DELETE, USER_CREDENTIALS (reset password),
//       ROLE_CREATE/EDIT/DELETE, ROLE_PERMISSION_ASSIGN,
//       PERMISSION_CREATE/EDIT/DELETE,
//       SECLEVEL_MANAGE (đổi mức bảo mật),
//       SESSION_KILL (force logout user cao cấp)
//
//   🟡 NHÓM 2 (quan trọng) — CREATE tự do, EDIT/DELETE phải duyệt:
//       UNIT_CREATE (tự do) / UNIT_EDIT / UNIT_DELETE
//       DOCTYPE_CREATE / DOCTYPE_EDIT / DOCTYPE_DELETE
//       RANK_CREATE / RANK_EDIT / RANK_DELETE
//       POSITION_CREATE / POSITION_EDIT / POSITION_DELETE
//       UNIT_ALIAS_CREATE / UNIT_ALIAS_EDIT / UNIT_ALIAS_DELETE
//
//   🟢 NHÓM 3 (làm ngay) — Không qua interceptor (chỉ cần permission cơ bản):
//       DOC_VIEW, DOC_UPLOAD (trừ Tuyệt mật — xử lý runtime),
//       AUDIT_VIEW (xem log), SYSTEM_STATS_VIEW (xem dashboard)
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
  ],

  POST: [
    // ─── NHÓM 1: Tuyệt đối (luôn phải duyệt khi bị protect) ───
    [/^\/api\/admin\/users$/,                            'USER_CREATE'],
    [/^\/api\/admin\/users\/[^/]+\/roles$/,              'USER_ROLE_ASSIGN'],
    [/^\/api\/admin\/users\/[^/]+\/permissions$/,        'USER_PERMISSION_ASSIGN'],
    [/^\/api\/admin\/users\/[^/]+\/unlock$/,             'USER_EDIT'],
    [/^\/api\/admin\/roles$/,                            'ROLE_CREATE'],
    [/^\/api\/admin\/roles\/[^/]+\/permissions$/,        'ROLE_PERMISSION_ASSIGN'],
    [/^\/api\/admin\/permissions$/,                      'PERMISSION_CREATE'],
    [/^\/api\/admin\/security-levels$/,                  'SECLEVEL_MANAGE'],
    [/^\/api\/admin\/approval-requests\/[^/]+\/(approve|reject|mark-executed)$/, 'AUDIT_VIEW'],
    [/^\/api\/admin\/protected-permissions\/[^/]+$/,     'ROLE_EDIT'],

    // ─── NHÓM 2: Quan trọng — CREATE tự do (KHÔNG qua interceptor) ───
    // Các route dưới đây vẫn map permission nhưng permission này KHÔNG nên
    // đưa vào PROTECTED_PERMISSION → IT gọi được ngay, không chờ duyệt
    [/^\/api\/admin\/units$/,                            'UNIT_CREATE'],
    [/^\/api\/admin\/document-types$/,                   'DOCTYPE_CREATE'],
    [/^\/api\/admin\/ranks$/,                            'RANK_CREATE'],
    [/^\/api\/admin\/positions$/,                        'POSITION_CREATE'],
    [/^\/api\/admin\/unit-aliases$/,                     'UNIT_ALIAS_CREATE'],
  ],

  PUT: [
    // ─── NHÓM 1 + 2: EDIT luôn phải duyệt khi bị protect ───
    [/^\/api\/admin\/users\/[^/]+$/,                     'USER_EDIT'],
    [/^\/api\/admin\/users\/[^/]+\/credentials$/,        'USER_CREDENTIALS'],
    [/^\/api\/admin\/roles\/[^/]+$/,                     'ROLE_EDIT'],
    [/^\/api\/admin\/permissions\/[^/]+$/,               'PERMISSION_EDIT'],
    [/^\/api\/admin\/units\/[^/]+$/,                     'UNIT_EDIT'],
    [/^\/api\/admin\/document-types\/[^/]+$/,            'DOCTYPE_EDIT'],
    [/^\/api\/admin\/security-levels\/[^/]+$/,           'SECLEVEL_MANAGE'],
    [/^\/api\/admin\/ranks\/[^/]+$/,                     'RANK_EDIT'],
    [/^\/api\/admin\/positions\/[^/]+$/,                 'POSITION_EDIT'],
    [/^\/api\/admin\/unit-aliases\/[^/]+$/,              'UNIT_ALIAS_EDIT'],
  ],

  DELETE: [
    // ─── NHÓM 1 + 2: DELETE luôn phải duyệt khi bị protect ───
    [/^\/api\/admin\/users\/[^/]+$/,                     'USER_DELETE'],
    [/^\/api\/admin\/users\/[^/]+\/roles\/[^/]+$/,       'USER_ROLE_ASSIGN'],
    [/^\/api\/admin\/users\/[^/]+\/permissions\/[^/]+$/, 'USER_PERMISSION_ASSIGN'],
    [/^\/api\/admin\/roles\/[^/]+$/,                     'ROLE_DELETE'],
    [/^\/api\/admin\/roles\/[^/]+\/permissions\/[^/]+$/, 'ROLE_PERMISSION_ASSIGN'],
    [/^\/api\/admin\/permissions\/[^/]+$/,               'PERMISSION_DELETE'],
    [/^\/api\/admin\/units\/[^/]+$/,                     'UNIT_DELETE'],
    [/^\/api\/admin\/document-types\/[^/]+$/,            'DOCTYPE_DELETE'],
    [/^\/api\/admin\/security-levels\/[^/]+$/,           'SECLEVEL_MANAGE'],
    [/^\/api\/admin\/ranks\/[^/]+$/,                     'RANK_DELETE'],
    [/^\/api\/admin\/positions\/[^/]+$/,                 'POSITION_DELETE'],
    [/^\/api\/admin\/unit-aliases\/[^/]+$/,              'UNIT_ALIAS_DELETE'],
    [/^\/api\/admin\/ip-blocklist\/[^/]+$/,              'AUDIT_VIEW'],
    [/^\/api\/admin\/sessions\/user\/[^/]+$/,            'SESSION_KILL'],
    [/^\/api\/admin\/sessions\/[^/]+$/,                  'SESSION_KILL'],
    [/^\/api\/admin\/protected-permissions\/[^/]+$/,     'ROLE_EDIT'],
  ],
};

/**
 * Trả về permission code cần cho (method, path), hoặc null nếu route không match.
 * Được gọi bởi:
 *   1. `requireAdminPanelAccess` trong admin-routes.js — để check quyền
 *   2. `approval-workflow.js` — để check xem permission có nằm trong PROTECTED_PERMISSION không
 */
function getAutoRequiredPermission(method, fullPath) {
  const rules = AUTO_PERMISSIONS[method] || [];
  const matched = rules.find(([regex]) => regex.test(fullPath));
  return matched ? matched[1] : null;
}

module.exports = {
  AUTO_PERMISSIONS,
  getAutoRequiredPermission,
};