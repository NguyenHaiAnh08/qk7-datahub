// // route-permission-map.js
// const ROUTE_PERMISSION_MAP = [
//   // 1. Quản lý Users (Khớp với PERM-USR-04, PERM-USR-05... trong SQL)
//   { method: 'DELETE', re: /^\/api\/admin\/users\/[^/]+$/,        perm: 'PERM-USR-04' }, // USER_DELETE
//   { method: 'PUT',    re: /^\/api\/admin\/users\/[^/]+\/credentials$/, perm: 'PERM-USR-05' }, // USER_CREDENTIALS
//   { method: 'POST',   re: /^\/api\/admin\/users\/[^/]+\/roles$/, perm: 'PERM-USR-06' }, // USER_ROLE_ASSIGN
//   { method: 'POST',   re: /^\/api\/admin\/users\/[^/]+\/permissions$/, perm: 'PERM-USR-07' }, // USER_PERMISSION_ASSIGN

//   // 2. Quản lý Documents (Khớp với PERM-DOC-05, PERM-DOC-08)
//   { method: 'DELETE', re: /^\/api\/documents\/[^/]+$/,           perm: 'PERM-DOC-05' }, // DOC_DELETE
//   { method: 'DELETE', re: /^\/api\/documents\/[^/]+\/purge$/,    perm: 'PERM-DOC-08' }, // DOC_PURGE

//   // 3. Quản lý Roles (Khớp với PERM-ROL-04)
//   { method: 'DELETE', re: /^\/api\/admin\/roles\/[^/]+$/,        perm: 'PERM-ROL-04' }, // ROLE_DELETE

//   // 4. Quản lý Permissions (Khớp với PERM-PRM-04)
//   { method: 'DELETE', re: /^\/api\/admin\/permissions\/[^/]+$/,  perm: 'PERM-PRM-04' }, // PERMISSION_DELETE

//   // 5. Quản lý Sessions (Khớp với PERM-SESS-02)
//   { method: 'DELETE', re: /^\/api\/admin\/sessions\/[^/]+$/,     perm: 'PERM-SESS-02' }, // SESSION_KILL
// ];

// function getAutoRequiredPermission(method, fullPath) {
//   const hit = ROUTE_PERMISSION_MAP.find(m => m.method === method && m.re.test(fullPath));
//   return hit ? hit.perm : null;
// }

// module.exports = { getAutoRequiredPermission };