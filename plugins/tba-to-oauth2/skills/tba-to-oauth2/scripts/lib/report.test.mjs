import test from 'node:test';
import assert from 'node:assert/strict';
import { renderReport } from './report.mjs';

test('renderReport makes a table and a summary line', () => {
  const md = renderReport([
    { id: 'a', title: 'Bit length', status: 'pass', detail: 'ok' },
    { id: 'b', title: 'Curve', status: 'fail', detail: 'bad | pipe\nnewline', evidence: 'E-45' },
    { id: 'c', title: 'Span', status: 'warn', detail: 'x' },
    { id: 'd', title: 'Key', status: 'skip', detail: 'none' },
  ], { accountMasked: 'abcd…wxyz', at: '2026-11-11T00:00:00Z', tool: 'check-cert' });
  assert.match(md, /\| Check \| Status \| Detail \| Evidence \|/);
  assert.match(md, /bad \\\| pipe newline/);
  assert.match(md, /\[E-45\]/);
  assert.match(md, /abcd…wxyz/);
  assert.match(md, /1 passed, 1 failed, 1 warning, 1 skipped/);
  assert.ok(!md.includes('\nnewline'));
});
