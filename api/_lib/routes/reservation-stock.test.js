import assert from "node:assert/strict";
import test from "node:test";
import { releaseReservationStock } from "./data.js";

function connection({ holds = [], reserved = 0 } = {}) {
  const writes = [];
  return {
    writes,
    async query(sql, params) {
      if (sql.includes("FROM reservation_items")) return [[{ product_id: 25, quantity: "5" }]];
      if (sql.includes("FROM stock_movements")) return [holds];
      if (sql.includes("FROM products")) return [[{ product_id: 25, reserved_quantity: reserved }]];
      writes.push({ sql, params });
      return [{ affectedRows: 1 }];
    },
  };
}

test("historical active reservation without a stock hold leaves the snapshot unchanged and records why", async () => {
  const conn = connection();
  const released = await releaseReservationStock(conn, 12, null, "Reservation expired");

  assert.equal(released, false);
  assert.equal(conn.writes.length, 1);
  assert.match(conn.writes[0].sql, /reservation_without_hold/);
  assert.deepEqual(conn.writes[0].params.slice(0, 3), [
    null, 12, "Reservation expired: no recorded stock hold; inventory unchanged",
  ]);
});

test("workflow reservation releases only its recorded hold and writes the stock movement", async () => {
  const conn = connection({ holds: [{ product_id: 25, held_quantity: "5" }], reserved: 8 });
  const released = await releaseReservationStock(conn, 12, 1, "Reservation cancelled");

  assert.equal(released, true);
  assert.match(conn.writes[0].sql, /UPDATE products/);
  assert.deepEqual(conn.writes[0].params, [5, 5, 25]);
  assert.match(conn.writes[1].sql, /INSERT INTO stock_movements/);
  assert.deepEqual(conn.writes[1].params, [
    25, "Reservation Release", 5, "Reservation", 12, "Reservation cancelled", 1,
  ]);
});

test("an insufficient reserved balance rejects release before unsigned subtraction", async () => {
  const conn = connection({ holds: [{ product_id: 25, held_quantity: "5" }], reserved: 0 });

  await assert.rejects(
    releaseReservationStock(conn, 12, null, "Reservation expired"),
    (error) => error.status === 409 && /requires 5 reserved units/.test(error.message)
  );
  assert.equal(conn.writes.length, 0);
});

test("mismatched or previously released holds cannot release stock again", async () => {
  for (const quantity of ["3", "0"]) {
    const conn = connection({ holds: [{ product_id: 25, held_quantity: quantity }], reserved: 10 });
    await assert.rejects(
      releaseReservationStock(conn, 12, null, "Reservation expired"),
      (error) => error.status === 409 && /inconsistent stock hold/.test(error.message)
    );
    assert.equal(conn.writes.length, 0);
  }
});
