// ---- Vault — Action: plan one dashboard action -----------------------------
// Inputs: passcode, action, amount, reason, confirm, name, goal, target,
// starting, core, start_date, currency (from the webhook), vault (the Active
// Vault page or empty), now (tests only).
// Output: op = create | update | reject, plus the Notion bodies to write.

const PASSCODE = '__PASSCODE__';
const NOW = input.now ? Date.parse(input.now) : Date.now();
const NOW_ISO = new Date(NOW).toISOString();
const action = String(input.action || '').trim().toLowerCase();
const page = input.vault && input.vault.id ? input.vault : null;
const vault = vaultOf(page);
const amountIn = round2(Math.abs(Number(String(input.amount || '').replace(',', '.')) || 0));

const reject = (code, message) => ({
  op: 'reject', ok: 0, code: code, message: message, forge: 0, forge_tier: 0,
  vault_body: '', vault_patch: '', events: [],
  response_body: JSON.stringify({ ok: 0, code: code, message: message })
});
const accept = (o) => {
  const out = Object.assign({ ok: 1, forge: 0, forge_tier: 0, vault_body: '', vault_patch: '', events: [] }, o);
  out.feedback = JSON.stringify(Object.assign({ ok: 1, code: out.code, message: out.message }, o.feedback || {}));
  delete out.feedback_obj;
  return out;
};
const eventBody = (type, amount, title, reason, meta) => JSON.stringify({
  parent: { type: 'data_source_id', data_source_id: DS.events },
  properties: {
    Event: W.title(title), Vault: W.rel(vault.id), Type: W.sel(type), Amount: W.num(round2(amount)),
    Reason: W.text(reason || ''), 'Occurred At': W.date(NOW_ISO), Month: W.text(monthKeyOf(NOW)),
    Metadata: W.text(meta ? JSON.stringify(meta) : '')
  }
});

let result;
if (String(input.passcode || '').trim() !== PASSCODE) {
  result = reject('bad_passcode', 'Access denied. WARDEN does not recognise that passcode.');
} else if (action === 'create') {
  result = planCreate();
} else if (!vault) {
  result = reject('no_vault', 'There is no active Vault. Forge one first.');
} else if (action === 'inject') {
  result = planInject();
} else if (action === 'breach') {
  result = planBreach();
} else if (action === 'open') {
  result = planOpen();
} else if (action === 'baseline') {
  result = planBaseline();
} else {
  result = reject('bad_action', 'Unknown action.');
}
return result;

function planCreate() {
  if (vault) return reject('active_exists', 'A Vault is already active. Open it before forging a new one.');
  const name = String(input.name || '').trim();
  const goal = String(input.goal || '').trim() || name.replace(/\s*vault\s*$/i, '');
  const target = round2(Number(input.target) || 0);
  const starting = round2(Number(input.starting) || 0);
  const core = round2(Number(input.core) || 0);
  const currency = (String(input.currency || 'EUR').trim().toUpperCase() || 'EUR').slice(0, 3);
  const startDate = /^\d{4}-\d{2}-\d{2}$/.test(String(input.start_date || '')) ? input.start_date : gameDayKey(NOW);
  if (!name) return reject('bad_input', 'Give the Vault a name.');
  if (!(target > 0)) return reject('bad_input', 'Target amount must be above zero.');
  if (starting < 0 || starting >= target) return reject('bad_input', 'Starting amount must be at least zero and below the target.');
  if (!(core > 0)) return reject('bad_input', 'Monthly Core Charge must be above zero.');
  const c = campaignOf(target, starting, core);
  const startMonth = startDate.slice(0, 7);
  const history = [{ from: startMonth, core: core }];
  const plan = { target, starting, balance: starting, core, started_at: startDate, history, core_month: '', core_paid: 0 };
  const baseline = baselineCompletionMonth(plan, Math.max(NOW, dateMs(startDate)));
  const body = {
    parent: { type: 'data_source_id', data_source_id: DS.vaults },
    properties: {
      Vault: W.title(name), Goal: W.text(goal), Status: W.sel('Active'), Currency: W.text(currency),
      'Target Amount': W.num(target), 'Starting Amount': W.num(starting), 'Current Balance': W.num(starting),
      'Core Charge': W.num(core), 'Original Core Charge': W.num(core), 'Goal Started At': W.date(startDate),
      'Baseline Completion': W.date(baseline ? baseline + '-01' : null),
      'Expected Campaign Weeks': W.num(c.weeks), 'Major Evolution Count': W.num(c.forms), 'Weeks Per Evolution': W.num(c.per_evolution),
      'Current Tier': W.num(1), 'Evolution Charge': W.num(0), 'Defense Streak': W.num(0), 'Best Streak': W.num(0),
      'Perfect Defenses': W.num(0), 'Lifetime Overcharge': W.num(0),
      // The week the Vault starts in is the first one Monday evaluates.
      'Last Evaluated Week': W.date(addDays(weekKeyOf(dateMs(startDate)), -7)),
      'Core Month': W.text(''), 'Core Paid This Month': W.num(0), 'Overcharge This Month': W.num(0),
      'Breach Week': W.text(''), 'Week Breaches': W.num(0), 'Baseline History': W.text(JSON.stringify(history))
    }
  };
  return accept({
    op: 'create', code: 'created', forge: 1, forge_tier: 1,
    message: name + ' forged. ' + c.months_needed + ' months, ~' + c.weeks + ' weeks, ' + c.forms + ' forms, ' + c.per_evolution + ' Perfect Defenses per evolution.',
    vault_body: JSON.stringify(body),
    feedback: { kind: 'create', campaign: c, baseline_completion: baseline }
  });
}

