// Writes a sample data.json for local previews: node make/test/mock.js > /tmp/x/data.json
process.env.VAULT_PASSCODE = 'test';
const built = require('../build.js');
const run = (name, input) => new Function('input', built[name])(input);
function pageFrom(body, id) {
  const props = JSON.parse(JSON.stringify(body.properties));
  for (const k of Object.keys(props)) { const p = props[k]; if (p.title) p.title = p.title.map(t => ({ plain_text: t.text.content })); if (p.rich_text) p.rich_text = p.rich_text.map(t => ({ plain_text: t.text.content })); }
  return { id: id || 'vault-1', properties: props, created_time: '2026-09-27T08:00:00.000Z' };
}
const apply = (page, patch) => Object.assign(page.properties, pageFrom({ properties: JSON.parse(patch).properties }).properties);
const now = process.argv[2] || new Date().toISOString();
let r = run('action', { passcode: 'test', action: 'create', name: 'Gaming PC Vault', goal: 'Gaming PC', target: 3000, starting: 0, core: 200, start_date: '2026-08-03', now: '2026-08-03T09:00:00Z' });
const vault = pageFrom(JSON.parse(r.vault_body)); vault.properties.Status = { select: { name: 'Active' } };
const events = [];
let n = 0;
const rec = (x, at) => { apply(vault, x.vault_patch); for (const e of x.events) { const b = JSON.parse(e); const p = pageFrom(b, 'ev' + (n++)); events.push(p); } };
rec(run('action', { passcode: 'test', action: 'inject', amount: 200, vault, now: '2026-08-04T09:00:00Z' }));
rec(run('action', { passcode: 'test', action: 'inject', amount: 450, vault, now: '2026-09-02T09:00:00Z' }));
const breach = run('action', { passcode: 'test', action: 'breach', amount: 40, confirm: 'BREACH', reason: 'Impulse purchase', vault, now: '2026-08-20T09:00:00Z' }); rec(breach);
const m = run('monday', { vault, breaches: events.filter(e => e.properties.Type.select.name === 'BREACH').map(e => ({ properties: { Type: e.properties.Type, 'Occurred At': e.properties['Occurred At'] } })), forms: [], now: '2026-09-28T05:00:00Z' });
apply(vault, m.vault_patch);
for (const c of m.creates) { const b = JSON.parse(c); if (b.parent.data_source_id.startsWith('80c8')) events.push(pageFrom(b, 'ev' + (n++))); }
if (process.argv[3] === 'breach') rec(run('action', { passcode: 'test', action: 'breach', amount: 25, confirm: 'BREACH', reason: 'Other', vault, now: '2026-09-30T09:00:00Z' }));
const FORMS = [['Salvaged Vault','Common'],['Reinforced Vault','Common'],['Powered Vault','Uncommon'],['Armored Vault','Uncommon'],['Energized Vault','Rare'],['Guardian Vault','Rare'],['Ancient Vault','Epic'],['Legendary Vault','Legendary'],['Sovereign Vault','Legendary'],['Celestial Vault','Legendary'],['Singularity Vault','Mythic'],['Eternal Vault','Mythic']];
const forms = FORMS.map(([name, rar], i) => ({ id: 'f' + i, properties: { Form: { title: [{ plain_text: name }] }, Tier: { number: i + 1 }, Rarity: { select: { name: rar } }, Lore: { rich_text: [{ plain_text: 'Lore of ' + name + '. WARDEN is watching.' }] } } }));
const p = run('publish', { vault, forms, events: events.reverse(), weeks: [], archive: [], existing: '', now });
process.stdout.write(p.json);
