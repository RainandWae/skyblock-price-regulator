// One-time import of data/bazaar-history.json into data/history.db.
// Safe to re-run: points are keyed on (pid, at), so repeats overwrite in place.
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createHistoryStore } from "../src/history.mjs";

const dataDir = process.env.DATA_DIR ?? join(process.cwd(), "data");
const legacyFile = join(dataDir, "bazaar-history.json");

let raw;
try {
  raw = readFileSync(legacyFile, "utf8");
} catch {
  console.log("No data/bazaar-history.json found. Nothing to migrate.");
  process.exit(0);
}

const legacyBytes = statSync(legacyFile).size;
console.log(`Reading ${(legacyBytes / 1e6).toFixed(1)} MB of legacy history...`);

const snapshots = JSON.parse(raw);
const history = createHistoryStore(dataDir);
const { db, statements, getPid, setLastRow } = history;

let written = 0;
let skipped = 0;
const lastRow = new Map();

db.exec("BEGIN");
try {
  for (const snapshot of snapshots) {
    const at = Math.floor((snapshot.at ?? 0) / 60_000);
    for (const [name, product] of Object.entries(snapshot.products ?? {})) {
      const row = [
        Math.round((Number(product.buyPrice) || 0) * 100),
        Math.round((Number(product.sellPrice) || 0) * 100),
        Math.round(Number(product.buyVolume) || 0),
        Math.round(Number(product.sellVolume) || 0),
        Math.round(Number(product.buyMovingWeek) || 0),
        Math.round(Number(product.sellMovingWeek) || 0),
      ];

      const pid = getPid(name);
      const previous = lastRow.get(pid);
      if (previous && previous.every((value, index) => value === row[index])) {
        skipped++;
        continue;
      }

      lastRow.set(pid, row);
      statements.insertPoint.run(pid, at, ...row);
      written++;
    }
  }
  db.exec("COMMIT");
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
}

for (const [pid, row] of lastRow) setLastRow(pid, row);

console.log(`Imported ${written} points, skipped ${skipped} unchanged.`);

history.prune();
// Pruning only frees pages for reuse; VACUUM returns them to the OS. Worth the
// one-off cost here because the import writes far more rows than it retains.
db.exec("VACUUM");
db.exec("PRAGMA wal_checkpoint(TRUNCATE)");

const dbBytes = statSync(join(dataDir, "history.db")).size;
console.log(`Retained ${history.countPoints()} points after pruning.`);
console.log(`history.db is ${(dbBytes / 1e6).toFixed(1)} MB (was ${(legacyBytes / 1e6).toFixed(1)} MB).`);
console.log("You can now delete data/bazaar-history.json.");
