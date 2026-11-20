# Changelog

## 0.3.0 (stage-3)

- Data schema v2 with a migration from v1: trial cycle, retry, failed-trial streak and new-piece baseline on talents; Plateau Dungeon fields on attributes; return-card fields on the player. A failed migration rolls back fully and closes its connection.
- Recording: microphone (MediaRecorder), camera photo, or pasted text; playback in the app.
- Baseline test after adding a talent ("Do it now" / "Later"); until the first baseline, slot cards show the baseline instead of the task.
- Trials: every 4 weeks (Main) or 8 weeks (Maintain) once eligible (3/4 of planned slots as Standard/Deep sessions). Warm-up, 2-min measured run with recording, value, side-by-side playback with last time, "better?" answer, optional full piece. Pass needs one step of improvement and "Yes".
- Rank up E -> D -> C -> B -> A -> S, stars after S. Failed trial: what is still needed and a retry date 2 weeks later (one retry). Rank C: new materials and an optional new trial piece (baseline first). Rank-up screen is shown inverted.
- Main talent question after a Main trial; switching Main asks whether to move the old Main's slots.
- Role switch (Main / Maintain / Dormant) from the talent menu and talent page; leaving Dormant runs the 2-min awaken retest and resets difficulty to the lower of start and last value.
- Return card after 7 days without practice: every attribute one step easier, 2 min by default, "Change slots".
- Plateau Dungeon: checked weekly; after 2 failed trials or 4 weeks without a knob change (with 4+ sessions), one attribute uses a different method for 7 days (half speed, the part you miss most, timed challenge), then returns.
- 30-sec records: offered at the Deep cool-down and on a weekly win; the newest 30 per talent are kept.
- Progress Archive: trial recordings and 30-sec records by talent; pick two to play side by side.
- Talents list shows the next trial date and eligibility (e.g. 6/9). Talent page shows trial history (values and recordings).
- Fix: only Start and the rank-up screen use inverted colors (spec section 3); other main buttons use a bold frame.

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
