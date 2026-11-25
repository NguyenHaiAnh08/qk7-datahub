// backend/src/unit-scope.js
const { sql, getPool } = require('./db');
const { memo } = require('./memo');

const UNIT_CACHE_TTL_MS = 15 * 1000; // thay đổi đơn vị/vai trò có hiệu lực chậm tối đa 15s

async function resolveUserRoles(user) {
  if (!user?.user_id) return user?.roles || [];
  try {
    const roles = await memo(`roles-all:${user.user_id}`, UNIT_CACHE_TTL_MS, async () => {
      const pool = await getPool();
      const res = await pool.request()
        .input('uid', sql.VarChar(50), user.user_id)
        .query(`SELECT role_id FROM USER_ROLE WHERE user_id = @uid`);
      return res.recordset.map(r => r.role_id);
    });
    return roles.slice();
  } catch (err) {
    console.error('[resolveUserRoles]', err.message);
    return user?.roles || [];
  }
}

async function resolveUserUnitId(user) {
  if (user?.unit_id) return user.unit_id;
  if (!user?.user_id) return null;
  try {
    return await memo(`unitof:${user.user_id}`, UNIT_CACHE_TTL_MS, async () => {
      const pool = await getPool();
      const res = await pool.request()
        .input('uid', sql.VarChar(50), user.user_id)
        .query(`SELECT unit_id FROM [USER] WHERE user_id = @uid`);
      return res.recordset[0]?.unit_id || null;
    });
  } catch (err) {
    console.error('[resolveUserUnitId]', err.message);
    return null;
  }
}

async function getUserUnitScope(user) {
  const roles = await resolveUserRoles(user);

  if (roles.includes('ROL-01') || roles.includes('ROL-04')) {
    return { restricted: false, roles };
  }

  const unitId = await resolveUserUnitId(user);
  if (!unitId) {
    return { restricted: false, no_unit: true, roles };
  }

  const subtree = await getSubtreeUnits(unitId);
  if (subtree.length === 0) {
    return { restricted: false, no_unit: true, roles };
  }

  return {
    restricted: true,
    unit_ids: subtree,
    root_unit: unitId,
    roles,
  };
}

async function getSubtreeUnits(unitId) {
  if (!unitId) return [];
  // Cây đơn vị ít đổi nhưng bị truy vấn đệ quy ở gần như mọi request → cache 15s (trả BẢN SAO: caller có push vào mảng)
  const ids = await memo(`subtree:${unitId}`, UNIT_CACHE_TTL_MS, async () => {
    const pool = await getPool();
    const res = await pool.request()
      .input('unit_id', sql.NVarChar(50), unitId)
      .query(`
        WITH Subtree AS (
          SELECT unit_id FROM UNIT WHERE unit_id = @unit_id
          UNION ALL
          SELECT u.unit_id FROM UNIT u
          JOIN Subtree s ON u.parent_id = s.unit_id
        )
        SELECT unit_id FROM Subtree
      `);
    return res.recordset.map(r => r.unit_id);
  });
  return ids.slice();
}

/**
 * Lấy danh sách unit_id của đơn vị và toàn bộ cây con, đồng thời THỪA KẾ toàn bộ đơn vị cha
 * (dừng lại trước Trường Quân sự Quân khu 7 hoặc Quân khu 7).
 * Phục vụ cơ chế: đơn vị con thừa kế tài liệu từ đơn vị cha (VD: CNTT thừa kế từ TM-HC).
 */
async function getUnitWithInheritedUnits(unitId) {
  if (!unitId) return [];
  const pool = await getPool();
  const subtreeRes = await pool.request()
    .input('unit_id', sql.NVarChar(50), unitId)
    .query(`
      WITH Subtree AS (
        SELECT unit_id FROM UNIT WHERE unit_id = @unit_id
        UNION ALL
        SELECT u.unit_id FROM UNIT u
        JOIN Subtree s ON u.parent_id = s.unit_id
      )
      SELECT unit_id FROM Subtree
    `);
  const unitIds = new Set(subtreeRes.recordset.map(r => r.unit_id));

  let curId = unitId;
  let guard = 0;
  while (curId && guard < 10) {
    const parentRes = await pool.request()
      .input('uid', sql.NVarChar(50), curId)
      .query('SELECT parent_id FROM UNIT WHERE unit_id = @uid');
    const pId = parentRes.recordset[0]?.parent_id;
    if (!pId || pId === 'TQS-QK7' || pId === 'TQS' || pId === 'U-TQS' || pId === 'QK7') {
      break;
    }
    unitIds.add(pId);
    curId = pId;
    guard++;
  }
  return Array.from(unitIds);
}

async function getRootUnitId() {
  const pool = await getPool();
  const res = await pool.request().query(
    `SELECT TOP 1 unit_id FROM UNIT WHERE parent_id IS NULL ORDER BY CASE WHEN unit_id = 'QK7' THEN 0 ELSE 1 END, unit_id`
  );
  return res.recordset[0]?.unit_id || null;
}

module.exports = {
  getUserUnitScope,
  getSubtreeUnits,
  getUnitWithInheritedUnits,
  getRootUnitId,
  resolveUserUnitId,
  resolveUserRoles,
};