# talent-rpg

An offline web app for iPhone that tells you what to reach today, lets you report a practice in one or two taps, and shows each step toward your goal.

- Live: https://runyun.github.io/talent-rpg/
- Static files only (plain HTML, CSS and JavaScript modules). No build step, no dependencies, no network requests besides the app's own files.
- All data stays on the device (IndexedDB).

## Structure

| Path | Purpose |
| --- | --- |
| `index.html` | Entry page |
| `sw.js` | Offline cache; new versions are used on the next open |
| `manifest.webmanifest` | Home Screen settings |
| `src/strings.js` | Every user-visible text, keyed by copy code |
| `src/text.js` | Fills `{variables}` in copy, drops parts with missing values, singular/plural |
| `src/config.js` | All tunable numbers |
| `src/db.js` | IndexedDB schema and step-by-step migrations |
| `src/migrateV5.js` | Data v4 (or v3) to v5 |
| `src/format.js` | Number and value display |
| `src/model/` | Rules: practice, schedule, records, Today cards, roles, vault, companions |
| `src/ui/` | Screens |

## Releasing a version

1. Bump `APP_VERSION` in `src/version.js` and `VERSION` in `sw.js` (same value).
2. Add any new file to the `FILES` list in `sw.js`.
3. Add an entry to `CHANGELOG.md`.
4. If the data schema changes, append a migration to `MIGRATIONS` in `src/db.js`. Never drop data.
