# VaultQuest

A savings-goal dashboard styled as a vault you guard and evolve. It stands on its own and shares nothing with Boss or the Quest dashboards.

- `index.html` is the card, at https://vaultquest.quest-engine.workers.dev (Cloudflare, behind Roy's Cloudflare Access login). The front of the card shows Tier, Core and Shield. Under the Shield sits the Nightly Watch (one tap a day: held the line, or spent). Tap the card to flip it for telemetry, the Watch and Locked Loot (the no-spend wishlist) tabs, controls, the log, loot and lore.
- The page reads its state from the Quest Engine (Cloudflare Worker, `rdecaste/quest-engine`) at `GET /vault` and sends actions to `POST /vault/action` (vault passcode).

## How it runs

The backend is the Quest Engine (Cloudflare Worker, `rdecaste/quest-engine`); the four Vault Make scenarios are off since 27 Sep 2026. How the actions, publishing, the Monday evaluation and the forge work is described in `docs/quest-engine.md` in rdecaste/quest-engine (section VaultQuest); the routes are listed at the top of the Worker's `src/index.js`.

The data lives in the Quest Engine's D1 database (since 1 Oct 2026; Notion's "🔐 Vault" is a read-only backup): the tables `vaults`, `vault_events`, `vault_weeks` and `vault_forms`, plus `vault_watch_days` and `vault_wishlist` for the Nightly Watch and Locked Loot, edited in D1 Data Studio. To regenerate a tier's visual, tick **regenerate** on its `vault_forms` row and call the Quest Engine's `POST /vault/forge` with `tier=<n>` (maintenance token).

Visuals are ultra-photorealistic cinematic shots of one original alien vault gate, inspired by the Borderlands vault gates but with no Borderlands logos, symbols or names. The gate always stays closed and stands firm, with an aura radiating from it, while small human guards keep watch around a campfire at its foot; in the video only the aura, flames, smoke, dust and guards move. On every level-up the Monday evaluation redraws the new tier with this vault's newest Epic, Legendary or Mythic loot (up to three pieces) shown as props in the guard camp. The shared look is in the Worker's `src/rules/vaultart.js`; each tier's own details are its **scene_prompt** in `vault_forms` (keep it under 2000 characters). Tiers are forged once, the first time the vault reaches them.

## Code

The live logic and prompts are in the Quest Engine (`src/vault.js`, `src/rules/vault.js`, `src/rules/vaultart.js`). Change them there.

The Make version that ran until 27 Sep 2026 (`make/`) is in this repo's git history.

## Deploying

A push to `main` deploys it to Cloudflare (Workers Builds); by hand: `npx wrangler deploy`. Only the pages are published (`.assetsignore`). The old `rdecaste.github.io` address forwards here until GitHub Pages is switched off.
