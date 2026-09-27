// ---- Vault — Monday Evaluation: judge every finished game week -------------
// Inputs: vault (the Active Vault page), breaches (BREACH event pages since the
// last evaluated week), forms (Vault Forms pages), now (tests only).
// Output: creates (Notion page bodies: weeks and events), vault_patch,
// tier_up (0/1), tier (the tier after evaluation), summary.
// Idempotent: weeks at or before Last Evaluated Week are never judged twice.

const NOW = input.now ? Date.parse(input.now) : Date.now();
const vault = vaultOf(input.vault && input.vault.id ? input.vault : null);
return evaluate();

function evaluate() {
  const none = { weeks: 0, creates: [], vault_patch: '', tier_up: 0, tier: vault ? vault.tier : 0, summary: 'Nothing to evaluate' };
  if (!vault || vault.status !== 'Active') return none;

  const formName = {};
  for (const f of Array.isArray(input.forms) ? input.forms : []) formName[num(f, 'Tier')] = ttl(f, 'Form');

  const breachTimes = [];
  for (const e of Array.isArray(input.breaches) ? input.breaches : []) {
    if (!e || e.in_trash || e.archived || sel(e, 'Type') !== 'BREACH') continue;
    const t = toMs(dt(e, 'Occurred At') || e.created_time);
    if (t !== null) breachTimes.push(t);
  }
  // The Vault page also remembers this week's breaches, in case the event
  // query has not caught up yet.
  if (vault.last_breach_at) { const t = toMs(vault.last_breach_at); if (t !== null) breachTimes.push(t); }

  const startMs = dateMs(vault.started_at) || NOW;
  const currentWeek = weekKeyOf(NOW);
  let week = vault.last_evaluated ? addDays(vault.last_evaluated, 7) : weekKeyOf(startMs);
  let tier = vault.tier, charge = vault.charge, streak = vault.streak, best = vault.best_streak, perfect = vault.perfect;
  let tierUp = 0, judged = 0, lastWeek = vault.last_evaluated;
  const creates = [], lines = [];

  for (let guard = 0; guard < 60 && week < currentWeek; guard++, week = addDays(week, 7)) {
    lastWeek = week;
    const ws = weekStartMs(week), we = weekStartMs(addDays(week, 7));
    if (we <= startMs) continue; // campaign had not started yet
    judged++;
    const hits = breachTimes.filter(t => t >= ws && t < we);
    const unique = new Set(hits).size;
    const breached = unique > 0;
    const tierBefore = tier, chargeBefore = charge;
    let loot = null, up = false;
    if (breached) {
      streak = 0;
    } else {
      perfect += 1; streak += 1; best = Math.max(best, streak);
      if (tier < vault.forms) {
        charge += 1;
        if (charge >= vault.per_evolution) { tier += 1; charge = 0; up = true; tierUp = 1; }
      } else {
        charge = vault.per_evolution; // final form: the meter stays full
      }
      loot = lootFor(vault.id + ':' + week, streak, up);
    }
    const weekEnd = addDays(week, 6);
    creates.push(JSON.stringify({
      parent: { type: 'data_source_id', data_source_id: DS.weeks },
      properties: {
        Week: W.title('Week of ' + week), Vault: W.rel(vault.id), 'Week Start': W.date(week), 'Week End': W.date(weekEnd),
        Breached: W.chk(breached), 'Breach Count': W.num(unique), 'Perfect Defense': W.chk(!breached),
        'Shield Integrity': W.num(breached ? 0 : 7), 'Tier Before': W.num(tierBefore), 'Tier After': W.num(tier),
        'Charge Before': W.num(chargeBefore), 'Charge After': W.num(charge),
        Loot: W.text(loot ? loot.rarity + ': ' + loot.name : '')
      }
    }));
    const at = new Date(Math.min(NOW, we + 10 * 60000)).toISOString();
    const event = (type, title, meta) => creates.push(JSON.stringify({
      parent: { type: 'data_source_id', data_source_id: DS.events },
      properties: {
        Event: W.title(title), Vault: W.rel(vault.id), Type: W.sel(type), Amount: W.num(null), Reason: W.text(''),
        'Occurred At': W.date(at), Month: W.text(monthKeyOf(we)), Metadata: W.text(JSON.stringify(meta))
      }
    }));
    if (!breached) {
      event('PERFECT_DEFENSE', 'Perfect Defense — week of ' + week,
        { week: week, streak: streak, charge: charge, per_evolution: vault.per_evolution, tier: tier, loot: loot });
      lines.push(week + ' perfect (streak ' + streak + ', charge ' + charge + '/' + vault.per_evolution + ')');
    } else {
      lines.push(week + ' breached x' + unique);
    }
    if (up) {
      event('TIER_UP', 'Tier ' + tier + ' — ' + (formName[tier] || 'New form'),
        { week: week, from: tierBefore, to: tier, form: formName[tier] || '', from_form: formName[tierBefore] || '' });
      lines.push('TIER UP ' + tierBefore + ' → ' + tier);
    }
  }

  if (lastWeek === vault.last_evaluated) return none;
  const patch = { properties: {
    'Current Tier': W.num(tier), 'Evolution Charge': W.num(charge), 'Defense Streak': W.num(streak),
    'Best Streak': W.num(best), 'Perfect Defenses': W.num(perfect), 'Last Evaluated Week': W.date(lastWeek)
  } };
  return {
    weeks: judged, creates: creates, vault_patch: JSON.stringify(patch), tier_up: tierUp, tier: tier,
    summary: (lines.join('; ') || 'No campaign weeks yet') + ' — ' + vault.name
  };
}
