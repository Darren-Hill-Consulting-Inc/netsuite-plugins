import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreInventory } from './score-inventory.mjs';

// A small answer key: one unattended TBA integration, one decoy file.
const KEY = {
  integrations: [
    {
      id: 'order-bridge',
      outcome: 'm2m',
      attended: false,
      sites: [
        { file: 'src/lib/nsAuth.js', line: 58, kind: 'tba-signing' },
        { file: 'src/clients/orderRestlet.js', line: 22, kind: 'call-restlet' },
        { file: 'src/clients/orderRestlet.js', line: 40, kind: 'call-restlet' },
      ],
      credentials: [
        { file: '.env', line: 2, name: 'NS_CONSUMER_KEY' },
        { file: '.env', line: 3, name: 'NS_CONSUMER_SECRET' },
      ],
    },
  ],
  decoys: [{ file: 'src/xero/xeroClient.js', line: 23, why: 'Xero signer' }],
};

// Builds an inventory that reports the key exactly; `patch` edits it.
function inventory(patch = (inv) => inv) {
  const inv = {
    integrations: KEY.integrations.map((k) => ({
      id: k.id,
      name: 'Order bridge',
      outcome: k.outcome,
      attended: k.attended,
      endpoints: [],
      role: '',
      credentialLocations: k.credentials.map((c) => ({ ...c })),
      sites: k.sites.map((s) => ({ ...s })),
      effort: 'S',
      effortReasons: ['small'],
      risks: [],
    })),
    excluded: [],
    outsideRepo: [],
  };
  return patch(inv) ?? inv;
}

test('perfect inventory passes', () => {
  const r = scoreInventory(inventory(), KEY);
  assert.equal(r.recall, 1);
  assert.deepEqual(r.missed, []);
  assert.deepEqual(r.decoysFlagged, []);
  assert.deepEqual(r.outcomeMismatches, []);
  assert.deepEqual(r.unkeyedExtras, []);
  assert.equal(r.pass, true);
});

test('one missing site lowers recall and is listed in missed', () => {
  const r = scoreInventory(inventory((inv) => { inv.integrations[0].sites.splice(1, 1); }), KEY);
  assert.equal(r.recall, 4 / 5);
  assert.deepEqual(r.missed, [{ file: 'src/clients/orderRestlet.js', line: 22, kind: 'call-restlet' }]);
  assert.equal(r.pass, false);
});

test('a missing credential lowers recall too', () => {
  const r = scoreInventory(inventory((inv) => { inv.integrations[0].credentialLocations.pop(); }), KEY);
  assert.equal(r.recall, 4 / 5);
  assert.deepEqual(r.missed, [{ file: '.env', line: 3, name: 'NS_CONSUMER_SECRET' }]);
  assert.equal(r.pass, false);
});

test('a keyed decoy reported as a site is flagged', () => {
  const decoy = { file: 'src/xero/xeroClient.js', line: 24, kind: 'tba-signing' };
  const r = scoreInventory(inventory((inv) => { inv.integrations[0].sites.push(decoy); }), KEY);
  assert.equal(r.recall, 1);
  assert.deepEqual(r.decoysFlagged, [decoy]);
  assert.equal(r.pass, false);
});

test('any unmatched hit in a file holding a keyed decoy is flagged', () => {
  const hit = { file: 'src/xero/xeroClient.js', line: 90, kind: 'call-rest' };
  const r = scoreInventory(inventory((inv) => { inv.integrations[0].sites.push(hit); }), KEY);
  assert.deepEqual(r.decoysFlagged, [hit]);
  assert.equal(r.pass, false);
});

test('a hit in a file with no keyed NetSuite entry is flagged, sites and credentials alike', () => {
  const site = { file: 'src/util/log.js', line: 4, kind: 'call-rest' };
  const cred = { file: 'config/other.json', line: 3, name: 'apiKey' };
  const r = scoreInventory(inventory((inv) => {
    inv.integrations[0].sites.push(site);
    inv.integrations[0].credentialLocations.push(cred);
  }), KEY);
  assert.deepEqual(r.decoysFlagged, [site, cred]);
  assert.equal(r.pass, false);
});

