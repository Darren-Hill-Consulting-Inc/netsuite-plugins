const cell = (s) => String(s ?? '').replace(/\r?\n/g, ' ').replace(/\|/g, '\\|');

/** @typedef {{id:string,title:string,status:'pass'|'fail'|'warn'|'skip',detail:string,evidence?:string}} Check */

export function renderReport(checks, meta) {
  const rows = checks.map((c) => `| ${cell(c.title)} | ${c.status} | ${cell(c.detail)} | ${c.evidence ? `[${c.evidence}]` : ''} |`);
  const n = (s) => checks.filter((c) => c.status === s).length;
  const w = n('warn');
  return [
    `# ${meta.tool} report`,
    '',
    `Account: ${meta.accountMasked} | Run at: ${meta.at}`,
    '',
    '| Check | Status | Detail | Evidence |',
    '|---|---|---|---|',
    ...rows,
    '',
    `${n('pass')} passed, ${n('fail')} failed, ${w} ${w === 1 ? 'warning' : 'warnings'}, ${n('skip')} skipped`,
    '',
  ].join('\n');
}
