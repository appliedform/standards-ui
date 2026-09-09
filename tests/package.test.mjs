import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

function command(bin, args, cwd) {
  return execFileSync(bin, args, {
    cwd, encoding: "utf8", timeout: 60_000,
    env: { ...process.env, npm_config_offline: "true", npm_config_audit: "false", npm_config_fund: "false" },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function pack(directory, destination, cwd) {
  const result = JSON.parse(command(npm, [
    "pack", directory, "--json", "--ignore-scripts", "--offline", "--pack-destination", destination,
  ], cwd));
  assert.equal(result.length, 1);
  return { ...result[0], tarball: join(destination, result[0].filename) };
}

test("public tarballs contain documentation, licences and contracts, and work in an offline consumer", { timeout: 120_000 }, () => {
  const temporary = mkdtempSync(join(tmpdir(), "standards-package-check-"));
  try {
    const archives = join(temporary, "archives");
    const consumer = join(temporary, "consumer");
    mkdirSync(archives);
    mkdirSync(consumer);
    const core = pack(join(root, "packages/core"), archives, temporary);
    const instrument = pack(join(root, "packages/instrument"), archives, temporary);
    const coreFiles = core.files.map((file) => file.path).sort();
    assert.deepEqual(coreFiles, ["LICENSE", "README.md", "dist/index.d.ts", "dist/index.js", "package.json"]);

    const required = ["LICENSE", "LICENSE-INSTRUMENT", "NOTICE", "README.md", "tokens.json", "archetypes.json", "package.json"];
    const instrumentFiles = instrument.files.map((file) => file.path);
    for (const file of [...required, "dist/index.js", "dist/index.d.ts", "dist/styles/tokens.css"]) {
      assert.ok(instrumentFiles.includes(file), `Instrument is missing ${file}`);
    }
    for (const file of instrumentFiles) {
      assert.ok(required.includes(file) || /^dist\/(?:[\w/-]+\.d\.ts|index\.js|styles\/tokens\.css)$/.test(file),
        `Unexpected public package file: ${file}`);
    }
    for (const name of ["core", "instrument"]) {
      assert.equal(readFileSync(join(root, "packages", name, "LICENSE"), "utf8"),
        readFileSync(join(root, "LICENSE"), "utf8"));
    }

    // Repack already installed peers/types into local fixtures. This avoids both
    // registry access and reliance on the user's npm cache or workspace links.
    const dependencies = {
      "@standards/core": `file:${core.tarball}`,
      "@standards/instrument": `file:${instrument.tarball}`,
    };
    for (const name of ["react", "@types/react", "csstype"]) {
      const directory = dirname(require.resolve(`${name}/package.json`));
      const fixture = pack(directory, archives, temporary);
      dependencies[name] = `file:${fixture.tarball}`;
    }
    writeFileSync(join(consumer, "package.json"), JSON.stringify({
      name: "standards-package-consumer", private: true, type: "module", dependencies,
    }, null, 2));
    command(npm, ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund"], consumer);

    const installed = join(consumer, "node_modules/@standards");
    for (const file of ["tokens.json", "archetypes.json"]) {
      assert.equal(readFileSync(join(installed, "instrument", file), "utf8"),
        readFileSync(join(root, "packages/instrument", file), "utf8"));
    }
    const coreManifest = JSON.parse(readFileSync(join(installed, "core/package.json"), "utf8"));
    const instrumentManifest = JSON.parse(readFileSync(join(installed, "instrument/package.json"), "utf8"));
    assert.equal(coreManifest.license, "MIT");
    assert.equal(coreManifest.sideEffects, false);
    assert.equal(coreManifest.peerDependencies.react, ">=18");
    assert.equal(instrumentManifest.license, "MIT AND CC-BY-4.0");
    assert.deepEqual(instrumentManifest.sideEffects, ["**/*.css"]);
    assert.equal(instrumentManifest.peerDependencies.react, ">=18");
    assert.equal(instrumentManifest.dependencies["@standards/core"], coreManifest.version);
    for (const [name, manifest] of [["core", coreManifest], ["instrument", instrumentManifest]]) {
      assert.equal(manifest.repository.directory, `packages/${name}`);
      assert.equal(manifest.repository.url, "git+https://github.com/appliedform/standards-ui.git");
      assert.equal(manifest.exports["."].types, "./dist/index.d.ts");
      assert.equal(manifest.exports["."].import, "./dist/index.js");
    }

    writeFileSync(join(consumer, "check.mjs"), `
      import assert from 'node:assert/strict';
      import { readFileSync, realpathSync } from 'node:fs';
      import { createRequire } from 'node:module';
      import { dirname, join, sep } from 'node:path';
      import { fileURLToPath } from 'node:url';
      import { JOBS, defineMove } from '@standards/core';
      import * as instrument from '@standards/instrument';
      const require = createRequire(import.meta.url);
      const here = dirname(fileURLToPath(import.meta.url));
      for (const name of ['@standards/core', '@standards/instrument', 'react']) {
        assert.ok(realpathSync(require.resolve(name)).startsWith(join(realpathSync(here), 'node_modules') + sep));
      }
      assert.equal(JOBS.C, 'Change');
      assert.equal(typeof defineMove, 'function');
      const tokens = JSON.parse(readFileSync(require.resolve('@standards/instrument/tokens.json'), 'utf8'));
      const archetypes = JSON.parse(readFileSync(require.resolve('@standards/instrument/archetypes.json'), 'utf8'));
      assert.equal(tokens.system, 'Instrument');
      const moves = new Map(Object.values(instrument).filter((value) => value?.meta)
        .map((value) => [value.meta.move, value.meta]));
      for (const move of archetypes.moves) assert.equal(moves.get(move.move)?.job, move.job);
      assert.equal(typeof instrument.Series, 'function');
      const css = require.resolve('@standards/instrument/styles/tokens.css');
      assert.equal(css, require.resolve('@standards/instrument/dist/styles/tokens.css'));
      assert.match(readFileSync(css, 'utf8'), /--ink/);
      for (const name of ['core', 'instrument']) {
        const manifest = JSON.parse(readFileSync(require.resolve('@standards/' + name + '/package.json'), 'utf8'));
        assert.equal(manifest.name, '@standards/' + name);
      }
    `);
    command(process.execPath, ["check.mjs"], consumer);

    writeFileSync(join(consumer, "check.tsx"), `
      import { JOBS, defineMove, type JobKey, type TokenContract } from '@standards/core';
      import { InstrumentRoot, Series, type SeriesProps } from '@standards/instrument';
      const periods: SeriesProps['periods'] = [{ period: 'January', value: -24 }];
      const job: JobKey = Series.meta.job;
      const title: string = JOBS[job];
      const Custom = defineMove<{ title: string }>((props) => <div>{props.title}</div>,
        { job: 'C', move: 'Fixture', when: 'Checking types', why: 'Checks the packed declaration surface' });
      const Example = () => <InstrumentRoot loadFonts={false}><Series label={title} periods={periods} /><Custom title={title} /></InstrumentRoot>;
      declare const tokens: TokenContract;
      const system: string = tokens.system;
      // @ts-expect-error Packed declarations must reject text as a numeric observation.
      const invalid: SeriesProps = { label: 'Invalid', periods: [{ period: 'P1', value: 'text' }] };
    `);
    writeFileSync(join(consumer, "tsconfig.json"), JSON.stringify({
      compilerOptions: {
        target: "ES2022", module: "NodeNext", moduleResolution: "NodeNext", jsx: "react-jsx",
        strict: true, noEmit: true, skipLibCheck: false, types: ["react"],
      },
      files: ["check.tsx"],
    }, null, 2));
    const tsc = join(dirname(require.resolve("typescript/package.json")), "bin/tsc");
    command(process.execPath, [tsc, "--project", "tsconfig.json"], consumer);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});
