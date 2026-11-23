import mysql from "mysql2/promise";

let pool;

export function getPool() {
  if (!pool) {
    const ca = process.env.DB_SSL_CA?.replace(/\\n/g, "\n");
    pool = mysql.createPool({
      host: process.env.DB_HOST || process.env.TIDB_HOST,
      port: Number(process.env.DB_PORT || process.env.TIDB_PORT || 4000),
      user: process.env.DB_USER || process.env.TIDB_USER,
      password: process.env.DB_PASSWORD || process.env.TIDB_PASSWORD,
      database: process.env.DB_NAME || process.env.TIDB_DATABASE,
      ssl: process.env.DB_SSL === "false" ? undefined : {
        minVersion: "TLSv1.2",
        rejectUnauthorized: true,
        verifyIdentity: true,
        ...(ca ? { ca } : {}),
      },
      waitForConnections: true,
      connectionLimit: 3,
      supportBigNumbers: true,
      bigNumberStrings: true,
      timezone: "Z",
    });
  }
  return pool;
}
