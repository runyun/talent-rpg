# Changelog

## 0.1.0 (stage-1)

- Project setup: static app served from `/talent-rpg/` on GitHub Pages.
- Offline cache with quiet updates: the app opens from the cached version, downloads a new version in the background, and switches on the next open. No prompts, no reloads.
- IndexedDB storage with schema version 1 and a step-by-step migration framework (failed migrations roll back completely).
- Persistent storage request on open.
- English copy file with every text from the copy sheet, and a config file with every tunable number.
- 30 companion profiles and event definitions as fixed data.
- Pure Black visual base (theme variables, system fonts, monospace numbers, thin frames).
- Add to Home Screen guide when opened in a Safari tab.
- Home skeleton with top row, system card, and Settings / About your data showing the version number.
