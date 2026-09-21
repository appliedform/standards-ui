import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs, { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { assertOutputDirectories, publishOutputs } from "../scripts/build-output.mjs";

const root = resolve(import.meta.dirname, "..");

function withCheckout(run) {
  const temporary = mkdtempSync(join(tmpdir(), "standards-build-path-"));
  const checkout = join(temporary, "checkout with spaces $(touch shell-marker)");
  try {
    mkdirSync(join(checkout, "scripts"), { recursive: true });
    for (const file of ["scripts/build.mjs", "scripts/build-output.mjs", "scripts/support-manifest.mjs", "support-manifest.json", "tsconfig.base.json"]) {
      cpSync(join(root, file), join(checkout, file));
    }
    for (const name of ["core", "instrument"]) {
      const destination = join(checkout, "packages", name);
      mkdirSync(destination, { recursive: true });
      for (const file of ["package.json", "tsconfig.json", "src"]) cpSync(join(root, "packages", name, file), join(destination, file), { recursive: true });
    }
    symlinkSync(join(root, "node_modules"), join(checkout, "node_modules"), process.platform === "win32" ? "junction" : "dir");
    return run(checkout);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

test("build treats spaces and shell metacharacters in checkout paths as literal data", { timeout: 60_000 }, () => {
  withCheckout((checkout) => {
    const output = execFileSync(process.execPath, ["scripts/build.mjs"], {
      cwd: checkout, encoding: "utf8", timeout: 45_000,
      env: { ...process.env, PATH: "", npm_config_offline: "true" }, stdio: ["ignore", "pipe", "pipe"],
    });
    assert.match(output, /2 package\(s\) built/);
    assert.equal(existsSync(join(checkout, "shell-marker")), false, "Checkout path executed as shell code");
    for (const name of ["core", "instrument"]) {
      assert.ok(readFileSync(join(checkout, "packages", name, "dist/index.js")).length > 0);
      assert.ok(readFileSync(join(checkout, "packages", name, "dist/index.d.ts")).length > 0);
    }
    assert.equal(readFileSync(join(checkout, "packages/instrument/dist/fonts/PublicSans-400.woff2")).subarray(0, 4).toString(), "wOF2");
    assert.equal(existsSync(join(checkout, ".standards-build.lock")), false);
    assert.deepEqual(readdirSync(checkout).filter((name) => name.startsWith(".standards-build-")), []);
  });
});

test("a failed compiler preserves both previous packages and successful retry replaces stale files", { timeout: 60_000 }, () => {
  withCheckout((checkout) => {
    const run = () => spawnSync(process.execPath, ["scripts/build.mjs"], { cwd: checkout, encoding: "utf8", timeout: 30_000 });
    assert.equal(run().status, 0);
    const before = new Map(["core", "instrument"].map((name) => [name,
      readFileSync(join(checkout, "packages", name, "dist/index.js"), "utf8")]));
    const core = join(checkout, "packages/core/src/index.ts");
    const instrument = join(checkout, "packages/instrument/src/index.ts");
    const original = readFileSync(instrument, "utf8");
    writeFileSync(core, readFileSync(core, "utf8") + '\nexport type FreshBuildType = { checked: true };\nexport const stagedOnly = true;\n');
    writeFileSync(instrument, original + '\nconst invalid: number = "not a number";\n');
    const failed = run();
    assert.notEqual(failed.status, 0);
    assert.match(failed.stdout, /not assignable to type 'number'/);
    for (const [name, bytes] of before) assert.equal(readFileSync(join(checkout, "packages", name, "dist/index.js"), "utf8"), bytes);
    assert.equal(existsSync(join(checkout, ".standards-build.lock")), false);
    assert.deepEqual(readdirSync(checkout).filter((name) => name.startsWith(".standards-build-")), []);
    const stale = join(checkout, "packages/instrument/dist/stale.js");
    writeFileSync(stale, "old generated file");
    // This type is absent from the old dist: the retry must resolve the freshly
    // staged core declarations, not accidentally use last build's declarations.
    writeFileSync(instrument, original + '\nexport type { FreshBuildType } from "@standards/core";\n');
    assert.equal(run().status, 0);
    assert.match(readFileSync(join(checkout, "packages/instrument/dist/index.d.ts"), "utf8"), /FreshBuildType/);
    assert.equal(existsSync(stale), false);
  });
});

test("an existing build lock is retained and stops a competing build", () => {
  withCheckout((checkout) => {
    const lock = join(checkout, ".standards-build.lock");
    mkdirSync(lock);
    writeFileSync(join(lock, "owner"), "another build");
    const result = spawnSync(process.execPath, ["scripts/build.mjs"], { cwd: checkout, encoding: "utf8", timeout: 10_000 });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Another build or an interrupted build/);
    assert.equal(readFileSync(join(lock, "owner"), "utf8"), "another build");
    assert.equal(existsSync(join(checkout, "packages/core/dist")), false);
  });
});

function withOutputs(existing, run) {
  const temporary = mkdtempSync(join(tmpdir(), "standards-publish-check-"));
  const packages = join(temporary, "packages"), stage = join(temporary, "stage");
  try {
    for (const pack of ["core", "instrument"]) {
      mkdirSync(join(packages, pack), { recursive: true });
      mkdirSync(join(stage, pack), { recursive: true });
      writeFileSync(join(stage, pack, "index.js"), `new ${pack}`);
      if (existing) {
        mkdirSync(join(packages, pack, "dist"));
        writeFileSync(join(packages, pack, "dist/index.js"), `old ${pack}`);
      }
    }
    return run(packages, stage);
  } finally {
    mock.restoreAll();
    rmSync(temporary, { recursive: true, force: true });
  }
}

for (const existing of [true, false]) {
  test(`output promotion rolls back a failed second move (${existing ? "previous outputs" : "first build"})`, () => {
    withOutputs(existing, (packages, stage) => {
      const rename = fs.renameSync;
      mock.method(fs, "renameSync", (from, to) => {
        if (from === join(stage, "instrument")) throw new Error("simulated destination failure");
        return rename(from, to);
      });
      assert.throws(() => publishOutputs(packages, ["core", "instrument"], stage), /simulated destination failure/);
      for (const name of ["core", "instrument"]) {
        const target = join(packages, name, "dist");
        if (existing) assert.equal(readFileSync(join(target, "index.js"), "utf8"), `old ${name}`);
        else assert.equal(existsSync(target), false);
      }
    });
  });
}

test("incomplete rollback preserves its backup and reports recovery location", () => {
  withOutputs(true, (packages, stage) => {
    const rename = fs.renameSync;
    mock.method(fs, "renameSync", (from, to) => {
      if (from === join(stage, "instrument") || from === join(stage, "previous/core")) throw new Error("simulated write failure");
      return rename(from, to);
    });
    assert.throws(() => publishOutputs(packages, ["core", "instrument"], stage), (error) => {
      assert.equal(error.preserveStage, true);
      assert.match(error.message, /Build rollback incomplete/);
      assert.ok(error.message.includes(stage));
      return true;
    });
    assert.equal(readFileSync(join(stage, "previous/core/index.js"), "utf8"), "old core");
    assert.equal(readFileSync(join(packages, "instrument/dist/index.js"), "utf8"), "old instrument");
  });
});

test("output validation refuses files and symlinks without touching their targets", () => {
  withOutputs(false, (packages, stage) => {
    const target = join(packages, "core/dist");
    writeFileSync(target, "not a directory");
    assert.throws(() => assertOutputDirectories(packages, ["core"]), /refusing/);
    assert.equal(readFileSync(target, "utf8"), "not a directory");
    rmSync(target);
    symlinkSync(join(stage, "core"), target, process.platform === "win32" ? "junction" : "dir");
    assert.throws(() => assertOutputDirectories(packages, ["core"]), /refusing/);
    assert.equal(readFileSync(join(stage, "core/index.js"), "utf8"), "new core");
  });
});
