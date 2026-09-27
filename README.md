# VaultQuest

A savings-goal dashboard styled as a vault you guard and evolve. It stands on its own and shares nothing with Boss or the Quest dashboards.

- `index.html` is the page GitHub Pages serves. The front of the card shows Tier, Core and Shield. Tap the card to flip it for telemetry, controls, the log, loot and lore.
- `data.json` is written only by the Make scenario "Vault — Publish Dashboard".

## How it runs

| Make scenario | Trigger | Job |
|---|---|---|
| Vault — Action | webhook from the page | create, inject, breach, open, baseline |
| Vault — Publish Dashboard | webhook | Notion to `data.json` on `main` |
| Vault — Forge Tier Visual | webhook | OpenAI image to Cloudinary `Vault-Board`, Gemini loop to `Vault-Progress`, cached per tier on Vault Forms |
| Vault — Monday Evaluation | Mondays 04:10 Europe/Amsterdam | judges finished game weeks (Monday 04:00 to Monday 04:00), then evolves the tier |

Notion data lives under "🔐 Vault": Vaults, Vault Events, Vault Weeks and Vault Forms. To regenerate a tier's visual, tick **Regenerate** on its Form row and call the Forge webhook with `tier=<n>`.

Visuals are ultra-photorealistic cinematic shots of one original alien vault gate, inspired by the Borderlands vault gates but with no Borderlands logos, symbols or names. The shared look is `IMAGE_PROMPT` in `make/blueprints.js`; each tier's own details are its **Scene Prompt** in Vault Forms (keep it under 2000 characters). Tiers are forged once, the first time the vault reaches them.

## Code

`make/src` holds the scenario code. Run `node make/test/run.js` to test it. `VAULT_PASSCODE=… node make/blueprints.js` builds the blueprints; its output is ignored by git because it contains the passcode.
