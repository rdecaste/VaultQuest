// ---- Vault core (shared by every Vault Make code module) -------------------
// Pasted in front of each module's own code by make/build.js. Pure functions
// only: Make code modules cannot call out, so every read comes in via `input`.

const TZ = 'Europe/Amsterdam';
const ROLLOVER_HOUR = 4; // the game week runs Monday 04:00 to Monday 04:00
const DAY_MS = 86400000;
const DS = {
  vaults: 'c390cc11-6939-47ea-922f-9eaf6bf3697f',
  events: '80c81e68-bf65-40ec-9e44-f3081c554709',
  weeks: '6610f72b-a296-468b-9170-d1099552cf2b',
  forms: 'a09891a3-1d76-4d86-a024-65ae31e8e0dd'
};

// ---- Notion property readers ----
const prop = (page, name) => ((page && page.properties) || {})[name] || {};
const num = (page, name) => { const v = prop(page, name).number; return (typeof v === 'number' && isFinite(v)) ? v : 0; };
const numOrNull = (page, name) => { const v = prop(page, name).number; return (typeof v === 'number' && isFinite(v)) ? v : null; };
const txt = (page, name) => (prop(page, name).rich_text || []).map(t => t.plain_text || (t.text && t.text.content) || '').join('');
const ttl = (page, name) => (prop(page, name).title || []).map(t => t.plain_text || (t.text && t.text.content) || '').join('');
const sel = (page, name) => (prop(page, name).select && prop(page, name).select.name) || '';
const dt = (page, name) => (prop(page, name).date && prop(page, name).date.start) || '';
const chk = (page, name) => prop(page, name).checkbox === true;
const url = (page, name) => prop(page, name).url || '';
const bare = id => String(id || '').replace(/-/g, '');

// ---- Notion property writers ----
const W = {
  title: s => ({ title: [{ type: 'text', text: { content: String(s || '').slice(0, 1900) } }] }),
  text: s => ({ rich_text: s ? [{ type: 'text', text: { content: String(s).slice(0, 1900) } }] : [] }),
  num: n => ({ number: (typeof n === 'number' && isFinite(n)) ? n : null }),
  sel: s => ({ select: s ? { name: s } : null }),
  date: s => ({ date: s ? { start: s } : null }),
  chk: b => ({ checkbox: !!b }),
  rel: id => ({ relation: id ? [{ id: id }] : [] })
};

// ---- Money ----
const round2 = n => Math.round((Number(n) || 0) * 100) / 100;
const money = (n, cur) => {
  const sym = { EUR: '€', USD: '$', GBP: '£' }[String(cur || 'EUR').toUpperCase()] || (String(cur || '') + ' ');
  const v = round2(n);
  const s = Math.abs(v).toFixed(v % 1 ? 2 : 0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (v < 0 ? '-' : '') + sym + s;
};

// ---- Time: Amsterdam wall clock ----
function localParts(ms) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).formatToParts(new Date(ms));
  const get = t => Number(parts.find(p => p.type === t).value);
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour'), mi: get('minute'), s: get('second') };
}
// UTC ms of an Amsterdam wall-clock time.
function zonedUtc(y, m, d, h) {
  let guess = Date.UTC(y, m - 1, d, h || 0);
  for (let i = 0; i < 2; i++) {
    const p = localParts(guess);
    const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
    guess += Date.UTC(y, m - 1, d, h || 0) - asUtc;
  }
  return guess;
}
const pad = n => String(n).padStart(2, '0');
const keyOf = (y, m, d) => y + '-' + pad(m) + '-' + pad(d);
const parseKey = k => { const [y, m, d] = String(k).slice(0, 10).split('-').map(Number); return { y, m, d }; };
const addDays = (k, n) => { const p = parseKey(k); const t = new Date(Date.UTC(p.y, p.m - 1, p.d) + n * DAY_MS); return keyOf(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()); };
const dowOf = k => { const p = parseKey(k); return (new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay() + 6) % 7; }; // Monday 0
const localDateKey = ms => { const p = localParts(ms); return keyOf(p.y, p.m, p.d); };
// The game day: the Amsterdam date, rolling over at 04:00 instead of midnight.
const gameDayKey = ms => { const p = localParts(ms); const k = keyOf(p.y, p.m, p.d); return p.h < ROLLOVER_HOUR ? addDays(k, -1) : k; };
const weekKeyOf = ms => { const g = gameDayKey(ms); return addDays(g, -dowOf(g)); };
const weekStartMs = k => { const p = parseKey(k); return zonedUtc(p.y, p.m, p.d, ROLLOVER_HOUR); };
const toMs = s => { const t = Date.parse(s); return isNaN(t) ? null : t; };
// Date-only values ("2026-10-01") mean that Amsterdam day, from its first game hour.
const dateMs = s => { if (!s) return null; if (String(s).length <= 10) { const p = parseKey(s); return zonedUtc(p.y, p.m, p.d, ROLLOVER_HOUR); } return toMs(s); };

