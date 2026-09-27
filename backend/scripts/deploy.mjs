#!/usr/bin/env node
/**
 * deploy.mjs — deployment orchestrator for the Smart School Management System.
 *
 * Why this exists: this repo has two Supabase projects that look interchangeable
 * from a URL alone. Mixing them up once (during this project's audit) is exactly
 * the class of mistake this script is built to make impossible: every command
 * that could touch a database verifies which project it's about to touch against
 * a checked-in expectation (deploy.config.json) BEFORE doing anything, and the
 * production path never opens a live database connection at all — by design,
 * not by flag. There is no override for that. See "migrate --env production"
 * below.
 *
 * Usage:
 *   node backend/scripts/deploy.mjs check   [--skip-backend] [--skip-frontend]
 *   node backend/scripts/deploy.mjs migrate --env staging    [--apply] [--yes] [--baseline]
 *   node backend/scripts/deploy.mjs migrate --env production [--full] [--since=<filename>]
 *   node backend/scripts/deploy.mjs push    [--branch main]
 *   node backend/scripts/deploy.mjs all     --env staging [--apply] [--push] [--yes]
 *   node backend/scripts/deploy.mjs help
 *
 * Run it from anywhere; paths are resolved relative to the repo root.
 *
 * "check"   — typecheck + lint + test + build, backend then frontend. Aborts the
 *             whole pipeline on the first failure. This is the CI this repo
 *             doesn't have yet; run it before every deploy.
 * "migrate" — staging: verifies the target is the known disposable staging
 *             project (by Supabase project ref, checked in TWO independent
 *             places — backend/.env.staging AND deploy.config.json — and they
 *             must agree), then applies only the migration files NOT YET
 *             recorded in a tracking table this script maintains on the
 *             target database (public._deploy_migrations). Re-running the
 *             full history unconditionally is NOT safe in general — some
 *             migrations alter what earlier files assume (see the
 *             LAST_PRE_AUDIT_MIGRATION comment below for a concrete example
 *             this script's own test run hit). Dry-run unless --apply is
 *             passed; --apply still asks for typed confirmation unless --yes
 *             is also given. Use --baseline once on a database that was
 *             migrated by hand before this script existed, to record its
 *             current file set as already-applied without running any SQL.
 *             production: NEVER connects to a database. It only concatenates
 *             migration files into one timestamped .sql bundle under
 *             backend/deploy-logs/ and prints the exact Supabase SQL Editor
 *             steps. That is the only sanctioned path to production for this
 *             script, per this project's own explicit instruction: production
 *             gets code + information, never a direct write from an automated
 *             tool. Defaults to an INCREMENTAL bundle (only files after
 *             LAST_PRE_AUDIT_MIGRATION, i.e. the ones this security-audit
 *             session added) since production is a live app that already has
 *             everything before that; pass --full only to bootstrap a
 *             brand-new empty project, or --since=<filename> for a different
 *             cutoff.
 * "push"    — pushes the current branch to origin/<branch> (default: main),
 *             but only if the working tree is clean and the local branch is
 *             not behind origin. Never force-pushes.
 * "all"     — check, then migrate (if --env given), then push (if --push given).
 *             Stops at the first failed step.
 */

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const BACKEND_DIR = path.join(REPO_ROOT, "backend");
const FRONTEND_DIR = path.join(REPO_ROOT, "frontend");
const DATABASE_DIR = path.join(REPO_ROOT, "database");
const LOG_DIR = path.join(BACKEND_DIR, "deploy-logs");
const CONFIG_PATH = path.join(REPO_ROOT, "deploy.config.json");
const STRAY_MIGRATION = "009_attendance_system.sql"; // documented stray draft — see README §4.2
// The last migration that predates this project's 2026-09 security-audit fixes.
// Production is a live, already-deployed app (per DEPLOYMENT.md) that already has
// everything up to and including this file — 077 onward is new. Used as the
// default cutoff for the production bundle, and discovered the hard way: see
// TRACKING_TABLE below for why "just re-run everything" is not actually safe.
const LAST_PRE_AUDIT_MIGRATION = "076_close_notifications_write_policy_leak.sql";
// Tracks which files this script has applied to a given database. Necessary
// because this repo's migrations are individually idempotent (create table if
// not exists, etc.) but NOT collectively safe to replay from schema.sql onward
// against a database that has since evolved: e.g. schema.sql creates
// `idx_vehicles_driver_id on vehicles(driver_id)`, but migration 053 later
// drops that column — `create table if not exists` silently no-ops so the
// table-creation half is fine, but the separate `create index` statement is
// NOT gated by that and errors on any already-migrated database. Discovered by
// this script's own test run against staging (rolled back cleanly, no damage).
const TRACKING_TABLE = "public._deploy_migrations";

