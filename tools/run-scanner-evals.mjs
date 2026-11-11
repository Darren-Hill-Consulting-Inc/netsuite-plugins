#!/usr/bin/env node
// Scanner-recall evals for the tba-to-oauth2 skill. For each fixture repo under
// test-repos/tba-to-oauth2/ and each run:
//   1. copy the fixture to a temp dir, leaving out ANSWER_KEY.json;
//   2. run `claude -p` there with the plugin loaded and ask for a scan and plan;
//   3. score docs/tba-to-oauth2-inventory.json against the fixture's ANSWER_KEY.json;
// then write eval-out/scanner-<timestamp>.json and print a table.
//
// Every run is a billed model call on your account. Before any run, the script checks
// `claude auth status` (with the CLAUDE_CONFIG_DIR it was started with, which every
// child inherits) and refuses with exit 2 unless the account's email or orgName contains
// the value of TBA_EVAL_EXPECT_ACCOUNT. Set that variable in your shell, not in the repo:
//   CLAUDE_CONFIG_DIR=<config dir> TBA_EVAL_EXPECT_ACCOUNT=<your domain> node tools/run-scanner-evals.mjs
//
// Usage: node tools/run-scanner-evals.mjs [--runs 3] [--fixture <name>] [--concurrency 3]
//          [--max-budget-usd 5] [--timeout-min 30] [--model <model>] [--keep-temp]
//   --max-budget-usd caps each claude run (claude's own --max-budget-usd).
//   Exit 0 when every run of every fixture passes, 1 otherwise.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { scoreInventory } from './score-inventory.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const FIXTURES = path.join(ROOT, 'test-repos/tba-to-oauth2');
const PLUGIN = path.join(ROOT, 'plugins/tba-to-oauth2');
const INVENTORY = 'docs/tba-to-oauth2-inventory.json';
const PROMPT = 'Scan this repo for NetSuite authentication and write the TBA migration plan.';

// Variables that tie a child to the session that launched this script (when run from
// inside Claude Code). The child must be a fresh, independent session.
const PARENT_SESSION_VARS = [
  'CLAUDECODE', 'CLAUDE_PID', 'CLAUDE_EFFORT', 'CLAUDE_PLUGIN_DATA', 'CLAUDE_CODE_ENTRYPOINT',
  'CLAUDE_CODE_SESSION_ID', 'CLAUDE_CODE_CHILD_SESSION', 'CLAUDE_CODE_SESSION_ATTENDED',
  'CLAUDE_CODE_BRIDGE_SESSION_ID', 'CLAUDE_CODE_MESSAGING_SOCKET', 'CLAUDE_CODE_MESSAGING_TOKEN',
  'CLAUDE_CODE_SSE_PORT',
];

// Copies a fixture repo to dest without its answer key, so the scan can't read it.
export function copyFixture(src, dest) {
  fs.cpSync(src, dest, {
    recursive: true,
    filter: (p) => path.basename(p) !== 'ANSWER_KEY.json',
  });
}

// Returns null when `claude auth status` output shows the expected account, else why not.
export function accountMismatch(statusText, expect) {
  if (!expect) return 'TBA_EVAL_EXPECT_ACCOUNT is not set; set it to part of the email or org name the runs must bill to';
  let status;
  try { status = JSON.parse(statusText); } catch { return 'could not parse `claude auth status` output'; }
  if (!status.loggedIn) return 'claude is not logged in for this config dir';
  const fields = [status.email, status.orgName].filter((v) => typeof v === 'string');
  if (!fields.some((v) => v.includes(expect))) return `logged-in account doesn't match TBA_EVAL_EXPECT_ACCOUNT`;
  return null;
}

function childEnv() {
  const env = { ...process.env };
  for (const v of PARENT_SESSION_VARS) delete env[v];
  return env;
}

