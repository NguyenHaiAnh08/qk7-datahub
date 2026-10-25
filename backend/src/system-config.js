/**
 * system-config.js — Runtime config (overrides process.env)
 * Load 1 lần khi khởi động, cache in-memory.
 */

const cache = new Map();

module.exports = function createConfigModule({ sql, getPool }) {
  async function loadAll() {
    try {
      const pool = await getPool();
      const r = await pool.request().query(`SELECT config_key, config_value, data_type FROM SYSTEM_CONFIG`);
      cache.clear();
      for (const row of r.recordset) {
        let val = row.config_value;
        if (row.data_type === 'int') val = parseInt(val, 10);
        else if (row.data_type === 'bool') val = val === '1' || val === 'true';
        else if (row.data_type === 'json') {
          try { val = JSON.parse(val); } catch { /* keep string */ }
        }
        cache.set(row.config_key, val);
      }
      console.log(`[config] Loaded ${cache.size} keys from SYSTEM_CONFIG`);
    } catch (err) {
      console.warn('[config] Cannot load SYSTEM_CONFIG:', err.message);
    }
  }

  function get(key, fallback) {
    if (cache.has(key)) return cache.get(key);
    return fallback;
  }

  function reload() { return loadAll(); }

  return { loadAll, get, reload };
};