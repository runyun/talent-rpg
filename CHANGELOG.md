# Changelog

## 0.6.0 (stage-6)

- Export to Calendar (Settings): one weekly repeating event per slot of every Main or Maintain talent, titled "[Training] {talent}", with the place and length of the slot and no alarms. The file is a standard .ics download; export again after changing slots.
- Validation data page (Settings -> About your data): sessions vs planned, on-time start rate, off-slot share, seconds to Start (median), time to add a talent, material edits, Too easy / Just right / Too hard, opens without practice and stress score per week; Companions / Vault on-off switches; trial results per talent. Everything stays on the phone.
- Sessions now record whether they started after their slot had ended (for the off-slot share); older sessions are worked out from the slot.
- Rank-up card: after a rank up, an image with the talent, old rank -> new rank and the main metric old -> new, in the colors of the rank-up screen. Save image and Share open the share sheet (on iPhone it has Save Image).
- Talent page: "+ Add slot" adds training slots with the same fields as Add talent (days, anchor, time, length, place).
- Copy: S65-S71 and L71-L74 are now in the copy sheet; new label L75 "+ Add slot".

## 0.5.0 (stage-5)

- Critical hit: Standard/Deep answered "Just right" or "Too hard", 1 in 5, seeded by the session. Mana Stone ×5 before the vault opens; after that, half stones and half a vault ticket (stones when the vault is off).
- System Vault opens the first time a talent reaches Rank D. One ticket per Standard/Deep session plus critical-hit tickets (only while the vault is open and on). Companions get one ticket for each day they practice, from the first open on. Each ticket adds 1 stone to the pool.
- Draws every 3 days at 00:00 (draw 1 = 2026-01-04). Numbers come from SHA-256 of the draw date and the draw's tickets; all due draws are computed at each open, only after the companions are simulated up to the day before. Jackpot (3 numbers) splits the pool, rounded down; prize (2 numbers) gives 10 stones or a title frame. Your jackpot goes to Pending and adds the next legendary title.
- Results are revealed only at your next finished session (S41-S43 for one draw, one S44 line for several); no "almost". Pending jackpots release 1/5 of the total after each Standard/Deep session (S45). Companion jackpots appear in the feed (S46).
- Vault section on Home (next draw, pool, your tickets, recent draws) and the Rules & verification page (rules, odds, pool, algorithm, every ticket of a draw, Recompute this draw). Draws you have not been shown yet stay hidden there.
- Settings: System Vault on/off (switches recorded for the validation data) and Lucky numbers (3 of 1-14, or Auto pick).
- Appearance: Mana Stones, 12 themes (colors, fonts and lines only; all pass WCAG AA), 8 badges, 8 title frames, legendary titles; buy with stones and use. The badge and the title (in its frame) show in the top row.
- Fix: a version that finished downloading while the app was starting no longer takes over on that same open; it waits for the next open (spec section 2).

## 0.4.0 (stage-4)

- Data schema v3 with a migration from v2: breakthrough flag on attributes, first-meeting flag on the player, Companions setting kept.
- Companion world: 30 virtual companions simulated day by day from the first open. Each day uses random numbers seeded by the date and companion number, so catching up many days at once gives the same result as opening the app daily. Events (sick, trip, exams, moving, low motivation, busy work, sprint, new teacher, new gear, plateau), long weekends and typhoon days (July-September) change attendance; at most 10 companions in a down event at once; growth up to Rank B; returns and breakthroughs after events end.
- Feed: today (up to now) and the 7 days before, at most 10 items a day: your milestones (weekly win, rank up), events, rank-ups, returns, then practices picked by seed. Tap an item to open the companion's profile.
- Companion profile: title, talent, personality, rank, base attendance, preferred time, current event, last 7 days.
- First meeting: 3 companions say hello once, with the note that they are virtual.
- Congratulations from 1-3 companions who practiced today and are not in a down event: weekly win, trial rank up, first session after a return, Plateau Dungeon breakthrough.
- Settings: Companions on/off (hides the feed and congratulations; switches are recorded for the validation data). Companions never appear in the focus area of Home.
- Rank-up screen: secondary text uses a darker gray on white for WCAG AA contrast.

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
