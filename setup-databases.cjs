
const fs = require('node:fs');
const path = require('node:path');

// Đọc cấu hình từ file .env nếu có
const envPath = path.join(__dirname, '.env');

if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);

  for (const line of lines) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*?)\s*$/);
    if (match && !Object.hasOwn(process.env, match[1])) {
      process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
}

(async () => {
  if (!process.env.DB_PASSWORD) {
    throw new Error('Missing DB_PASSWORD. Please configure it in .env');
  }

  const sql = require('./order-management-service/node_modules/mssql');

  const pool = await sql.connect({
    server: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 1433),
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD,
    options: {
      encrypt: false,
      trustServerCertificate: true
    },
    connectionTimeout: 5000
  });

  try {
    const source = fs.readFileSync(
      path.join(__dirname, 'setup-databases.sql'),
      'utf8'
    );

    let database = 'master';

    for (const batch of source.split(/^GO\s*$/mi)) {
      const use = batch.match(/USE (\w+);/i);
      if (use) database = use[1];

      if (batch.trim()) {
        await pool.request().batch(`USE [${database}];\n${batch}`);
      }
    }

    console.log('Database schema ready');
  } finally {
    await pool.close();
  }
})().catch(error => {
  console.error(error.code || 'ERROR', error.message);
  process.exitCode = 1;
});