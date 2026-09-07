import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

// Prices are stored as integers (centicoins) so SQLite can varint-encode them.
// A REAL column is always 8 bytes; most of these values fit in 2-4.
const PRICE_SCALE = 100;
const MINUTE_MS = 60_000;

// Retention tiers. Full resolution is kept for FINE_MINUTES, then thinned to one
// sample per ROLLUP_MINUTES bucket, then dropped entirely past COARSE_MINUTES.
const FINE_MINUTES = 48 * 60;
const ROLLUP_MINUTES = 15;
const COARSE_MINUTES = 30 * 24 * 60;
const PRUNE_INTERVAL_MS = 60 * 60_000;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS product(
  pid  INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS point(
  pid   INTEGER NOT NULL,
  at    INTEGER NOT NULL,
  buy   INTEGER NOT NULL,
  sell  INTEGER NOT NULL,
  bvol  INTEGER NOT NULL,
  svol  INTEGER NOT NULL,
  bweek INTEGER NOT NULL,
  sweek INTEGER NOT NULL,
  PRIMARY KEY(pid, at)
) WITHOUT ROWID;
`;

const toStoredPrice = (value) => Math.round((Number(value) || 0) * PRICE_SCALE);
const toStoredCount = (value) => Math.round(Number(value) || 0);

export const createHistoryStore = (dataDir) => {
  mkdirSync(dataDir, { recursive: true });

  const db = new DatabaseSync(join(dataDir, "history.db"));
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA synchronous = NORMAL");
  db.exec(SCHEMA);

  const statements = {
    insertProduct: db.prepare("INSERT OR IGNORE INTO product(name) VALUES(?)"),
    selectProducts: db.prepare("SELECT pid, name FROM product"),
    selectPid: db.prepare("SELECT pid FROM product WHERE name = ?"),
    insertPoint: db.prepare(
      "INSERT OR REPLACE INTO point(pid, at, buy, sell, bvol, svol, bweek, sweek) VALUES(?, ?, ?, ?, ?, ?, ?, ?)",
    ),
    selectHistory: db.prepare(
      `SELECT at, buy, sell, bvol, svol, bweek, sweek
       FROM point WHERE pid = ? ORDER BY at`,
    ),
    // Drops a row when an earlier one exists in the same product+bucket, so the
    // first sample of each bucket survives. ROLLUP_MINUTES is interpolated as a
    // literal on purpose: node:sqlite binds JS numbers as REAL, and `at / ?`
    // would then be float division, putting every row in its own bucket.
    thin: db.prepare(
      `DELETE FROM point
       WHERE at < ?
         AND EXISTS (
           SELECT 1 FROM point AS keep
           WHERE keep.pid = point.pid
             AND keep.at / ${ROLLUP_MINUTES} = point.at / ${ROLLUP_MINUTES}
             AND keep.at < point.at
         )`,
    ),
    drop: db.prepare("DELETE FROM point WHERE at < ?"),
    countPoints: db.prepare("SELECT COUNT(*) AS total FROM point"),
  };

  // Product name -> pid, and the last row written per pid. Holding the previous
  // row in memory is what removes the read-modify-write on every request.
  const pidByName = new Map();
  const lastRowByPid = new Map();
  let lastSnapshotAt = null;
  let lastPrunedAt = 0;

  for (const row of statements.selectProducts.all()) {
    pidByName.set(row.name, row.pid);
  }

  const getPid = (name) => {
    const cached = pidByName.get(name);
    if (cached !== undefined) return cached;

    statements.insertProduct.run(name);
    const pid = statements.selectPid.get(name).pid;
    pidByName.set(name, pid);
    return pid;
  };

  const prune = () => {
    const nowMinutes = Math.floor(Date.now() / MINUTE_MS);
    const fineCutoff = nowMinutes - FINE_MINUTES;
    const coarseCutoff = nowMinutes - COARSE_MINUTES;

    db.exec("BEGIN");
    try {
      statements.thin.run(fineCutoff);
      statements.drop.run(coarseCutoff);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  };

  const recordSnapshot = (body) => {
    if (!body?.success || !body.products) return;

    const snapshotAt = body.lastUpdated ?? Date.now();
    if (snapshotAt === lastSnapshotAt) return;
    lastSnapshotAt = snapshotAt;

    const at = Math.floor(snapshotAt / MINUTE_MS);
    const pending = [];

    for (const [name, product] of Object.entries(body.products)) {
      const quick = product.quick_status ?? {};
      const row = [
        toStoredPrice(quick.buyPrice),
        toStoredPrice(quick.sellPrice),
        toStoredCount(quick.buyVolume),
        toStoredCount(quick.sellVolume),
        toStoredCount(quick.buyMovingWeek),
        toStoredCount(quick.sellMovingWeek),
      ];

      const pid = getPid(name);
      const previous = lastRowByPid.get(pid);
      // About half of all products are unchanged between snapshots; skipping
      // them roughly halves both write volume and stored rows.
      if (previous && previous.every((value, index) => value === row[index])) continue;

      lastRowByPid.set(pid, row);
      pending.push([pid, at, ...row]);
    }

    if (!pending.length) return;

    db.exec("BEGIN");
    try {
      for (const values of pending) statements.insertPoint.run(...values);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }

    if (Date.now() - lastPrunedAt >= PRUNE_INTERVAL_MS) {
      lastPrunedAt = Date.now();
      prune();
    }
  };

  const getProductHistory = (productId) => {
    const pid = pidByName.get(productId);
    if (pid === undefined) return [];

    return statements.selectHistory.all(pid).map((row) => ({
      at: row.at * MINUTE_MS,
      buyPrice: row.buy / PRICE_SCALE,
      sellPrice: row.sell / PRICE_SCALE,
      buyVolume: row.bvol,
      sellVolume: row.svol,
      buyMovingWeek: row.bweek,
      sellMovingWeek: row.sweek,
    }));
  };

  return {
    db,
    statements,
    getPid,
    recordSnapshot,
    getProductHistory,
    prune,
    countPoints: () => statements.countPoints.get().total,
    setLastRow: (pid, row) => lastRowByPid.set(pid, row),
  };
};