function checkAccount() {
  let out = '';
  try {
    out = execFileSync('claude', ['auth', 'status'], { env: childEnv(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    out = e.stdout ?? '';
  }
  return accountMismatch(out, process.env.TBA_EVAL_EXPECT_ACCOUNT);
}

function parseArgs(argv) {
  const opts = { runs: 3, fixture: null, concurrency: 3, maxBudgetUsd: 5, timeoutMin: 30, model: null, keepTemp: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`${a} needs a value`);
      return argv[++i];
    };
    if (a === '--runs') opts.runs = Number(next());
    else if (a === '--fixture') opts.fixture = next();
    else if (a === '--concurrency') opts.concurrency = Number(next());
    else if (a === '--max-budget-usd') opts.maxBudgetUsd = Number(next());
    else if (a === '--timeout-min') opts.timeoutMin = Number(next());
    else if (a === '--model') opts.model = next();
    else if (a === '--keep-temp') opts.keepTemp = true;
    else throw new Error(`unknown option ${a}`);
  }
  for (const k of ['runs', 'concurrency', 'maxBudgetUsd', 'timeoutMin']) {
    if (!(opts[k] > 0)) throw new Error(`--${k} must be a positive number`);
  }
  return opts;
}

function runClaude(cwd, opts) {
  const args = [
    '-p', PROMPT,
    '--plugin-dir', PLUGIN,
    // Lets the skill read its own references and scripts, which sit outside the
    // fixture's working directory (claude plugin eval grants the same).
    '--add-dir', PLUGIN,
    '--permission-mode', 'acceptEdits',
    '--output-format', 'json',
    // Keep the owner's own settings, plugins, hooks and MCP servers out of the run.
    '--setting-sources', 'project,local',
    '--strict-mcp-config',
    '--max-budget-usd', String(opts.maxBudgetUsd),
  ];
  if (opts.model) args.push('--model', opts.model);
  const env = childEnv();

  return new Promise((resolve) => {
    const child = spawn('claude', args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    const timer = setTimeout(() => child.kill('SIGTERM'), opts.timeoutMin * 60_000);
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      let out = null;
      try { out = JSON.parse(stdout); } catch { /* reported below */ }
      resolve({ code, signal, out, stderr: stderr.slice(-2000), stdoutTail: out ? undefined : stdout.slice(-2000) });
    });
  });
}

async function runOne(fixture, run, opts) {
  const src = path.join(FIXTURES, fixture);
  const key = JSON.parse(fs.readFileSync(path.join(src, 'ANSWER_KEY.json'), 'utf8'));
  const work = fs.mkdtempSync(path.join(os.tmpdir(), `tba-scan-${fixture}-`));
  copyFixture(src, work);
  const started = Date.now();
  const res = await runClaude(work, opts);

  let inventory = null;
  let inventoryError = null;
  try {
    inventory = JSON.parse(fs.readFileSync(path.join(work, INVENTORY), 'utf8'));
  } catch (e) {
    inventoryError = e.code === 'ENOENT' ? `${INVENTORY} not written` : `${INVENTORY} unreadable: ${e.message}`;
  }
  const score = scoreInventory(inventory, key);
  if (!opts.keepTemp) fs.rmSync(work, { recursive: true, force: true });

  return {
    fixture,
    run,
    ...score,
    pass: score.pass && !inventoryError,
    inventoryError,
    costUsd: res.out?.total_cost_usd ?? null,
    durationS: Math.round((Date.now() - started) / 1000),
    numTurns: res.out?.num_turns ?? null,
    sessionId: res.out?.session_id ?? null,
    claudeExit: res.code,
    claudeSignal: res.signal,
    claudeError: res.out?.is_error ? (res.out.subtype ?? 'error') : null,
    claudeStderr: res.stderr || undefined,
    claudeStdoutTail: res.stdoutTail,
    finalMessage: res.out?.result ?? null,
    inventory,
    workDir: opts.keepTemp ? work : undefined,
  };
}

async function pool(tasks, n) {
  const results = new Array(tasks.length);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const i = next++;
      results[i] = await tasks[i]();
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, tasks.length) }, worker));
  return results;
}

