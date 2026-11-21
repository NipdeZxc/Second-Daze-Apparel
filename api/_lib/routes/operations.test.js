import assert from "node:assert/strict";
import test from "node:test";
import { runOperationsMaintenance } from "./operations.js";

test("maintenance job rejects requests without the cron secret", async () => {
  process.env.CRON_SECRET = "secret";
  await assert.rejects(
    runOperationsMaintenance({ headers: {} }, {}),
    (error) => error.status === 401
  );
  delete process.env.CRON_SECRET;
});