test('an extra hit in a file with keyed NetSuite entries is reported but does not fail', () => {
  const extra = { file: 'src/clients/orderRestlet.js', line: 31, kind: 'call-restlet' };
  const r = scoreInventory(inventory((inv) => { inv.integrations[0].sites.push(extra); }), KEY);
  assert.deepEqual(r.unkeyedExtras, [extra]);
  assert.deepEqual(r.decoysFlagged, []);
  assert.equal(r.pass, true);
});

test('excluded entries never count against the run', () => {
  const r = scoreInventory(inventory((inv) => {
    inv.excluded.push({ file: 'src/xero/xeroClient.js', line: 23, why: 'Xero host' });
  }), KEY);
  assert.deepEqual(r.decoysFlagged, []);
  assert.equal(r.pass, true);
});

test('wrong outcome is a mismatch', () => {
  const r = scoreInventory(inventory((inv) => { inv.integrations[0].outcome = 'auth-code-pkce'; }), KEY);
  assert.equal(r.recall, 1);
  assert.equal(r.outcomeMismatches.length, 1);
  assert.match(r.outcomeMismatches[0], /order-bridge.*m2m.*auth-code-pkce/);
  assert.equal(r.pass, false);
});

test('a key integration with no overlapping inventory integration is a mismatch', () => {
  const r = scoreInventory({ integrations: [], excluded: [], outsideRepo: [] }, KEY);
  assert.equal(r.recall, 0);
  assert.equal(r.outcomeMismatches.length, 1);
  assert.match(r.outcomeMismatches[0], /order-bridge.*no matching/);
  assert.equal(r.pass, false);
});

test('outcome is taken from the inventory integration with the most site overlap', () => {
  const r = scoreInventory(inventory((inv) => {
    const [main] = inv.integrations;
    // A second integration holding one of the three key sites, with another outcome.
    const stray = { ...main, id: 'stray', outcome: 'rewrite-rest', sites: [main.sites.pop()], credentialLocations: [] };
    inv.integrations.push(stray);
  }), KEY);
  assert.equal(r.recall, 1);
  assert.deepEqual(r.outcomeMismatches, []);
  assert.equal(r.pass, true);
});

test('lines within 2 match; 3 away does not', () => {
  const near = scoreInventory(inventory((inv) => {
    inv.integrations[0].sites[0].line = 60;
    inv.integrations[0].credentialLocations[0].line = 1; // 1 away from line 2
  }), KEY);
  assert.equal(near.recall, 1);
  assert.equal(near.pass, true);

  const far = scoreInventory(inventory((inv) => { inv.integrations[0].sites[0].line = 61; }), KEY);
  assert.equal(far.recall, 4 / 5);
  assert.deepEqual(far.missed, [{ file: 'src/lib/nsAuth.js', line: 58, kind: 'tba-signing' }]);
  // Line 61 is in a file with a keyed entry, so it is an extra, not a false positive.
  assert.deepEqual(far.unkeyedExtras, [{ file: 'src/lib/nsAuth.js', line: 61, kind: 'tba-signing' }]);
});

test('one reported entry satisfies at most one key entry', () => {
  // Key lines 2 and 3 in .env; a single report at line 2 cannot cover both.
  const r = scoreInventory(inventory((inv) => {
    inv.integrations[0].credentialLocations = [{ file: '.env', line: 2, name: 'NS_CONSUMER_KEY' }];
  }), KEY);
  assert.equal(r.recall, 4 / 5);
  assert.deepEqual(r.missed, [{ file: '.env', line: 3, name: 'NS_CONSUMER_SECRET' }]);
});