const pct = (x) => `${(x * 100).toFixed(0)}%`;
const money = (x) => `$${x.toFixed(2)}`;

function table(fixtures, results) {
  const rows = [['FIXTURE', 'PASS', 'RECALL min/mean', 'NO-.ENV min', 'BLOCKED', 'DECOYS', 'OUTCOME', 'EXTRAS', 'COST']];
  for (const f of fixtures) {
    const rs = results.filter((r) => r.fixture === f);
    const recalls = rs.map((r) => r.recall);
    rows.push([
      f,
      `${rs.filter((r) => r.pass).length}/${rs.length}`,
      `${pct(Math.min(...recalls))}/${pct(recalls.reduce((a, b) => a + b, 0) / rs.length)}`,
      pct(Math.min(...rs.map((r) => r.recallWithoutEnv))),
      String(rs.reduce((a, r) => a + r.blockedReported.length, 0)),
      String(rs.reduce((a, r) => a + r.decoysFlagged.length, 0)),
      String(rs.reduce((a, r) => a + r.outcomeMismatches.length, 0)),
      String(rs.reduce((a, r) => a + r.unkeyedExtras.length, 0)),
      money(rs.reduce((a, r) => a + (r.costUsd ?? 0), 0)),
    ]);
  }
  const widths = rows[0].map((_, c) => Math.max(...rows.map((r) => r[c].length)));
  return rows.map((r) => r.map((cell, c) => cell.padEnd(widths[c])).join('  ')).join('\n');
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const all = fs.readdirSync(FIXTURES).filter((n) => fs.existsSync(path.join(FIXTURES, n, 'ANSWER_KEY.json'))).sort();
  const fixtures = opts.fixture ? all.filter((n) => n === opts.fixture) : all;
  if (fixtures.length === 0) throw new Error(`no fixture named ${opts.fixture}; have ${all.join(', ')}`);

  const mismatch = checkAccount();
  if (mismatch) {
    console.error(`run-scanner-evals: refusing to run: ${mismatch} (CLAUDE_CONFIG_DIR=${process.env.CLAUDE_CONFIG_DIR ?? 'unset'})`);
    process.exitCode = 2;
    return;
  }

  const total = fixtures.length * opts.runs;
  console.error(`WARNING: this makes ${total} billed claude run(s) on your account `
    + `(${fixtures.length} fixture(s) x ${opts.runs} run(s)), each capped at ${money(opts.maxBudgetUsd)}, `
    + `up to ${money(total * opts.maxBudgetUsd)} in all. Ctrl-C now to stop.`);

  const tasks = fixtures.flatMap((f) => Array.from({ length: opts.runs }, (_, i) => async () => {
    const r = await runOne(f, i + 1, opts);
    console.error(`${r.pass ? 'PASS' : 'FAIL'} ${f} run ${r.run}: recall ${pct(r.recall)} (no .env ${pct(r.recallWithoutEnv)}), blocked ${r.blockedReported.length}, `
      + `decoys ${r.decoysFlagged.length}, outcome ${r.outcomeMismatches.length}, `
      + `${r.costUsd == null ? 'cost ?' : money(r.costUsd)}, ${r.durationS}s`
      + (r.inventoryError ? `, ${r.inventoryError}` : '') + (r.claudeError ? `, claude: ${r.claudeError}` : ''));
    return r;
  }));
  const results = await pool(tasks, opts.concurrency);

  const costUsd = results.reduce((a, r) => a + (r.costUsd ?? 0), 0);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(ROOT, 'eval-out');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `scanner-${stamp}.json`);
  fs.writeFileSync(outFile, JSON.stringify({ prompt: PROMPT, options: opts, costUsd, results }, null, 2));

  console.log(table(fixtures, results));
  console.log(`\n${results.filter((r) => r.pass).length}/${results.length} runs passed · total ${money(costUsd)} · ${path.relative(ROOT, outFile)}`);
  process.exitCode = results.every((r) => r.pass) ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((e) => {
    console.error(`run-scanner-evals: ${e.message}`);
    process.exitCode = 1;
  });
}
