# VaultQuest

A savings-goal dashboard styled as a vault you guard and evolve. It stands on its own and shares nothing with Boss or the Quest dashboards.

- `index.html` is the page GitHub Pages serves. The front of the card shows Tier, Core and Shield. Tap the card to flip it for telemetry, controls, the log, loot and lore.
- The page reads its state from the Quest Engine (Cloudflare Worker, `rdecaste/quest-engine`) at `GET /vault` and sends actions to `POST /vault/action`. `data.json` here is the last state Make published (27 Sep 2026) and is no longer updated.

## How it runs

Since 27 Sep 2026 the four Make scenarios are switched off and the Quest Engine runs them, with the code in `make/src` copied unchanged (`src/rules/vault.js` there):

| Was the Make scenario | Now in the Quest Engine | Job |
|---|---|---|
| Vault — Action | `POST /vault/action` | create, inject, breach, open, baseline |
| Vault — Publish Dashboard | after every change; `GET /vault` | Notion to the card's state |
| Vault — Forge Tier Visual | VaultForge Workflow | OpenAI image to Cloudinary `Vault-Board`, Gemini loop to `Vault-Progress`, cached per tier on Vault Forms |
| Vault — Monday Evaluation | Mondays after 04:00 Europe/Amsterdam | judges finished game weeks (Monday 04:00 to Monday 04:00), then evolves the tier |

The passcode is the Worker secret `VAULT_PASSCODE`.

Notion data lives under "🔐 Vault": Vaults, Vault Events, Vault Weeks and Vault Forms. To regenerate a tier's visual, tick **Regenerate** on its Form row and call the Quest Engine's `POST /vault/forge` with `tier=<n>` (maintenance token).

Visuals are ultra-photorealistic cinematic shots of one original alien vault gate, inspired by the Borderlands vault gates but with no Borderlands logos, symbols or names. The gate always stays closed and stands firm, with an aura radiating from it, while small human guards keep watch around a campfire at its foot; in the video only the aura, flames, smoke, dust and guards move. On every level-up the Monday evaluation redraws the new tier with this vault's newest Epic, Legendary or Mythic loot (up to three pieces) shown as props in the guard camp (`make/src/trophies.js`). The shared look is `IMAGE_PROMPT` in `make/blueprints.js`; each tier's own details are its **Scene Prompt** in Vault Forms (keep it under 2000 characters). Tiers are forged once, the first time the vault reaches them.

## Code

`make/src` holds the scenario code. Run `node make/test/run.js` to test it. `VAULT_PASSCODE=… node make/blueprints.js` builds the blueprints; its output is ignored by git because it contains the passcode.
