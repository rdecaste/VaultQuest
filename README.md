# VaultQuest

A savings-goal dashboard styled as a vault you guard and evolve. It stands on its own and shares nothing with Boss or the Quest dashboards.

- `index.html` is the page GitHub Pages serves. The front of the card shows Tier, Core and Shield. Tap the card to flip it for telemetry, controls, the log, loot and lore.
- The page reads its state from the Quest Engine (Cloudflare Worker, `rdecaste/quest-engine`) at `GET /vault` and sends actions to `POST /vault/action`. `data.json` here is the last state Make published (27 Sep 2026) and is no longer updated.

## How it runs

The backend is the Quest Engine (Cloudflare Worker, `rdecaste/quest-engine`); the four Vault Make scenarios are off since 27 Sep 2026. How the actions, publishing, the Monday evaluation and the forge work is described on the Notion page "⚙️ Quest Engine (Cloudflare Worker)" (section VaultQuest); the routes are listed at the top of the Worker's `src/index.js`.

Notion data lives under "🔐 Vault": Vaults, Vault Events, Vault Weeks and Vault Forms. To regenerate a tier's visual, tick **Regenerate** on its Form row and call the Quest Engine's `POST /vault/forge` with `tier=<n>` (maintenance token).

Visuals are ultra-photorealistic cinematic shots of one original alien vault gate, inspired by the Borderlands vault gates but with no Borderlands logos, symbols or names. The gate always stays closed and stands firm, with an aura radiating from it, while small human guards keep watch around a campfire at its foot; in the video only the aura, flames, smoke, dust and guards move. On every level-up the Monday evaluation redraws the new tier with this vault's newest Epic, Legendary or Mythic loot (up to three pieces) shown as props in the guard camp. The shared look is in the Worker's `src/rules/vaultart.js`; each tier's own details are its **Scene Prompt** in Vault Forms (keep it under 2000 characters). Tiers are forged once, the first time the vault reaches them.

## Code

The live logic and prompts are in the Quest Engine (`src/vault.js`, `src/rules/vault.js`, `src/rules/vaultart.js`). Change them there.

`make/` is the historical Make version (scenario code and blueprint builder, as it ran until 27 Sep 2026). It is kept for reference only: editing it changes nothing.