test('a site and a credential do not satisfy each other', () => {
  const r = scoreInventory(inventory((inv) => {
    inv.integrations[0].sites.shift();
    inv.integrations[0].credentialLocations.push({ file: 'src/lib/nsAuth.js', line: 58, name: 'consumerSecret' });
  }), KEY);
  assert.equal(r.recall, 4 / 5);
  assert.deepEqual(r.missed, [{ file: 'src/lib/nsAuth.js', line: 58, kind: 'tba-signing' }]);
});

test('a missing or malformed inventory scores zero instead of throwing', () => {
  for (const bad of [null, {}, { integrations: 'x' }]) {
    const r = scoreInventory(bad, KEY);
    assert.equal(r.recall, 0);
    assert.equal(r.pass, false);
  }
});

test('key entries in a file listed under notInspected are blockedReported, not misses', () => {
  const r = scoreInventory(inventory((inv) => {
    inv.integrations[0].credentialLocations = [];
    inv.notInspected = [{ path: '.env', reason: 'read denied by a permission rule' }];
  }), KEY);
  assert.deepEqual(r.missed, []);
  assert.deepEqual(r.blockedReported, [
    { file: '.env', line: 2, name: 'NS_CONSUMER_KEY' },
    { file: '.env', line: 3, name: 'NS_CONSUMER_SECRET' },
  ]);
  assert.equal(r.recall, 1);
  assert.equal(r.recallWithoutEnv, 1);
  assert.equal(r.pass, true);
});

test('a blocked file that is not listed under notInspected is still a miss', () => {
  const r = scoreInventory(inventory((inv) => {
    inv.integrations[0].credentialLocations = [];
    inv.notInspected = [{ path: 'config/other.json', reason: 'denied' }];
  }), KEY);
  assert.deepEqual(r.blockedReported, []);
  assert.equal(r.missed.length, 2);
  assert.equal(r.recall, 3 / 5);
  // Leaving .env files out, every other key entry was found.
  assert.equal(r.recallWithoutEnv, 1);
  assert.equal(r.pass, false);
});

test('recallWithoutEnv leaves out key entries in .env files only', () => {
  const r = scoreInventory(inventory((inv) => { inv.integrations[0].sites.shift(); }), KEY);
  assert.equal(r.recall, 4 / 5);
  assert.equal(r.recallWithoutEnv, 2 / 3);
});

test('a keyed code file listed under notInspected is still a miss', () => {
  const r = scoreInventory(inventory((inv) => {
    inv.integrations[0].sites.shift();
    inv.notInspected = [{ path: 'src/lib/nsAuth.js', reason: 'read denied' }];
  }), KEY);
  assert.deepEqual(r.blockedReported, []);
  assert.deepEqual(r.missed, [{ file: 'src/lib/nsAuth.js', line: 58, kind: 'tba-signing' }]);
  assert.equal(r.recall, 4 / 5);
  assert.equal(r.pass, false);
});

test('only .env and .env.* files can be blockedReported', () => {
  const key = {
    integrations: [{
      id: 'x', outcome: 'm2m', attended: false,
      sites: [{ file: 'a.js', line: 1, kind: 'call-rest' }],
      credentials: [
        { file: 'svc/.env.production', line: 1, name: 'A' },
        { file: 'svc/.envrc', line: 1, name: 'B' },
        { file: 'svc/env', line: 1, name: 'C' },
      ],
    }],
    decoys: [],
  };
  const inv = {
    integrations: [{ id: 'x', outcome: 'm2m', sites: [{ file: 'a.js', line: 1, kind: 'call-rest' }], credentialLocations: [] }],
    notInspected: ['svc/.env.production', 'svc/.envrc', 'svc/env'].map((path) => ({ path, reason: 'denied' })),
  };
  const r = scoreInventory(inv, key);
  assert.deepEqual(r.blockedReported.map((e) => e.file), ['svc/.env.production']);
  assert.deepEqual(r.missed.map((e) => e.file), ['svc/.envrc', 'svc/env']);
  assert.equal(r.pass, false);
});