function monthState() {
  const mk = monthKeyOf(NOW);
  const same = vault.core_month === mk;
  return { mk, paid: same ? vault.core_paid : 0, over: same ? vault.over_month : 0 };
}

function planInject() {
  if (!(amountIn > 0)) return reject('bad_input', 'Enter an amount above zero.');
  const ms = monthState();
  const coreLeft = Math.max(0, round2(vault.core - ms.paid));
  const core = round2(Math.min(amountIn, coreLeft));
  const over = round2(amountIn - core);
  const before = projectedCompletionMonth(vault, NOW);
  const after = Object.assign({}, vault, { balance: round2(vault.balance + amountIn), core_month: ms.mk, core_paid: round2(ms.paid + core) });
  const projected = projectedCompletionMonth(after, NOW);
  const expected = expectedSavings(vault, NOW);
  const cur = vault.currency;
  const events = [];
  if (core > 0) events.push(eventBody('CORE_CHARGE', core, 'Core Charge +' + money(core, cur), '', { month: ms.mk }));
  if (over > 0) events.push(eventBody('OVERCHARGE', over, 'Overcharge +' + money(over, cur), '', { month: ms.mk }));
  const patch = { properties: {
    'Current Balance': W.num(after.balance), 'Core Month': W.text(ms.mk), 'Core Paid This Month': W.num(after.core_paid),
    'Overcharge This Month': W.num(round2(ms.over + over)), 'Lifetime Overcharge': W.num(round2(vault.lifetime_over + over))
  } };
  const earlier = before && projected ? monthDiff(projected, before) : 0;
  const funded = after.balance >= vault.target - 0.005;
  return accept({
    op: 'update', code: over > 0 ? 'overcharge' : 'core', vault_patch: JSON.stringify(patch), events: events,
    message: over > 0 ? 'OVERCHARGE DETECTED' : 'CORE CHARGED',
    feedback: {
      kind: 'inject', amount: amountIn, core: core, over: over, balance: after.balance,
      charge_advantage: round2(after.balance - expected), projected: projected, months_earlier: earlier, funded: funded
    }
  });
}

function planBreach() {
  if (!(amountIn > 0)) return reject('bad_input', 'Enter the amount taken out.');
  if (String(input.confirm || '').trim().toUpperCase() !== 'BREACH') return reject('not_confirmed', 'A breach needs explicit confirmation.');
  if (amountIn > vault.balance + 0.005) return reject('bad_input', 'You cannot take out more than the Vault holds (' + money(vault.balance, vault.currency) + ').');
  const week = weekKeyOf(NOW);
  const count = vault.breach_week === week ? vault.week_breaches + 1 : 1;
  const reason = String(input.reason || '').trim().slice(0, 200) || 'Other';
  const balance = round2(vault.balance - amountIn);
  const patch = { properties: {
    'Current Balance': W.num(balance), 'Breach Week': W.text(week), 'Week Breaches': W.num(count), 'Last Breach At': W.date(NOW_ISO)
  } };
  return accept({
    op: 'update', code: 'breach', vault_patch: JSON.stringify(patch),
    events: [eventBody('BREACH', amountIn, 'Vault Breach -' + money(amountIn, vault.currency), reason, { week: week, day: dowOf(gameDayKey(NOW)) })],
    message: 'SHIELD COMPROMISED',
    feedback: { kind: 'breach', amount: amountIn, balance: balance, week: week, reason: reason, streak_lost: vault.streak }
  });
}

function planOpen() {
  if (vault.balance < vault.target - 0.005) return reject('not_funded', 'The Vault Key is not forged yet: ' + money(vault.target - vault.balance, vault.currency) + ' to go.');
  const patch = { properties: { Status: W.sel('Opened'), 'Opened At': W.date(NOW_ISO) } };
  return accept({
    op: 'update', code: 'opened', vault_patch: JSON.stringify(patch),
    events: [eventBody('VAULT_OPENED', vault.balance, 'Vault Opened: ' + (vault.goal || vault.name), '', { tier: vault.tier, perfect: vault.perfect })],
    message: 'VAULT OPENED',
    feedback: { kind: 'open', goal: vault.goal, amount: vault.balance, tier: vault.tier }
  });
}

function planBaseline() {
  const core = round2(Number(input.core || input.amount) || 0);
  if (!(core > 0)) return reject('bad_input', 'Core Charge must be above zero.');
  if (Math.abs(core - vault.core) < 0.005) return reject('bad_input', 'That is already the Core Charge.');
  const mk = monthKeyOf(NOW);
  const history = vault.history.filter(h => h.from < mk).concat([{ from: mk, core: core }]);
  const next = Object.assign({}, vault, { core: core, history: history });
  const baseline = baselineCompletionMonth(next, NOW);
  const patch = { properties: {
    'Core Charge': W.num(core), 'Baseline History': W.text(JSON.stringify(history)),
    'Baseline Completion': W.date(baseline ? baseline + '-01' : null)
  } };
  return accept({
    op: 'update', code: 'baseline', vault_patch: JSON.stringify(patch),
    events: [eventBody('BASELINE_CHANGED', core, 'Core Charge ' + money(vault.core, vault.currency) + ' → ' + money(core, vault.currency), '', { from: vault.core, to: core, month: mk })],
    message: 'CORE RECALIBRATED',
    feedback: { kind: 'baseline', from: vault.core, to: core, baseline_completion: baseline, projected: projectedCompletionMonth(next, NOW) }
  });
}
