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
    const consumer18 = join(temporary, "consumer-react-18");
    mkdirSync(archives);
    mkdirSync(consumer);
    mkdirSync(consumer18);
    const core = pack(join(root, "packages/core"), archives, temporary);
    const instrument = pack(join(root, "packages/instrument"), archives, temporary);
    const coreFiles = core.files.map((file) => file.path).sort();
    assert.deepEqual(coreFiles, ["LICENSE", "README.md", "dist/index.d.ts", "dist/index.js", "package.json"]);

    const required = ["LICENSE", "LICENSE-INSTRUMENT", "NOTICE", "README.md", "tokens.json", "archetypes.json", "package.json"];
    const instrumentFiles = instrument.files.map((file) => file.path);
    const fontFiles = ["PublicSans-400.woff2", "PublicSans-600.woff2", "PublicSans-800.woff2",
      "DMMono-400.woff2", "DMMono-500.woff2", "OFL-Public-Sans.txt", "OFL-DM-Mono.txt"]
      .map((file) => `dist/fonts/${file}`);
    for (const file of [...required, "dist/index.js", "dist/index.d.ts", "dist/styles/tokens.css",
      "dist/styles/fonts.css", ...fontFiles]) {
      assert.ok(instrumentFiles.includes(file), `Instrument is missing ${file}`);
    }
    for (const file of instrumentFiles) {
      assert.ok(required.includes(file) || /^dist\/(?:[\w/-]+\.d\.ts|index\.js|styles\/(?:tokens|fonts)\.css|fonts\/[\w.-]+)$/.test(file),
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
    for (const name of ["react", "react-dom", "scheduler", "@types/react", "csstype"]) {
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
    assert.equal(coreManifest.version, "0.2.0");
    assert.equal(instrumentManifest.version, "2.0.0");
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
      import * as React from 'react';
      import { renderToStaticMarkup } from 'react-dom/server';
      const require = createRequire(import.meta.url);
      const here = dirname(fileURLToPath(import.meta.url));
      for (const name of ['@standards/core', '@standards/instrument', 'react']) {
        assert.ok(realpathSync(require.resolve(name)).startsWith(join(realpathSync(here), 'node_modules') + sep));
      }
      assert.equal(JOBS.C, 'Change');
      assert.match(React.version, /^19\\./);
      assert.equal(typeof defineMove, 'function');
      const tokens = JSON.parse(readFileSync(require.resolve('@standards/instrument/tokens.json'), 'utf8'));
      const archetypes = JSON.parse(readFileSync(require.resolve('@standards/instrument/archetypes.json'), 'utf8'));
      assert.equal(tokens.system, 'Instrument');
      const moves = new Map(Object.values(instrument).filter((value) => value?.meta)
        .map((value) => [value.meta.move, value.meta]));
      for (const move of archetypes.moves) assert.equal(moves.get(move.move)?.job, move.job);
      assert.equal(typeof instrument.Series, 'function');
      const markup = renderToStaticMarkup(React.createElement(instrument.InstrumentRoot, null,
        React.createElement(instrument.Datum, { label: 'Evidence', value: '24' })));
      assert.match(markup, /data-standards-pack="instrument"/);
      const css = require.resolve('@standards/instrument/styles/tokens.css');
      assert.equal(css, require.resolve('@standards/instrument/dist/styles/tokens.css'));
      assert.match(readFileSync(css, 'utf8'), /--ink/);
      const fonts = require.resolve('@standards/instrument/styles/fonts.css');
      assert.equal(fonts, require.resolve('@standards/instrument/dist/styles/fonts.css'));
      assert.equal(/https?:/.test(readFileSync(fonts, 'utf8')), false);
      for (const file of ['PublicSans-400.woff2', 'PublicSans-600.woff2', 'PublicSans-800.woff2',
        'DMMono-400.woff2', 'DMMono-500.woff2']) {
        assert.equal(readFileSync(require.resolve('@standards/instrument/fonts/' + file)).subarray(0, 4).toString(), 'wOF2');
      }
      for (const file of ['OFL-Public-Sans.txt', 'OFL-DM-Mono.txt']) {
        assert.match(readFileSync(require.resolve('@standards/instrument/fonts/' + file), 'utf8'), /SIL OPEN FONT LICENSE Version 1\.1/);
      }
      for (const name of ['core', 'instrument']) {
        const manifest = JSON.parse(readFileSync(require.resolve('@standards/' + name + '/package.json'), 'utf8'));
        assert.equal(manifest.name, '@standards/' + name);
      }
    `);
    command(process.execPath, ["check.mjs"], consumer);

    writeFileSync(join(consumer, "check.tsx"), `
      import { JOBS, defineMove, type JobKey, type TokenContract } from '@standards/core';
      import { InstrumentRoot, Series, type SeriesProps } from '@standards/instrument';
      const periods: SeriesProps['periods'] = [{ period: 'January', value: -24, display: '−24' }];
      const job: JobKey = Series.meta.job;
      const title: string = JOBS[job];
      const Custom = defineMove<{ title: string }>((props) => <div>{props.title}</div>,
        { job: 'C', move: 'Fixture', when: 'Checking types', why: 'Checks the packed declaration surface' });
      const Example = () => <InstrumentRoot><Series label={title} periods={periods} /><Custom title={title} /></InstrumentRoot>;
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

    const react18Dependencies = {
      "@standards/core": `file:${core.tarball}`,
      "@standards/instrument": `file:${instrument.tarball}`,
    };
    for (const [name, fixtureName] of [["react", "react18"],
      ["loose-envify", "loose-envify"], ["js-tokens", "js-tokens"]]) {
      const directory = dirname(require.resolve(`${fixtureName}/package.json`));
      const fixture = pack(directory, archives, temporary);
      react18Dependencies[name] = `file:${fixture.tarball}`;
    }
    writeFileSync(join(consumer18, "package.json"), JSON.stringify({
      name: "standards-react-18-consumer", private: true, type: "module",
      dependencies: react18Dependencies,
    }, null, 2));
    command(npm, ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund"], consumer18);
    writeFileSync(join(consumer18, "check.mjs"), `
      import assert from 'node:assert/strict';
      import * as React from 'react';
      import { Datum, InstrumentRoot } from '@standards/instrument';
      assert.match(React.version, /^18\\./);
      const datum = Datum({ label: 'React major', value: React.version });
      const root = InstrumentRoot({ children: datum });
      assert.equal(React.isValidElement(datum), true);
      assert.equal(React.isValidElement(root), true);
      assert.equal(root.props['data-standards-pack'], 'instrument');
    `);
    command(process.execPath, ["check.mjs"], consumer18);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});
