const assert = require('assert');
process.env.VAULT_PASSCODE = 'test';
const built = require('../build.js');
const run = (name, input) => new Function('input', built[name])(input);

// Fake Notion page from a create body.
function pageFrom(body, id) {
  const props = JSON.parse(JSON.stringify(body.properties));
  for (const k of Object.keys(props)) {
    const p = props[k];
    if (p.title) p.title = p.title.map(t => ({ plain_text: t.text.content }));
    if (p.rich_text) p.rich_text = p.rich_text.map(t => ({ plain_text: t.text.content }));
  }
  return { id: id || 'vault-1', properties: props, created_time: '2026-09-27T08:00:00.000Z' };
}
function applyPatch(page, patch) {
  const p = pageFrom({ properties: JSON.parse(patch).properties }, page.id);
  Object.assign(page.properties, p.properties);
  return page;
}

// --- create: spec example
let r = run('action', { passcode: 'test', action: 'create', name: 'Gaming PC Vault', goal: 'Gaming PC', target: 3000, starting: 0, core: 200, start_date: '2026-10-01', currency: 'EUR', now: '2026-09-27T09:00:00Z' });
assert.equal(r.op, 'create', r.message);
const fb = JSON.parse(r.feedback);
console.log('create:', r.message, fb.baseline_completion);
assert.equal(fb.campaign.months_needed, 15);
assert.equal(fb.campaign.weeks, 65);
assert.equal(fb.campaign.forms, 11);
assert.equal(fb.campaign.per_evolution, 6);
assert.equal(fb.baseline_completion, '2027-12');
let vault = pageFrom(JSON.parse(r.vault_body));
vault.properties.Status = { select: { name: 'Active' } };

// bad passcode
assert.equal(run('action', { passcode: 'x', action: 'inject', amount: 10, vault }).code, 'bad_passcode');
// second create rejected
assert.equal(run('action', { passcode: 'test', action: 'create', name: 'X', target: 10, core: 1, vault }).code, 'active_exists');

// --- inject scenarios (spec §12)
const inj = (amount, now) => { const x = run('action', { passcode: 'test', action: 'inject', amount, vault, now }); assert.equal(x.op, 'update', x.message); applyPatch(vault, x.vault_patch); return x; };
r = inj(300, '2026-10-02T10:00:00Z'); let f = JSON.parse(r.feedback);
console.log('A', f.core, f.over, f.projected, f.months_earlier); assert.equal(f.core, 200); assert.equal(f.over, 100);
r = inj(150, '2026-10-05T10:00:00Z'); f = JSON.parse(r.feedback);
console.log('B', f.core, f.over); assert.equal(f.core, 0); assert.equal(f.over, 150);
r = inj(100, '2026-11-03T10:00:00Z'); f = JSON.parse(r.feedback); assert.equal(f.core, 100); assert.equal(f.over, 0);
r = inj(200, '2026-11-20T10:00:00Z'); f = JSON.parse(r.feedback);
console.log('C', f.core, f.over, 'balance', f.balance, 'adv', f.charge_advantage, 'proj', f.projected); assert.equal(f.core, 100); assert.equal(f.over, 100);
assert.equal(r.events.length, 2);

// --- breach
const br = run('action', { passcode: 'test', action: 'breach', amount: 50, reason: 'Impulse purchase', vault, now: '2026-11-26T10:00:00Z' });
assert.equal(br.code, 'not_confirmed');
const br2 = run('action', { passcode: 'test', action: 'breach', amount: 50, reason: 'Impulse purchase', confirm: 'BREACH', vault, now: '2026-11-26T10:00:00Z' });
assert.equal(br2.code, 'breach'); applyPatch(vault, br2.vault_patch);
console.log('breach', br2.feedback);

// --- monday: from start to 2026-12-01 (Tuesday). Week of 11-23 breached.
const breachEvent = { id: 'e1', properties: { Type: { select: { name: 'BREACH' } }, 'Occurred At': { date: { start: '2026-11-26T10:00:00.000Z' } } } };
let m = run('monday', { vault, breaches: [breachEvent], forms: [], now: '2026-12-01T05:00:00Z' });
console.log('monday:', m.weeks, 'weeks;', m.summary);
applyPatch(vault, m.vault_patch);
// Weeks: 09-28 (start 10-01 inside), 10-05, 10-12, 10-19, 10-26, 11-02, 11-09, 11-16 perfect (8), 11-23 breached. Week 11-30 is current.
assert.equal(m.weeks, 9);
assert.equal(m.tier, 2); // 6 perfect -> tier 2, then 2 more -> charge 2, then breach
assert.equal(vault.properties['Evolution Charge'].number, 2);
assert.equal(vault.properties['Defense Streak'].number, 0);
assert.equal(vault.properties['Perfect Defenses'].number, 8);
// idempotent re-run
m = run('monday', { vault, breaches: [breachEvent], forms: [], now: '2026-12-01T06:00:00Z' });
assert.equal(m.creates.length, 0);
// Monday 03:59 local is still last week's Sunday game day: nothing new
m = run('monday', { vault, breaches: [], forms: [], now: '2026-12-07T02:59:00Z' });
assert.equal(m.creates.length, 0);
m = run('monday', { vault, breaches: [], forms: [], now: '2026-12-07T03:05:00Z' });
assert.equal(m.weeks, 1); console.log('next monday:', m.summary);

// --- baseline change
const bc = run('action', { passcode: 'test', action: 'baseline', core: 300, vault, now: '2026-12-02T10:00:00Z' });
console.log('baseline', bc.feedback); applyPatch(vault, bc.vault_patch);

// --- publish
const p = run('publish', { vault, forms: [], events: [], weeks: [], archive: [], existing: '', now: '2026-12-02T10:00:00Z' });
const s = JSON.parse(p.json);
console.log('publish vault:', JSON.stringify(s.vault, null, 0).slice(0, 900));
// expected after 2 completed months (Oct, Nov) = 400; actual 700 - 50 = 650... +advantage 250
assert.equal(s.vault.expected_now, 400);
assert.equal(s.vault.balance, 700);
assert.equal(s.vault.charge_advantage, 300);

// --- open requires funding
assert.equal(run('action', { passcode: 'test', action: 'open', vault, now: '2026-12-02T10:00:00Z' }).code, 'not_funded');

// --- trophies: newest Epic-or-better loot becomes camp props, three at most
const wk = loot => ({ properties: { Loot: { rich_text: loot ? [{ plain_text: loot }] : [] } } });
let t = run('trophies', { weeks: [wk('Rare: Patient Relic'), wk('Epic: Frugal Rail Pistol of the Long Game'), wk(''), wk('Mythic: Glinting Piggy Cannon'),
  wk('Legendary: Stubborn Salvage Drone of Quiet Mondays'), wk('Epic: Vigilant Energy Cell')] });
console.log('trophies:', t.line);
assert.equal(t.count, 3);
assert.ok(t.line.includes('rail pistol') && t.line.includes('piggy bank') && t.line.includes('salvage drone') && !t.line.includes('energy cells'));
assert.equal(run('trophies', { weeks: [wk('Common: Frugal Relic')] }).line, '');
assert.equal(run('trophies', {}).line, '');
console.log('ALL OK');
