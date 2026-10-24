// Offline audit checks against the supplied immutable release, not live services.
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const archive = join(
  root,
  "attached_assets/airank-confirmed-checker-release_(3)_1791797344858.zip",
);
const original = await readFile(
  join(root, "attached_assets/AI-Rank-Replit-Build-Pack_1791797325463.md"),
);
assert.deepEqual(
  await readFile(join(root, "docs/AI-RANK-MASTER-SPEC.md")),
  original,
  "Saved master spec must be byte-identical to supplied pack",
);
const status = await readFile(
  join(root, "docs/IMPLEMENTATION-STATUS.md"),
  "utf8",
);
const figma = await readFile(join(root, "docs/FIGMA-MAP.md"), "utf8");
for (let i = 1; i <= 37; i++) {
  const id = String(i).padStart(2, "0");
  assert.match(status, new RegExp(`\\| ${id} `), `Matrix misses pair ${id}`);
  assert.match(figma, new RegExp(`\\| ${id} `), `Figma map misses pair ${id}`);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(
      `${command} failed (${result.status})\n${result.stdout || ""}\n${result.stderr || ""}`,
    );
  return result.stdout;
}

// Validate archive paths and extract only in a fresh temporary directory.
const entries = run("unzip", ["-Z1", archive]).trim().split("\n");
assert(entries.length < 200, "Unexpected archive size");
for (const entry of entries) {
  assert(
    entry.startsWith("airank-confirmed-checker-release/") &&
      !entry.split("/").includes("..") &&
      !entry.includes("\\"),
    "Unsafe archive path",
  );
}
const dir = await mkdtemp(join(tmpdir(), "airank-baseline-"));
try {
  run("unzip", ["-q", archive, "-d", dir]);
  for (const release of ["airank-api-0.2.0", "airank-worker-0.4.0"]) {
    const cwd = join(dir, "airank-confirmed-checker-release", release);
    const tests = (await readdir(join(cwd, "test")))
      .filter((name) => name.endsWith(".test.mjs"))
      .sort()
      .map((name) => join("test", name));
    // Do not pass workspace credentials into uploaded test processes.
    const output = run(process.execPath, ["--test", ...tests], {
      cwd,
      env: { PATH: process.env.PATH, HOME: dir, NODE_ENV: "test" },
    });
    process.stdout.write(`${release}\n${output}\n`);
  }
  process.stdout.write(
    "Master spec integrity and 37 FI/EN frame pairs: PASS\n",
  );
} finally {
  await rm(dir, { recursive: true, force: true });
}