// ---- Months ----
const monthKeyOf = ms => localDateKey(ms).slice(0, 7);
const addMonths = (mk, n) => { const [y, m] = mk.split('-').map(Number); const t = y * 12 + (m - 1) + n; return Math.floor(t / 12) + '-' + pad(t % 12 + 1); };
const monthDiff = (a, b) => { const [ay, am] = a.split('-').map(Number); const [by, bm] = b.split('-').map(Number); return (by * 12 + bm) - (ay * 12 + am); };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = mk => mk ? MONTHS[Number(mk.slice(5, 7)) - 1] + ' ' + mk.slice(0, 4) : '';

// ---- Campaign maths (spec §3 and §5) ----
function campaignOf(target, starting, core) {
  const remaining = Math.max(0, round2(target - starting));
  const months = core > 0 ? remaining / core : 0;
  const monthsNeeded = Math.max(0, Math.ceil(months - 1e-9));
  const weeks = remaining > 0 ? Math.max(1, Math.round(months * 52 / 12)) : 1;
  const forms = Math.min(12, Math.max(8, Math.round(weeks / 6)));
  const perEvolution = Math.max(1, Math.ceil(weeks / forms));
  return { remaining, months: round2(months), months_needed: monthsNeeded, weeks, forms, per_evolution: perEvolution };
}

// Baseline history: [{ from: 'YYYY-MM', core: 200 }], oldest first.
function parseHistory(s, fallbackCore, startMonth) {
  let h = [];
  try { h = JSON.parse(s || '[]'); } catch (e) { h = []; }
  h = (Array.isArray(h) ? h : []).filter(x => x && /^\d{4}-\d{2}$/.test(x.from) && Number(x.core) > 0).map(x => ({ from: x.from, core: Number(x.core) }));
  if (!h.length) h = [{ from: startMonth, core: fallbackCore }];
  return h.sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
}
const coreFor = (mk, hist) => { let c = hist[0].core; for (const e of hist) if (e.from <= mk) c = e.core; return c; };

// Whole months elapsed since the goal started (spec §14: "after 3 completed months").
function completedMonths(startIso, nowMs) {
  const s = dateMs(startIso); if (s === null || nowMs < s) return 0;
  const sp = localParts(s), np = localParts(nowMs);
  let n = (np.y * 12 + np.m) - (sp.y * 12 + sp.m);
  if (np.d < sp.d) n -= 1;
  return Math.max(0, n);
}
// What the plan says should be in the Vault by now. Only completed months
// count, each at the Core Charge in force that month, so later Overcharges
// or baseline changes never rewrite past expectations.
function expectedSavings(v, nowMs) {
  const startMonth = monthKeyOf(dateMs(v.started_at));
  const done = completedMonths(v.started_at, nowMs);
  let sum = v.starting;
  for (let i = 0; i < done; i++) sum += coreFor(addMonths(startMonth, i), v.history);
  return round2(Math.min(v.target, sum));
}
// The month the plan finishes funding: follow the baseline from today's
// expected savings. Month level on purpose (spec §15).
function baselineCompletionMonth(v, nowMs) {
  const startMonth = monthKeyOf(dateMs(v.started_at));
  const done = completedMonths(v.started_at, nowMs);
  let saved = expectedSavings(v, nowMs);
  let mk = addMonths(startMonth, done);
  for (let guard = 0; guard < 600; guard++) {
    const c = coreFor(mk, v.history);
    if (c <= 0) return null;
    saved += c;
    if (saved >= v.target - 0.005) return mk;
    mk = addMonths(mk, 1);
  }
  return null;
}
// The month the Vault is on track to be fully funded from the real balance,
// assuming the current Core Charge keeps arriving. This month's unpaid part
// of the Core Charge counts for this month.
function projectedCompletionMonth(v, nowMs) {
  const nowMonth = monthKeyOf(nowMs);
  const startMonth = monthKeyOf(dateMs(v.started_at));
  if (v.balance >= v.target - 0.005) return nowMonth;
  const core = v.core;
  if (!(core > 0)) return null;
  const base = nowMonth < startMonth ? startMonth : nowMonth;
  const paid = base === nowMonth && v.core_month === nowMonth ? v.core_paid : 0;
  const thisMonth = Math.max(0, core - paid);
  const rest = v.target - v.balance - thisMonth;
  if (rest <= 0.005) return base;
  return addMonths(base, Math.ceil(rest / core - 1e-9));
}