// ---------------------------------------------------------------------------
// small utilities
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const cmd = args[0] && !args[0].startsWith("-") ? args[0] : "help";
// Boolean switches (no value ever follows), so `--env staging` isn't mistaken
// for a flag named "--env" with a bare value.
const BOOLEAN_FLAGS = new Set(["--apply", "--yes", "--push", "--skip-backend", "--skip-frontend", "--help", "--baseline", "--full"]);
const flags = new Set();
const opts = {};
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (!a.startsWith("--")) continue;
  if (a.includes("=")) {
    const [key, value] = a.slice(2).split(/=(.*)/s);
    opts[key] = value;
  } else if (BOOLEAN_FLAGS.has(a)) {
    flags.add(a);
  } else {
    // `--key value` form
    opts[a.slice(2)] = args[i + 1];
    i++;
  }
}

mkdirSync(LOG_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const logPath = path.join(LOG_DIR, `deploy-${stamp}.log`);
const logLines = [];

function log(line = "") {
  console.log(line);
  logLines.push(line);
}
function flushLog() {
  try {
    writeFileSync(logPath, logLines.join("\n") + "\n");
  } catch {
    /* best-effort logging only */
  }
}
function fail(message) {
  log(`\n✖ ${message}`);
  flushLog();
  process.exit(1);
}
function section(title) {
  log(`\n${"=".repeat(70)}\n${title}\n${"=".repeat(70)}`);
}

/** Never let a connection string with a password reach the console or the log. */
function redact(str) {
  return String(str).replace(/:\/\/([^:@/]+):([^@/]+)@/g, "://$1:<redacted>@");
}

/** Extracts a Supabase project ref from either an https://<ref>.supabase.co URL
 * or a Postgres connection string (direct db.<ref>... or pooler postgres.<ref>). */
function extractRef(value) {
  if (!value) return null;
  const httpMatch = value.match(/https?:\/\/([a-z0-9]{16,})\.supabase\.co/i);
  if (httpMatch) return httpMatch[1].toLowerCase();
  const dbHostMatch = value.match(/db\.([a-z0-9]{16,})\.supabase\.co/i);
  if (dbHostMatch) return dbHostMatch[1].toLowerCase();
  const poolerUserMatch = value.match(/postgres\.([a-z0-9]{16,})[:@]/i);
  if (poolerUserMatch) return poolerUserMatch[1].toLowerCase();
  return null;
}

/** Minimal KEY=VALUE .env parser — no external dependency, this is an ops script. */
function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const out = {};
  for (const rawLine of readFileSync(filePath, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function loadDeployConfig() {
  if (!existsSync(CONFIG_PATH)) fail(`Missing ${path.relative(REPO_ROOT, CONFIG_PATH)} — this script refuses to guess environment identity.`);
  return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
}

/** Runs a command with output streamed live AND captured into the log. spawnSync
 * with stdio "inherit" would skip our log file, so we pipe and re-print. */
function run(command, cmdArgs, cwd, label) {
  log(`\n$ (${path.relative(REPO_ROOT, cwd) || "."}) ${command} ${cmdArgs.join(" ")}`);
  const result = spawnSync(command, cmdArgs, { cwd, encoding: "utf8", shell: process.platform === "win32" });
  const out = (result.stdout || "") + (result.stderr || "");
  if (out.trim()) log(out.trimEnd());
  const ok = result.status === 0;
  log(ok ? `✓ ${label} passed` : `✖ ${label} FAILED (exit ${result.status})`);
  return ok;
}

/** Reverts a build artifact that typecheck/build steps rewrite as a side effect,
 * so a clean `check` run never leaves the tree dirty for the `push` step. */
function revertKnownBuildArtifacts() {
  const artifact = "frontend/tsconfig.tsbuildinfo";
  const diff = spawnSync("git", ["diff", "--quiet", "--", artifact], { cwd: REPO_ROOT });
  if (diff.status !== 0) {
    spawnSync("git", ["checkout", "--", artifact], { cwd: REPO_ROOT });
    log(`(reverted incidental build artifact: ${artifact})`);
  }
}

function askYesNo(question) {
  if (!process.stdin.isTTY) return Promise.resolve(false);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ---------------------------------------------------------------------------
// check
// ---------------------------------------------------------------------------

function cmdCheck() {
  section("CHECK — typecheck, lint, test, build");
  const packages = [];
  if (!flags.has("--skip-backend")) packages.push({ name: "backend", dir: BACKEND_DIR });
  if (!flags.has("--skip-frontend")) packages.push({ name: "frontend", dir: FRONTEND_DIR });

  const results = [];
  for (const pkg of packages) {
    for (const [script, label] of [
      ["typecheck", "typecheck"],
      ["lint", "lint"],
      ["test", "unit tests"],
      ["build", "build"],
    ]) {
      const ok = run("npm", ["run", script], pkg.dir, `${pkg.name} ${label}`);
      results.push({ pkg: pkg.name, step: label, ok });
      if (!ok) {
        revertKnownBuildArtifacts();
        printSummary(results);
        fail(`${pkg.name} ${label} failed — fix it before deploying. Full output: ${logPath}`);
      }
    }
  }
  revertKnownBuildArtifacts();
  printSummary(results);
  log(`\n✓ All checks passed.`);
  return results;
}

function printSummary(results) {
  section("SUMMARY");
  for (const r of results) log(`  ${r.ok ? "✓" : "✖"} ${r.pkg.padEnd(10)} ${r.step}`);
}

// ---------------------------------------------------------------------------
// migrate
// ---------------------------------------------------------------------------

/**
 * Returns the full ordered list of {name, path} for schema.sql, rls_policies.sql,
 * and every migrations/*.sql file (skipping the documented stray draft).
 * `sinceExclusive`, if given, drops schema.sql/rls_policies.sql AND every
 * migration at or before that filename — for bundling only what's new.
 */
function listMigrationFiles({ sinceExclusive } = {}) {
  const migrationsDir = path.join(DATABASE_DIR, "migrations");
  const sortedMigrationNames = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql") && f !== STRAY_MIGRATION)
    .sort();

  const entries = [];
  if (!sinceExclusive) {
    entries.push({ name: "schema.sql", path: path.join(DATABASE_DIR, "schema.sql") });
    entries.push({ name: "rls_policies.sql", path: path.join(DATABASE_DIR, "rls_policies.sql") });
  }
  for (const name of sortedMigrationNames) {
    if (sinceExclusive && name <= sinceExclusive) continue;
    entries.push({ name, path: path.join(migrationsDir, name) });
  }
  return entries;
}

async function cmdMigrateStaging() {
  const config = loadDeployConfig();
  const envPath = path.join(BACKEND_DIR, ".env.staging");
  const env = loadEnvFile(envPath);

  if (!env.STAGING_DB_URL) {
    fail(`STAGING_DB_URL is not set in ${path.relative(REPO_ROOT, envPath)}. Add the Supabase session-pooler connection string there first (see audit/STAGING-SETUP.md).`);
  }

  const refFromDbUrl = extractRef(env.STAGING_DB_URL);
  const refFromSupabaseUrl = extractRef(env.SUPABASE_URL);
  const expectedRef = config.staging?.expectedRef;

  log(`Target ref (from STAGING_DB_URL):    ${refFromDbUrl || "UNPARSEABLE"}`);
  log(`Target ref (from SUPABASE_URL):      ${refFromSupabaseUrl || "UNPARSEABLE"}`);
  log(`Expected ref (deploy.config.json):   ${expectedRef || "MISSING"}`);

  if (!refFromDbUrl || !refFromSupabaseUrl || !expectedRef) {
    fail("Could not verify the target project ref from all three sources — refusing to proceed. Fix the config before retrying.");
  }
  if (refFromDbUrl !== expectedRef || refFromSupabaseUrl !== expectedRef) {
    fail(
      `REFUSING: the ref in backend/.env.staging does not match deploy.config.json's expected staging ref.\n` +
        `  This is exactly the mismatch this script exists to catch. If .env.staging was intentionally re-pointed at a\n` +
        `  new disposable project, update the "expectedRef" in deploy.config.json first (a deliberate, reviewable edit),\n` +
        `  then re-run this command.`
    );
  }
  log("✓ Target ref verified against deploy.config.json — proceeding is safe.");

  const allFiles = listMigrationFiles();
  section(`MIGRATE — staging (${expectedRef})`);

  const { Client } = await import("pg");
  const client = new Client({ connectionString: env.STAGING_DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(`create table if not exists ${TRACKING_TABLE} (filename text primary key, applied_at timestamptz not null default now())`);
    const { rows } = await client.query(`select filename from ${TRACKING_TABLE}`);
    const alreadyApplied = new Set(rows.map((r) => r.filename));
    const pending = allFiles.filter((f) => !alreadyApplied.has(f.name));

    log(`${allFiles.length} known migration files. ${alreadyApplied.size} already recorded as applied. ${pending.length} pending.`);

    if (flags.has("--baseline")) {
      if (!flags.has("--apply")) fail("--baseline only makes sense together with --apply.");
      log(`\n--baseline: recording all ${allFiles.length} files as already applied WITHOUT running any SQL.`);
      log(`Use this once for a database that was migrated by hand before this script existed.`);
      for (const f of allFiles) {
        await client.query(`insert into ${TRACKING_TABLE} (filename) values ($1) on conflict (filename) do nothing`, [f.name]);
      }
      log(`✓ Baseline recorded. Future "migrate --env staging --apply" runs will only apply files added after this point.`);
      return true;
    }

    if (alreadyApplied.size === 0) {
      const { rows: existing } = await client.query(`select to_regclass('public.schools') as t`);
      if (existing[0].t) {
        fail(
          `The tracking table is empty, but public.schools already exists — this database was migrated before\n` +
            `  this script existed (exactly the situation that caused the earlier "driver_id does not exist" failure).\n` +
            `  Run once with --baseline to record the current state without executing anything:\n` +
            `    node backend/scripts/deploy.mjs migrate --env staging --apply --baseline --yes`
        );
      }
    }

    if (pending.length === 0) {
      log(`\n✓ Nothing to apply — staging is already up to date.`);
      return true;
    }

    log(`\nPending files, in order:`);
    for (const f of pending) log(`  - ${f.name}`);

    if (!flags.has("--apply")) {
      log(`\nDry run only (no --apply given). Nothing was executed.`);
      return true;
    }

    if (!flags.has("--yes")) {
      const answer = await askYesNo(`\nType "staging" to confirm applying ${pending.length} migration file(s) to ${redact(env.STAGING_DB_URL)}: `);
      if (answer !== "staging") fail("Confirmation did not match — aborted, nothing was executed.");
    }

    log(`\nApplying ${pending.length} file(s)...`);
    let applied = 0;
    for (const f of pending) {
      const sql = readFileSync(f.path, "utf8");
      process.stdout.write(`  applying ${f.name} ... `);
      try {
        await client.query("begin");
        await client.query(sql);
        await client.query(`insert into ${TRACKING_TABLE} (filename) values ($1) on conflict (filename) do nothing`, [f.name]);
        await client.query("commit");
        console.log("ok");
        log(`  applied ${f.name}`);
        applied++;
      } catch (err) {
        await client.query("rollback").catch(() => undefined);
        console.log("FAILED");
        fail(
          `Migration ${f.name} failed and was rolled back (no partial changes from this file were kept): ${err.message}\n` +
            `Applied ${applied}/${pending.length} pending files before this one — those are already recorded and won't be re-run.\n` +
            `Fix ${f.name} and re-run the same command; it will resume from here.`
        );
      }
    }
    log(`\n✓ Applied ${applied} new migration file(s) to staging (${expectedRef}).`);
  } finally {
    await client.end();
  }
  return true;
}

function cmdMigrateProductionBundle() {
  section("MIGRATE — production (bundle only, no live connection)");
  log(
    "This script NEVER opens a database connection for --env production. That is a\n" +
      "deliberate, non-configurable restriction: production gets code and information\n" +
      "from automation here, never a direct write. What follows is a single .sql file\n" +
      "for you to run yourself in the Supabase SQL Editor for the production project."
  );

  const full = flags.has("--full");
  // IMPORTANT: schema.sql is NOT collectively safe to replay against a database
  // that has already evolved past it (see TRACKING_TABLE comment near the top of
  // this file — a concrete example: migration 053 drops vehicles.driver_id, but
  // schema.sql unconditionally tries to (re)create an index on that column).
  // Production is a live, already-deployed app, so by default this bundles ONLY
  // the migrations added after the last one production is known to already have.
  // Pass --full only for bootstrapping a brand-new, empty Supabase project.
  const files = full ? listMigrationFiles() : listMigrationFiles({ sinceExclusive: opts.since || LAST_PRE_AUDIT_MIGRATION });

  if (!full && files.length === 0) {
    log(`\nNo migrations found after ${opts.since || LAST_PRE_AUDIT_MIGRATION} — nothing to bundle.`);
    return true;
  }

  const bundlePath = path.join(LOG_DIR, `production-migration-bundle-${stamp}.sql`);
  const parts = [
    `-- Combined migration bundle generated ${new Date().toISOString()}`,
    full
      ? `-- FULL bundle: ${files.length} files (schema.sql, rls_policies.sql, migrations/*.sql, skipping ${STRAY_MIGRATION}).`
      : `-- INCREMENTAL bundle: ${files.length} migration file(s) AFTER ${opts.since || LAST_PRE_AUDIT_MIGRATION}.`,
    full
      ? `-- Only use --full to bootstrap a brand-new, EMPTY Supabase project.`
      : `-- This assumes the target already has everything up to and including`,
    full ? "" : `-- ${opts.since || LAST_PRE_AUDIT_MIGRATION} applied. Re-running this incremental bundle is safe`,
    full ? "" : `-- (every file here is individually idempotent), but running the FULL history`,
    full ? "" : `-- (--full) against an already-migrated database is NOT safe in general — see`,
    full ? "" : `-- the comment above LAST_PRE_AUDIT_MIGRATION in this script for a concrete example.`,
    "",
  ].filter((l) => l !== undefined);
  for (const file of files) {
    parts.push(`-- ${"-".repeat(76)}`);
    parts.push(`-- ${path.relative(DATABASE_DIR, file.path)}`);
    parts.push(`-- ${"-".repeat(76)}`);
    parts.push(readFileSync(file.path, "utf8"));
    parts.push("");
  }
  writeFileSync(bundlePath, parts.join("\n"));

  log(`\n✓ Wrote ${files.length} file(s) into: ${path.relative(REPO_ROOT, bundlePath)}`);
  for (const f of files) log(`  - ${f.name}`);
  log(
    `\nTo apply it:\n` +
      `  1. Open the PRODUCTION Supabase project → SQL Editor.\n` +
      `  2. Confirm you are in the production project (check the project name/ref in the URL bar)\n` +
      `     before pasting anything — this script cannot verify that for you.\n` +
      `  3. Paste the contents of ${path.relative(REPO_ROOT, bundlePath)} and run it.\n` +
      (full
        ? `  4. Only do this against a brand-new, empty project.\n`
        : `  4. Next time you add new migration files, re-run this command with\n` +
          `     --since=<the last filename production now has> to bundle just the new ones.\n`)
  );
  return true;
}

async function cmdMigrate() {
  const env = opts.env;
  if (env === "staging") return cmdMigrateStaging();
  if (env === "production") return cmdMigrateProductionBundle();
  fail(`--env must be "staging" or "production" (got: ${env || "(none)"}).`);
}

// ---------------------------------------------------------------------------
// push
// ---------------------------------------------------------------------------

function cmdPush() {
  const branch = opts.branch || "main";
  section(`PUSH — origin/${branch}`);

  const statusResult = spawnSync("git", ["status", "--porcelain"], { cwd: REPO_ROOT, encoding: "utf8" });
  const dirty = statusResult.stdout
    .split("\n")
    .filter(Boolean)
    // untracked scaffolding files already present before this script ever runs
    // don't block a push; only staged/modified TRACKED changes do.
    .filter((line) => !line.startsWith("??"));
  if (dirty.length > 0) {
    fail(`Working tree has uncommitted tracked changes — commit or stash first:\n${dirty.join("\n")}`);
  }

  const currentBranch = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: REPO_ROOT, encoding: "utf8" }).stdout.trim();
  if (currentBranch !== branch) {
    fail(`On branch "${currentBranch}", not "${branch}". Checkout ${branch} first, or pass --branch=${currentBranch}.`);
  }

  log(`Fetching origin/${branch}...`);
  spawnSync("git", ["fetch", "origin", branch], { cwd: REPO_ROOT, stdio: "inherit" });

  const behind = spawnSync("git", ["rev-list", "--count", `HEAD..origin/${branch}`], { cwd: REPO_ROOT, encoding: "utf8" }).stdout.trim();
  if (behind !== "0") {
    fail(`Local ${branch} is ${behind} commit(s) behind origin/${branch} — pull/merge first. This script never force-pushes.`);
  }

  const ok = run("git", ["push", "origin", branch], REPO_ROOT, `push origin/${branch}`);
  if (!ok) fail(`Push failed — see ${logPath}`);
  log(`\n✓ Pushed to origin/${branch}.`);
  return true;
}

// ---------------------------------------------------------------------------
// help / dispatch
// ---------------------------------------------------------------------------

function printHelp() {
  console.log(`
deploy.mjs — deployment orchestrator (see the file header for full docs)

  node backend/scripts/deploy.mjs check   [--skip-backend] [--skip-frontend]
  node backend/scripts/deploy.mjs migrate --env staging    [--apply] [--yes] [--baseline]
  node backend/scripts/deploy.mjs migrate --env production [--full] [--since=<filename>]
  node backend/scripts/deploy.mjs push    [--branch main]
  node backend/scripts/deploy.mjs all     --env staging [--apply] [--push] [--yes]

Production is never given a live database connection by this script — "migrate
--env production" only writes a .sql bundle for you to paste into the Supabase
SQL Editor yourself. There is no flag that changes that.

Staging tracks which migration files it has already applied (in
public._deploy_migrations on the staging DB itself), so re-running "migrate
--env staging --apply" only ever applies NEW files, never replays the whole
history. Use --baseline once if staging was migrated by hand before this
script existed.
`);
}

async function main() {
  if (cmd === "help" || flags.has("--help")) return printHelp();

  log(`deploy.mjs ${cmd} ${args.slice(1).join(" ")}`.trim());
  log(`repo root: ${REPO_ROOT}`);
  log(`log file:  ${logPath}`);

  if (cmd === "check") {
    cmdCheck();
  } else if (cmd === "migrate") {
    await cmdMigrate();
  } else if (cmd === "push") {
    cmdPush();
  } else if (cmd === "all") {
    cmdCheck();
    if (opts.env) await cmdMigrate();
    if (flags.has("--push")) cmdPush();
  } else {
    printHelp();
    fail(`Unknown command: ${cmd}`);
  }

  flushLog();
  log(`\nFull log: ${path.relative(REPO_ROOT, logPath)}`);
}

main().catch((err) => {
  log(`\nUnexpected error: ${err.stack || err.message}`);
  flushLog();
  process.exit(1);
});
