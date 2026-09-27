// ---- Vault — Publish Dashboard: the one builder of VaultQuest/data.json ----
// Inputs: vault (Active Vault page, may be empty), forms, events (this
// Vault's events, newest first), weeks (newest first), archive (Opened
// Vaults), existing (current data.json text), reason, now (tests only).

const NOW = input.now ? Date.parse(input.now) : Date.now();
const CLOUD = 'https://res.cloudinary.com/a3xk0plk';
const ACTION_URL = '__ACTION_URL__';

let existing = {};
try { existing = JSON.parse(String(input.existing || '{}')) || {}; } catch (e) { existing = {}; }

const forms = (Array.isArray(input.forms) ? input.forms : [])
  .filter(f => f && !f.in_trash && !f.archived && num(f, 'Tier') > 0)
  .map(f => {
    const vid = txt(f, 'Video Public ID').trim();
    const ver = num(f, 'Video Version');
    return {
      tier: num(f, 'Tier'), name: ttl(f, 'Form'), rarity: sel(f, 'Rarity') || 'Common', lore: txt(f, 'Lore'),
      image: url(f, 'Image URL'),
      video: vid && ver ? CLOUD + '/video/upload/ac_none,so_1.0/v' + ver + '/' + vid + '.mp4' : '',
      poster: vid && ver ? CLOUD + '/video/upload/so_1.0,q_auto,f_jpg/v' + ver + '/' + vid + '.jpg' : ''
    };
  })
  .sort((a, b) => a.tier - b.tier);
const formOf = t => forms.find(f => f.tier === t) || { tier: t, name: 'Tier ' + t + ' Vault', rarity: 'Common', lore: '', image: '', video: '', poster: '' };

const vp = input.vault && input.vault.id ? input.vault : null;
const v = vaultOf(vp);
const state = {
  version: 1,
  generated_at: new Date(NOW).toISOString(),
  tz: TZ,
  rollover_hour: ROLLOVER_HOUR,
  action_url: ACTION_URL,
  vault: v && v.status === 'Active' ? buildVault(v) : null,
  forms: forms.map(f => ({ tier: f.tier, name: f.name, rarity: f.rarity, lore: f.lore })),
  events: buildEvents(),
  weeks: buildWeeks(),
  archive: buildArchive()
};
state.loot = buildLoot(state.events);

// Keep generated_at out of the change check, so a republish with nothing new
// does not commit.
const strip = s => JSON.stringify(Object.assign({}, s, { generated_at: '' }));
const json = JSON.stringify(state);
return {
  json: json,
  changed: strip(state) === strip(existing) ? 0 : 1,
  message: String(input.reason || 'Refresh Vault dashboard').replace(/[^ -~]/g, ' ').split('"').join("'").split(String.fromCharCode(92)).join('/').trim().slice(0, 120) || 'Refresh Vault dashboard'
};

function buildVault(v) {
  const expected = expectedSavings(v, NOW);
  const projected = projectedCompletionMonth(v, NOW);
  const baseline = v.baseline_completion || baselineCompletionMonth(v, NOW);
  const mk = monthKeyOf(NOW);
  const sameMonth = v.core_month === mk;
  const tier = Math.min(Math.max(1, v.tier), Math.max(1, v.forms));
  const form = formOf(tier);
  // Until this tier's own media exists, show the newest earlier tier that has some.
  let shown = form;
  for (let t = tier; t >= 1 && !(shown.video || shown.image); t--) shown = formOf(t);
  const next = tier < v.forms ? formOf(tier + 1) : null;
  return {
    id: bare(v.id),
    name: v.name, goal: v.goal, currency: v.currency, status: v.status,
    target: v.target, starting: v.starting, balance: round2(v.balance),
    remaining: round2(Math.max(0, v.target - v.balance)),
    funding_pct: v.target > 0 ? Math.round(Math.min(1, v.balance / v.target) * 1000) / 10 : 0,
    funded: v.balance >= v.target - 0.005,
    core_charge: v.core, original_core: v.original_core,
    started_at: v.started_at,
    baseline_completion: baseline, projected_completion: projected,
    months_ahead: baseline && projected ? monthDiff(projected, baseline) : 0,
    expected_now: expected, charge_advantage: round2(v.balance - expected),
    expected_weeks: v.weeks, form_count: v.forms, weeks_per_evolution: v.per_evolution,
    tier: tier, evolution_charge: v.charge, defense_streak: v.streak, best_streak: v.best_streak,
    perfect_defenses: v.perfect, lifetime_overcharge: round2(v.lifetime_over),
    month: { key: mk, core_paid: sameMonth ? round2(v.core_paid) : 0, overcharge: sameMonth ? round2(v.over_month) : 0 },
    breach: { week: v.breach_week, count: v.week_breaches, last_at: v.last_breach_at },
    last_evaluated_week: v.last_evaluated,
    form: {
      tier: tier, name: form.name, rarity: form.rarity, lore: form.lore,
      video: shown.video, poster: shown.poster, image: shown.image,
      visual_pending: !(form.video || form.image) ? 1 : (!form.video ? 1 : 0)
    },
    next_form: next ? { tier: next.tier, name: next.name, rarity: next.rarity } : null
  };
}

function metaOf(p) { try { return JSON.parse(txt(p, 'Metadata') || 'null'); } catch (e) { return null; } }

function buildEvents() {
  if (!v) return [];
  const out = [];
  for (const e of Array.isArray(input.events) ? input.events : []) {
    if (!e || e.in_trash || e.archived) continue;
    out.push({
      id: bare(e.id), type: sel(e, 'Type'), amount: numOrNull(e, 'Amount'), title: ttl(e, 'Event'),
      reason: txt(e, 'Reason'), at: dt(e, 'Occurred At') || e.created_time || '', meta: metaOf(e)
    });
  }
  return out.sort((a, b) => (toMs(b.at) || 0) - (toMs(a.at) || 0)).slice(0, 60);
}

function buildWeeks() {
  if (!v) return [];
  return (Array.isArray(input.weeks) ? input.weeks : [])
    .filter(w => w && !w.in_trash && !w.archived)
    .map(w => ({
      start: (dt(w, 'Week Start') || '').slice(0, 10), perfect: chk(w, 'Perfect Defense') ? 1 : 0, breached: chk(w, 'Breached') ? 1 : 0,
      breaches: num(w, 'Breach Count'), tier_after: num(w, 'Tier After'), charge_after: num(w, 'Charge After'), loot: txt(w, 'Loot')
    }))
    .sort((a, b) => (a.start < b.start ? 1 : -1)).slice(0, 26);
}

function buildLoot(events) {
  return events.filter(e => e.type === 'PERFECT_DEFENSE' && e.meta && e.meta.loot)
    .map(e => Object.assign({ week: e.meta.week, at: e.at }, e.meta.loot)).slice(0, 40);
}

function buildArchive() {
  return (Array.isArray(input.archive) ? input.archive : [])
    .filter(p => p && !p.in_trash && !p.archived && sel(p, 'Status') === 'Opened')
    .map(p => {
      const a = vaultOf(p);
      const f = formOf(a.tier);
      return { name: a.name, goal: a.goal, currency: a.currency, target: a.target, amount: round2(a.balance), opened_at: a.opened_at, started_at: a.started_at, tier: a.tier, form: f.name, rarity: f.rarity, perfect: a.perfect, best_streak: a.best_streak };
    })
    .sort((a, b) => ((a.opened_at || '') < (b.opened_at || '') ? 1 : -1));
}
