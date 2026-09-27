// ---- Vault — Forge Tier Visual: loot trophies for the tier-up image ----
// Input: weeks (this Vault's Vault Weeks pages, newest first). Output: line,
// a sentence for the image prompt that puts the newest Epic-or-better loot
// (at most three pieces) into the guard camp as real props; empty when none.
// Standalone: it does not need core.js.

const txt = (page, name) => (((page.properties || {})[name] || {}).rich_text || []).map(t => t.plain_text || (t.text && t.text.content) || '').join('');

const LOOK = {
  'Rail Pistol': 'a long rail pistol resting on a weapon rack',
  'Scattergun': 'a heavy scattergun leaning against a supply crate',
  'Shield Capacitor': 'a humming shield capacitor on a crate',
  'Grenade Mod': 'a bandolier of grenade mods hanging from a post',
  'Relic': 'an ancient alien relic on a small stone plinth',
  'Plasma Carbine': 'a plasma carbine on a weapon rack',
  'Vault Compass': 'a brass and crystal compass on a camp table',
  'Energy Cell': 'a stack of glowing energy cells',
  'Longshot Lens': 'a long sniper scope on a tripod',
  'Holo Badge': 'a small holographic emblem-free badge pinned to a tent flap',
  'Salvage Drone': 'a small salvage drone hovering near the fire',
  'Pocket Reactor': 'a fist-sized reactor glowing in a metal cradle',
  'Sentry Beacon': 'a sentry beacon post softly blinking at the edge of the camp',
  'Combat Visor': 'a combat visor hanging from a tent pole',
  'Piggy Cannon': 'a small armoured cannon shaped like a piggy bank on a stand',
  'Sand Skiff Key': 'a small sand skiff parked beside the tents'
};
const GLOW = { Epic: 'violet', Legendary: 'orange-gold', Mythic: 'iridescent teal and pink' };

const props = (Array.isArray(input.weeks) ? input.weeks : [])
  .filter(w => w && !w.in_trash && !w.archived)
  .map(w => /^(Epic|Legendary|Mythic): (.+)$/.exec(txt(w, 'Loot').trim()))
  .filter(Boolean)
  .map(m => { const base = Object.keys(LOOK).find(b => m[2].includes(b)); return base ? LOOK[base] + ', with a faint ' + GLOW[m[1]] + ' glow' : ''; })
  .filter(Boolean)
  .slice(0, 3);
return {
  line: props.length ? 'Trophies from past defenses are on display at the guard camp as real physical objects, small in the scene, with no labels or text: ' + props.join('; ') + '.' : '',
  count: props.length
};
