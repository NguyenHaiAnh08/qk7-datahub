// backend/src/unit-scope.js
const { sql, getPool } = require('./db');

async function resolveUserRoles(user) {
  if (!user?.user_id) return user?.roles || [];
  try {
    const pool = await getPool();
    const res = await pool.request()
      .input('uid', sql.VarChar(50), user.user_id)
      .query(`SELECT role_id FROM USER_ROLE WHERE user_id = @uid`);
    return res.recordset.map(r => r.role_id);
  } catch (err) {
    console.error('[resolveUserRoles]', err.message);
    return user?.roles || [];
  }
}

async function resolveUserUnitId(user) {
  if (user?.unit_id) return user.unit_id;
  if (!user?.user_id) return null;
  try {
    const pool = await getPool();
    const res = await pool.request()
      .input('uid', sql.VarChar(50), user.user_id)
      .query(`SELECT unit_id FROM [USER] WHERE user_id = @uid`);
    return res.recordset[0]?.unit_id || null;
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
  const pool = await getPool();
  const res = await pool.request()
    .input('unit_id', sql.VarChar(50), unitId)
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
}

async function getRootUnitId() {
  const pool = await getPool();
  const res = await pool.request().query(
    `SELECT TOP 1 unit_id FROM UNIT WHERE parent_id IS NULL ORDER BY unit_id`
  );
  return res.recordset[0]?.unit_id || null;
}

module.exports = {
  getUserUnitScope,
  getSubtreeUnits,
  getRootUnitId,
  resolveUserUnitId,
  resolveUserRoles,
};