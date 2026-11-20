import { getPool } from "./_db.js";

export default async function handler(req, res) {
  try {
    const [rows] = await getPool().query("SELECT COUNT(*) AS roles FROM roles");
    res.status(200).json({ ok: true, database: "connected", roles: rows[0].roles });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.code || "DB_ERROR" });
  }
}
