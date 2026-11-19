[![make.fun · gta6-trophy-guide-01](https://make.fun/badge/gta6-trophy-guide-01.svg)](https://make.fun/bounty/gta6-trophy-guide-01)
[![Live rank](https://make.fun/badge/gta6-trophy-guide-01/0xyfann/makefun-gta6-trophy-guide-01/rank.svg)](https://make.fun/bounty/gta6-trophy-guide-01/leaderboard)
[![Live reward](https://make.fun/badge/gta6-trophy-guide-01/0xyfann/makefun-gta6-trophy-guide-01/reward.svg)](https://make.fun/bounty/gta6-trophy-guide-01)

# Leonida Ledger

An offline PlayStation 5 trophy guide and tracker for Grand Theft Auto VI. It covers all 55 trophies with the official names, descriptions and grades, original guidance with sources, and a four-stage platinum roadmap.

## Open the guide

Open `app/index.html` directly in desktop Chrome or serve `app/` with a static HTTP server. No installation or build step is needed.

- Search or filter by type, grade and earned status. Select a trophy to open its guide and sources.
- Tick trophies as you earn them. Progress and spoiler preferences stay in the browser. Export a JSON backup to move your progress to another browser or restore it later. Import replaces the current checklist with the backup.
- Enable **Hide story spoilers** to mask unearned story names, descriptions and guidance across the checklist and roadmap.
- Use **Missable** to find precautionary save checkpoints. The official list gives no confirmed permanent lockouts or replay rules. The roadmap follows the numbered chapters and treats the named mission order as unverified.

The official metadata and extra tracked counts come from `starter/app/data/trophies.json` in the [make.fun competition kit](https://make.fun/c/gta6-trophy-guide-01/kit). The PS5 list does not name any online-only unlocks.

## Package the entry

```sh
MAKEFUN_OUTPUT_DIR="$(mktemp -d)" node main.ts
```

`app/data/trophies.json` is the source of truth. Run `node scripts/sync-catalog.mjs` after changing it to refresh the bundled browser catalog. This lets the app open from disk without a request for JSON. The packager checks that both files agree.

To test the guide in headless Chromium, set `LEDGER_CHROMIUM` to the browser executable and run `node scripts/check-browser.mjs`. Add `--capture` to regenerate the four screenshots.

Released under the [MIT License](LICENSE).

---

<sub>Built for the [make.fun trophy-guide bounty](https://make.fun/bounty/gta6-trophy-guide-01?ref=p1x954ca) · [make.fun referral](https://make.fun/r/p1x954ca)</sub>
