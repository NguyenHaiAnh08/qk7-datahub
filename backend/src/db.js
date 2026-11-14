// src/db.js
const sql = require('mssql');
const path = require('path');
require('dotenv').config({
  path: [
    path.join(__dirname, '..', '..', '.env'),   // root
    path.join(__dirname, '..', '.env'),         // backend/.env
  ],
});

const config = {
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server:   (process.env.DB_SERVER === 'localhost' ? '127.0.0.1' : process.env.DB_SERVER) || '127.0.0.1',
  database: process.env.DB_DATABASE,
  port:     parseInt(process.env.DB_PORT || '1433', 10),
  options: {
    encrypt:                process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
    enableArithAbort:       true,
    useUTC:                 false,
    cancelTimeout:          15000, // Tăng thời gian chờ hủy từ 5s lên 15s để chống rớt socket khi SQL Server bận
  },
  pool: { max: 25, min: 2, idleTimeoutMillis: 30000 },
  connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '30000', 10),
  requestTimeout:    parseInt(process.env.DB_REQUEST_TIMEOUT || '30000', 10)
};

let poolPromise = null;

async function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config)
      .connect()
      .then(pool => {
        console.log(`[DB] OK ket noi ${config.server}:${config.port}/${config.database}`);
        pool.on('error', err => {
          console.error('[DB] Pool error:', err.message);
          poolPromise = null;
        });
        return pool;
      })
      .catch(err => {
        console.error('[DB] Loi ket noi:', err.message);
        poolPromise = null;
        throw err;
      });
  }
  return poolPromise;
}

async function closePool() {
  if (poolPromise) {
    try { const p = await poolPromise; await p.close(); } catch (_) {}
    finally { poolPromise = null; }
  }
}

async function testConnection() {
  try {
    const pool = await getPool();
    const r = await pool.request().query(
      `SELECT DB_NAME() AS db, SUSER_SNAME() AS login_name`
    );
    const row = r.recordset[0];
    console.log(`     Database : ${row.db}`);
    console.log(`     Login    : ${row.login_name}`);
    return true;
  } catch (err) {
    console.error('[DB] Test that bai:', err.message);
    return false;
  }
}

module.exports = { sql, getPool, closePool, testConnection };