# Changelog

## 0.2.1

- Fix: a new version now reliably takes over on the next open. On iOS a swiped-away Home Screen app often stays alive, so the waiting version never activated. At startup, before anything is shown, the app now switches to a downloaded version and reloads once. Never during use.

## 0.2.0 (stage-2)

- First use: welcome card, then add the first talent.
- Add talent: name, level, material for 4 attributes with prefilled starting difficulty, speed and unit, trial piece and main metric, role (with limits), training slots (days, anchor, 24 h time, length, place).
- Home card in priority order: in-slot task, past task (no "missed" wording), Sunday check, next training slot; "Enough for today" when today's slots are done.
- Size switch (2 / 15 / 45 min) with mini scaling; swipe left for the next attribute (up to 2 times), swipe right or "Reschedule" to move one slot.
- Attribute choice: least recently practiced first; one extra turn after 2x "Too hard".
- Timer from the start time (works after leaving the app), screen kept on, metronome for BPM speeds, Deep in 3 phases; a running session resumes after the app is closed.
- Finish screen: difficulty answer, knob up/down after 2 same answers, material cleared prompt, EXP and Lv, weekly win.
- Weekly goal and win, week at risk notice, This Week grid, practice days.
- Reschedule with collision handling (15 min steps, next day after 23:00).
- Sunday check: edit next week's slots, stress score during the trial period; "Same slots" notice when left alone.
- Talent page: material history, knobs (long press to edit), slot edit and delete. Talent rename and delete (removes its records).
- Validation data recorded: seconds to Start, time to add a talent, material edits, opens without practice.
- Not in this stage: baseline test, trials, return card, plateau, recordings (stage 3); companions (stage 4); critical hits and the vault (stage 5).

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
