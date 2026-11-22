const sql = require('mssql');
const fs = require('node:fs');
const path = require('node:path');
require('@nestjs/config').ConfigModule.forRoot({ envFilePath: path.join(__dirname, '../.env') });
async function main() {
 if (!process.env.DB_PASSWORD) throw Error('Missing DB_PASSWORD. Configure reporting-service/.env or the DB_PASSWORD environment variable');
 const database = process.env.DB_NAME || 'reporting_db';
 if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(database)) throw Error('Invalid DB_NAME');
 if (['product_db', 'order_db', 'auth_db', 'master', 'model', 'msdb', 'tempdb'].includes(database.toLowerCase())) throw Error('Reporting must use its own database');
 const config = { server: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 1433), user: process.env.DB_USER || 'sa', password: process.env.DB_PASSWORD, options: { encrypt: false, trustServerCertificate: true }, connectionTimeout: 5000 };
 const master = await new sql.ConnectionPool({ ...config, database: 'master' }).connect();
 try {
  const exists = await master.request().input('name', sql.NVarChar, database).query('SELECT DB_ID(@name) AS id');
  if (exists.recordset[0].id === null) await master.request().batch(`CREATE DATABASE [${database}]`);
 } finally { await master.close(); }
 const pool = await new sql.ConnectionPool({ ...config, database }).connect();
 try {
  await pool.request().batch(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  console.log(`Reporting schema ready: ${database}`);
 } finally { await pool.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
