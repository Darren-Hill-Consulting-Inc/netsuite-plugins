// Shared CLI plumbing: config loading, the redaction pass over every printed line, the
// account-change guard, and report output. Exit codes: 0 no fail, 1 any fail, 2 refused.
import fs from 'node:fs';
import path from 'node:path';
import tty from 'node:tty';
import { fileURLToPath } from 'node:url';
import { loadConfig, ConfigError } from './config.mjs';
import { maskId, redact } from './mask.mjs';
import { renderReport } from './report.mjs';
import { confirmAccountChange } from './confirm.mjs';

export const EXIT = { OK: 0, FAIL: 1, REFUSED: 2 };

/** @returns {import('./report.mjs').Check} */
export const chk = (id, title, status, detail, evidence) => ({ id, title, status, detail, ...(evidence ? { evidence } : {}) });

/** Prefix a tool name onto checks, for the combined verify report. */
export const prefixed = (tool, checks) => checks.map((c) => ({ ...c, id: `${tool}.${c.id}`, title: `${tool}: ${c.title}` }));

/** `measured` is the evidence entry that measured 3600 s for this grant, or null when none did. */
export function lifetimeCheck(lifetimeSec, measured) {
  const title = 'Access token lifetime';
  if (lifetimeSec === 3600) {
    return measured
      ? chk('lifetime', title, 'pass', 'exp − iat 3600 s (60 minutes), as documented [E-25] and measured', measured)
      : chk('lifetime', title, 'pass', 'exp − iat 3600 s (60 minutes), as documented [E-25]');
  }
  if (lifetimeSec == null) return chk('lifetime', title, 'warn', 'could not read the lifetime from the token or expires_in');
  return chk('lifetime', title, 'warn', `lifetime ${lifetimeSec} s; Oracle documents 60 minutes`, 'E-25');
}

export class Session {
  /**
   * Test seam: `input`, `isTTY` and the output streams are injectable. Users can't set them;
   * the command-line entry point always passes the real process streams.
   */
  constructor({ argv, env, stdout, stderr, input, isTTY, cwd, now }) {
    Object.assign(this, { argv, env, stdout, stderr, input, isTTY, cwd, now });
    this.secrets = [];
    this.ids = [];
  }

  flag(name) {
    const i = this.argv.indexOf(name);
    if (i >= 0) {
      const v = this.argv[i + 1];
      return v === undefined || v.startsWith('--') ? undefined : v;
    }
    const eq = this.argv.find((a) => a.startsWith(`${name}=`));
    return eq === undefined ? undefined : eq.slice(name.length + 1);
  }

  has(name) {
    return this.argv.includes(name);
  }

  /** Register strings that must never be printed: they print as `<redacted>`. */
  secret(...values) {
    for (const v of values) if (typeof v === 'string' && v.length > 0) this.secrets.push(v);
  }

  /** Register IDs that must print masked as `abcd…wxyz`. Very short values are skipped so they can't garble dates. */
  id(...values) {
    for (const v of values) if (typeof v === 'string' && v.length >= 8) this.ids.push(v);
  }

  safe(text) {
    let out = redact(text, this.secrets);
    for (const id of [...this.ids].sort((a, b) => b.length - a.length)) out = out.split(id).join(maskId(id));
    return out;
  }

  err(line) {
    this.stderr.write(`${this.safe(line)}\n`);
  }

  refuse(reason) {
    this.err(`refused: ${reason}`);
    return EXIT.REFUSED;
  }

  /** Config, or null after printing why it was refused. */
  load() {
    try {
      const cfg = loadConfig({ argv: this.argv, env: this.env });
      this.secret(cfg.clientSecret, cfg.refreshToken);
      this.id(cfg.clientId, cfg.certId);
      return cfg;
    } catch (e) {
      if (!(e instanceof ConfigError)) throw e;
      this.refuse(e.message);
      return null;
    }
  }

  /**
   * Account-change guard: needs `flagName`, an interactive terminal, and the account ID typed exactly.
   * Returns true to proceed; otherwise prints why and returns false. Nothing is sent before this passes.
   */
  async confirmChange(cfg, action, flagName = '--confirm') {
    if (!this.has(flagName)) {
      this.refuse(`${action} changes account ${cfg.accountId}; run again with ${flagName} to be asked for confirmation`);
      return false;
    }
    if (!this.isTTY) {
      this.refuse('this change needs an interactive terminal to type the account ID, and stdin is not one');
      return false;
    }
    const ok = await confirmAccountChange({ accountId: cfg.accountId, action: this.safe(action), input: this.input ?? process.stdin, output: this.stdout });
    if (!ok) this.refuse('the typed value did not match the account ID; nothing was sent');
    return ok;
  }

  /** Print the report (one redaction pass over all of it), write `--out`, and return the exit code. */
  finish(tool, cfg, checks, { defaultOut } = {}) {
    const md = this.safe(renderReport(checks, { tool, accountMasked: maskId(cfg.accountId), at: new Date(this.now).toISOString() }));
    this.stdout.write(md);
    const out = this.flag('--out') ?? defaultOut;
    if (out) {
      fs.writeFileSync(path.resolve(this.cwd, out), md, { mode: 0o600 });
      this.err(`report written to ${out}`);
    }
    return checks.some((c) => c.status === 'fail') ? EXIT.FAIL : EXIT.OK;
  }
}

/** The "Usage:" block from a script's header comment (the Usage line plus its indented continuation lines). */
export function usageFromHeader(metaUrl) {
  let lines;
  try {
    lines = fs.readFileSync(fileURLToPath(metaUrl), 'utf8').split('\n');
  } catch {
    return 'usage: see the header comment of this script';
  }
  const start = lines.findIndex((l) => /^\/\/\s*Usage:/.test(l));
  if (start < 0) return 'usage: see the header comment of this script';
  const out = [lines[start].replace(/^\/\/\s*/, '')];
  for (const l of lines.slice(start + 1)) {
    if (!/^\/\/ {2,}\S/.test(l)) break;
    out.push(l.replace(/^\/\/ ?/, ''));
  }
  return out.join('\n');
}

/**
 * Run `body(session)` with real process streams unless overridden. Unexpected errors print one redacted line.
 * With no arguments, or `--help`/`-h`, prints `opts.usageFile`'s Usage block and exits 2 before any config check.
 */
export async function runCli(opts, body) {
  const { usageFile, ...rest } = opts ?? {};
  const s = new Session({
    argv: process.argv.slice(2),
    env: process.env,
    stdout: process.stdout,
    stderr: process.stderr,
    isTTY: tty.isatty(0),
    cwd: process.cwd(),
    now: Date.now(),
    ...rest,
  });
  if (usageFile && (s.argv.length === 0 || s.has('--help') || s.has('-h'))) {
    s.stderr.write(`${usageFromHeader(usageFile)}\n`);
    return EXIT.REFUSED;
  }
  try {
    return await body(s);
  } catch (e) {
    s.err(`error: ${e?.message ?? String(e)}`);
    return EXIT.FAIL;
  }
}

/** When the module is the script node was started with, run it and set the exit code. */
export function runIfMain(metaUrl, run) {
  if (!process.argv[1]) return;
  let self;
  let started;
  try {
    self = fs.realpathSync(fileURLToPath(metaUrl));
    started = fs.realpathSync(process.argv[1]);
  } catch {
    return;
  }
  if (self === started) run().then((code) => (process.exitCode = code));
}
