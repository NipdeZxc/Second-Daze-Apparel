// One-time script that creates the first Admin account.
// Usage (from the project root):
//   node --env-file=.env.local scripts/create-admin.js <username> "<Full Name>"
// .env.local must define DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME and is never committed.
import readline from "node:readline";
import { getPool } from "../api/_db.js";
import { assertStrongPassword, hashPassword } from "../api/_lib/password.js";

const [username, fullName] = process.argv.slice(2);
if (!username || !fullName) {
  console.error('Usage: node --env-file=.env.local scripts/create-admin.js <username> "<Full Name>"');
  process.exit(1);
}

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (text) => {
      if (text.includes(question)) rl.output.write(text);
    };
    rl.question(question, (answer) => {
      rl.output.write("\n");
      rl.close();
      resolve(answer);
    });
  });
}

const db = getPool();
try {
  const [admins] = await db.query(
    `SELECT 1 FROM users u JOIN roles r ON r.role_id = u.role_id WHERE r.role_name = 'Admin' LIMIT 1`
  );
  if (admins.length) throw new Error("An Admin account already exists. Use the app to manage accounts.");

  const password = await askHidden("Choose a password: ");
  if (password !== (await askHidden("Repeat the password: "))) throw new Error("Passwords do not match.");
  assertStrongPassword(password);

  await db.query(
    `INSERT INTO users (role_id, full_name, username, password_hash, must_change_password, account_status,
                        approved_at, created_at, updated_at)
     VALUES ((SELECT role_id FROM roles WHERE role_name = 'Admin'), ?, ?, ?, 0, 'Active', ?, ?, ?)`,
    [fullName, username, await hashPassword(password), new Date(), new Date(), new Date()]
  );
  console.log(`Admin "${username}" created.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
