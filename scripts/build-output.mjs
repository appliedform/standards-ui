// Publish already-built package directories only after every compiler succeeds.
// This is process-level rollback, not a crash-safe filesystem transaction.
import fs from "node:fs";
import { join } from "node:path";

export function assertOutputDirectories(packagesDir, packs) {
  for (const pack of packs) {
    const target = join(packagesDir, pack, "dist");
    let stat;
    try { stat = fs.lstatSync(target); }
    catch (error) { if (error.code === "ENOENT") continue; throw error; }
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`${pack}: refusing non-directory or symbolic-link dist`);
  }
}

export function publishOutputs(packagesDir, packs, stage) {
  assertOutputDirectories(packagesDir, packs);
  const backup = join(stage, "previous");
  fs.mkdirSync(backup);
  const moved = [];
  try {
    for (const pack of packs) {
      const target = join(packagesDir, pack, "dist");
      const previous = join(backup, pack);
      const record = { target, previous, backedUp: false, installed: false };
      moved.push(record);
      if (fs.existsSync(target)) { fs.renameSync(target, previous); record.backedUp = true; }
      fs.renameSync(join(stage, pack), target);
      record.installed = true;
    }
  } catch (error) {
    const rollbackErrors = [];
    for (const record of moved.reverse()) {
      try {
        if (record.installed) fs.rmSync(record.target, { recursive: true });
        if (record.backedUp) fs.renameSync(record.previous, record.target);
      } catch (rollbackError) { rollbackErrors.push(rollbackError); }
    }
    if (rollbackErrors.length) {
      const failure = new AggregateError([error, ...rollbackErrors], `Build rollback incomplete; retained recovery files at ${stage}`);
      failure.preserveStage = true;
      throw failure;
    }
    throw error;
  }
}