// Read a Vault page into a plain object.
function vaultOf(page) {
  if (!page || !page.id) return null;
  const started = dt(page, 'Goal Started At');
  const core = num(page, 'Core Charge');
  const startMonth = started ? monthKeyOf(dateMs(started)) : monthKeyOf(Date.now());
  return {
    id: page.id,
    name: ttl(page, 'Vault'),
    goal: txt(page, 'Goal'),
    status: sel(page, 'Status'),
    currency: txt(page, 'Currency') || 'EUR',
    target: num(page, 'Target Amount'),
    starting: num(page, 'Starting Amount'),
    balance: num(page, 'Current Balance'),
    core: core,
    original_core: num(page, 'Original Core Charge') || core,
    started_at: started,
    baseline_completion: (dt(page, 'Baseline Completion') || '').slice(0, 7),
    weeks: num(page, 'Expected Campaign Weeks'),
    forms: num(page, 'Major Evolution Count') || 8,
    per_evolution: num(page, 'Weeks Per Evolution') || 1,
    tier: num(page, 'Current Tier') || 1,
    charge: num(page, 'Evolution Charge'),
    streak: num(page, 'Defense Streak'),
    best_streak: num(page, 'Best Streak'),
    perfect: num(page, 'Perfect Defenses'),
    lifetime_over: num(page, 'Lifetime Overcharge'),
    last_evaluated: (dt(page, 'Last Evaluated Week') || '').slice(0, 10),
    opened_at: dt(page, 'Opened At'),
    core_month: txt(page, 'Core Month'),
    core_paid: num(page, 'Core Paid This Month'),
    over_month: num(page, 'Overcharge This Month'),
    breach_week: txt(page, 'Breach Week'),
    week_breaches: num(page, 'Week Breaches'),
    last_breach_at: dt(page, 'Last Breach At'),
    history: parseHistory(txt(page, 'Baseline History'), core, startMonth),
    created_at: page.created_time || ''
  };
}

// ---- Seeded randomness, so every Monday's loot is reproducible ----
function hashOf(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rngOf(seed) { let a = hashOf(seed); return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const pick = (r, list) => list[Math.floor(r() * list.length)];

const RARITIES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];
// Weekly loot drop for a Perfect Defense. A longer streak rolls better; a
// tier-up week always drops at least Epic.
function lootFor(seed, streak, tierUp) {
  const r = rngOf('loot:' + seed);
  const bonus = Math.min(12, streak) * 0.012;
  const roll = r();
  let rarity = roll < 0.01 + bonus / 4 ? 'Mythic' : roll < 0.05 + bonus / 2 ? 'Legendary' : roll < 0.14 + bonus ? 'Epic' : roll < 0.32 + bonus ? 'Rare' : roll < 0.62 ? 'Uncommon' : 'Common';
  if (tierUp && RARITIES.indexOf(rarity) < 3) rarity = 'Epic';
  const prefix = pick(r, ['Patient', 'Unbreached', 'Stubborn', 'Frugal', 'Humming', 'Iron-Willed', 'Compounding', 'Glinting', 'Disciplined', 'Overclocked', 'Vigilant', 'Unimpressed', 'Sandblasted', 'Tax-Free', 'Rustproof', 'Unshakeable']);
  const base = pick(r, ['Rail Pistol', 'Scattergun', 'Shield Capacitor', 'Grenade Mod', 'Relic', 'Plasma Carbine', 'Vault Compass', 'Energy Cell', 'Longshot Lens', 'Holo Badge', 'Salvage Drone', 'Pocket Reactor', 'Sentry Beacon', 'Combat Visor', 'Piggy Cannon', 'Sand Skiff Key']);
  const suffix = pick(r, ['of the Long Game', 'of Quiet Mondays', 'of Deferred Joy', 'of the Iron Wallet', 'of Seven Sunrises', 'of Unspent Gold', 'of Mild Smugness', 'of the Closed Door', 'of Future Loot', 'of Compound Interest', '', '', '']);
  const flavor = pick(r, [
    'Still warm from the forge.', 'Smells faintly of ozone and restraint.', 'WARDEN insists it is not for sale.',
    'Found wedged behind the core. Nobody knows how.', 'Hums louder when you walk past a shop.', 'A raider dropped it while fleeing.',
    'Engraved: "Not today."', 'Glows brighter every Monday.', 'Came with a tiny instruction manual that just says "wait".',
    'Certified 100% impulse-proof.', 'Rattles like coins when shaken.', 'Its serial number is your streak.'
  ]);
  return { name: [prefix, base, suffix].filter(Boolean).join(' '), rarity: rarity, flavor: flavor };
}
