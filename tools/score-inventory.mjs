// Scores a tba-to-oauth2 inventory (docs/tba-to-oauth2-inventory.json) against a
// fixture's ANSWER_KEY.json.
//
// - A reported entry matches a key entry in the same file within 2 lines. Sites match
//   sites and credentials match credentials; each reported entry satisfies at most one
//   key entry (closest line first, same kind breaking ties).
// - A key entry with no match, in a file the inventory lists under `notInspected`
//   (the scan couldn't read it and said so), is blockedReported: reported separately,
//   not a miss. A blocked file the inventory doesn't list is still a miss.
// - recall = matched key sites and credentials / (all of them - blockedReported).
//   recallWithoutEnv is the same over key entries outside `.env*` files.
// - Each key integration is paired with the inventory integration holding most of its
//   matched sites; a different outcome, or no such integration, is an outcome mismatch.
// - A reported site or credential that matches no key entry is a false positive
//   (decoysFlagged) when its file holds a keyed decoy or holds no keyed NetSuite entry.
//   Otherwise it is an unkeyed extra: reported, but it doesn't fail the run.
// - Inventory `excluded` entries are never scored.
// pass = recall 1, no decoys flagged, no outcome mismatches.

const TOLERANCE = 2;

const site = ({ file, line, kind }) => ({ file, line, kind });
const credential = ({ file, line, name }) => ({ file, line, name });

// One-to-one matching of reported entries to key entries. Returns, for each key index,
// the index of its reported entry (or -1), and the set of reported indexes used.
function match(keyEntries, reported) {
  const pairs = [];
  keyEntries.forEach((k, ki) => reported.forEach((r, ri) => {
    const diff = Math.abs(r.line - k.line);
    if (r.file === k.file && diff <= TOLERANCE) pairs.push({ ki, ri, diff, sameKind: r.kind === k.kind });
  }));
  pairs.sort((a, b) => a.diff - b.diff || Number(b.sameKind) - Number(a.sameKind) || a.ki - b.ki || a.ri - b.ri);
  const keyTo = keyEntries.map(() => -1);
  const used = new Set();
  for (const { ki, ri } of pairs) {
    if (keyTo[ki] !== -1 || used.has(ri)) continue;
    keyTo[ki] = ri;
    used.add(ri);
  }
  return { keyTo, used };
}

const asArray = (v) => (Array.isArray(v) ? v : []);
const validEntry = (e) => e && typeof e.file === 'string' && Number.isInteger(e.line);

export function scoreInventory(inventory, key) {
  const invIntegrations = asArray(inventory?.integrations).filter((i) => i && typeof i === 'object');

  // Flatten the inventory, remembering which integration each entry came from.
  const repSites = [];
  const repCreds = [];
  invIntegrations.forEach((integ, ii) => {
    for (const s of asArray(integ.sites)) if (validEntry(s)) repSites.push({ ...site(s), ii });
    for (const c of asArray(integ.credentialLocations)) if (validEntry(c)) repCreds.push({ ...credential(c), ii });
  });

  const keySites = [];
  const keyCreds = [];
  key.integrations.forEach((integ, ki) => {
    for (const s of integ.sites) keySites.push({ ...site(s), ki });
    for (const c of integ.credentials) keyCreds.push({ ...credential(c), ki });
  });

  const sitesMatch = match(keySites, repSites);
  const credsMatch = match(keyCreds, repCreds);

  const notInspected = new Set(asArray(inventory?.notInspected).map((n) => n?.path).filter((p) => typeof p === 'string'));
  const keyed = [
    ...keySites.map((e, i) => ({ entry: site(e), found: sitesMatch.keyTo[i] !== -1 })),
    ...keyCreds.map((e, i) => ({ entry: credential(e), found: credsMatch.keyTo[i] !== -1 })),
  ];
  const blocked = (k) => !k.found && notInspected.has(k.entry.file);
  const missed = keyed.filter((k) => !k.found && !blocked(k)).map((k) => k.entry);
  const blockedReported = keyed.filter(blocked).map((k) => k.entry);
  const recallOf = (entries) => {
    const counted = entries.filter((k) => !blocked(k));
    return counted.length === 0 ? 1 : counted.filter((k) => k.found).length / counted.length;
  };
  const isEnvFile = (file) => file.split('/').pop().startsWith('.env');
  const recall = recallOf(keyed);
  const recallWithoutEnv = recallOf(keyed.filter((k) => !isEnvFile(k.entry.file)));

  const outcomeMismatches = [];
  key.integrations.forEach((k, ki) => {
    const overlap = new Map();
    keySites.forEach((s, i) => {
      const ri = sitesMatch.keyTo[i];
      if (s.ki === ki && ri !== -1) overlap.set(repSites[ri].ii, (overlap.get(repSites[ri].ii) ?? 0) + 1);
    });
    let best = -1;
    for (const [ii, n] of overlap) if (best === -1 || n > overlap.get(best)) best = ii;
    if (best === -1) {
      outcomeMismatches.push(`${k.id}: no matching integration in the inventory (expected ${k.outcome})`);
    } else if (invIntegrations[best].outcome !== k.outcome) {
      outcomeMismatches.push(`${k.id}: expected ${k.outcome}, got ${invIntegrations[best].outcome} (inventory integration ${invIntegrations[best].id})`);
    }
  });

  const decoyFiles = new Set(asArray(key.decoys).map((d) => d.file));
  const keyedFiles = new Set([...keySites, ...keyCreds].map((e) => e.file));
  const decoysFlagged = [];
  const unkeyedExtras = [];
  const sortUnmatched = (reported, used, strip) => reported.forEach((r, ri) => {
    if (used.has(ri)) return;
    const entry = strip(r);
    if (decoyFiles.has(r.file) || !keyedFiles.has(r.file)) decoysFlagged.push(entry);
    else unkeyedExtras.push(entry);
  });
  sortUnmatched(repSites, sitesMatch.used, site);
  sortUnmatched(repCreds, credsMatch.used, credential);

  return {
    recall,
    recallWithoutEnv,
    missed,
    blockedReported,
    decoysFlagged,
    unkeyedExtras,
    outcomeMismatches,
    pass: recall === 1 && decoysFlagged.length === 0 && outcomeMismatches.length === 0,
  };
}
