# Changelog

## 0.8.0-c (stage-10b)

- Rank challenges: a pass one step above a rank opens its challenge (S: two passes in a row at the goal; stars after S). The card shows the challenge (or "Tomorrow" after today's first try); "Challenge first?" is asked once per rank before practice or Quick. Intro, run, pass (ranks in between come along, Mana 10 each, keepsakes, a slot at the first Rank C, the System Vault at the first Rank D, companion congratulations, share card) and "Not this time" (try again another day after one practice). Plateau: a value eased 3 times halves the step and offers a Checkpoint; it ends at the next step up. Return after 7 days eases every target once and makes Quick the main button until the next practice. Gate: x1.5 EXP for the Main talent or the one picked on the Sunday "Next week" card (slots, Gate, stress score). Awakening a dormant talent finds its start again; becoming Main asks to move the old Main's slots. Talents: a week calendar of slots and practices by time with short names (set in Rename), challenge progress per talent and a long-press menu. Talent page: challenge entry, plateau note, Target & step (recut ranks; ranks you have stay), Awaken. Copy: S298-S302, S315, S316, L165.

## 0.8.0-b (stage-10a-fix)

- Fixes to 0.8.0-a (spec version 20). Step size: a slider when there is a range, "This gap fits only one step size." when there is one size, and "Needs a gap of at least 5 ..." (Next disabled) when 5 ranks cannot be cut; a line under it explains a step. Find your start is blocked with a note when the start is too close to the goal. Ask AI: a new prompt with one item per line; answers are read with several items on one line, bold, list marks, numbering, full-width colons and other label names; with Focus, Now and Goal the talent is saved at once and only the slots page is left, otherwise the missing pages are named and opened. Today shows "Later today" when a slot is still to come today, and the weekly-win marker above the 7 cells is gone. One guitar example per page. Settings -> Data -> Reset all data (type RESET to confirm; all or nothing). Copy updated (S126, S134, S236, S244, S247, S249, H01; new S289-S297, S303, S304, S311-S317, L156, L157, L162-L164; S233 and L110 removed).

## 0.8.0-a (stage-10a)

First part of spec version 19: a new practice model. Data schema v5 with a migration from v3/v4.

- Data v5 and migration. Nothing is deleted. Each talent gets a focus (its old trial piece, or its name), a unit (the old trial unit) and a start (its latest trial value); goal and step are left empty and the talent shows a Set up card. Ranks stay. Each attribute's current material becomes a Needs work line ("Fundamentals: ..."). Fields that are no longer used are kept under `legacy`. Slots lose their length (kept under `legacy`) and count from this week. Old sessions stay (Mini becomes Quick). Trials, recordings, attributes, the feed and companions stay. Mana Stones become Mana. Owned and equipped themes move to the new theme ids. Talent slots = 2 + talents that reached Rank C. Any failure rolls the whole upgrade back.
- Practice model: one focus per talent, today's target (one number), a goal (= Rank S), a fixed step, more-is-better or less-is-better from the numbers, whole numbers or one decimal. Two passes in a row move the target one step toward the goal; two misses move it one step back, never below the start. Rank values E-S are cut from the steps.
- Find your start: the first practice of a new talent measures where you are (the only time you type a number). Set up: talents from before 0.8 set a goal on Add talent pages 2-4.
- Add talent in 7 pages, one question each, with an example box: name and goal, focus, now/goal/unit with a step slider and a live result card, up to 3 checks, role (talent slots and one Main), slots. Ask AI: copy a prompt to any AI and paste the answer back to fill the pages (the app itself connects to nothing).
- Today: title row with Lv, this week's 7 cells, swipeable task cards (one per talent with a slot in its window or past it), dots and "Swipe for ...", I practiced / Quick / More. A past slot only adds a gray line. State cards: All done today, No slot today, no talents (or all dormant). Today redraws only when something on it changed.
- Report sheet: tap any check you missed, then Passed or Not yet; that saves it. Finish screen with the target change, EXP bar, week, Lv, Mana, vault results and the next target, then back to Today with "Saved · Undo" for 3 seconds. Undo takes back the whole practice.
- Quick (one try, no pass or fail, 6 EXP, no ticket), Needs work and Fixed lists, More (Other talent, Reschedule, Edit needs work, Open talent page).
- Slot windows: 15 min before to 60 min after the start. Slots added after their time this week start next week. Weekly win, at-risk line, Mana 5 for a weekly win. EXP: 40 per practice and Find your start, 6 for Quick.
- Talents tab and talent page in their new form (focus, checks, needs work, old trials under Challenges, old recordings to play or delete, slots, role). Target & step, challenges, plateau, return and the Sunday card come in stage 10B.
- Removed: timer, metronome, keep-screen-awake, recording and photos, the four attributes, sizes, difficulty answers, trials and the Plateau Dungeon. The Validation data page is hidden until stage 10C (metrics are still recorded). Every screen uses the Mono theme until stage 10D.
- Copy: the copy file follows the version 19 copy sheet; deleted codes are gone.

## 0.7.0 (stage-7)

First round of trial feedback (spec version 14). No data schema change.

- Tab bar: Today, Talents, World, Me. The app always opens on Today. World is hidden when Companions are off and the System Vault is off or still locked. No badges or numbers on the tabs. Timer, finish, trial, Add talent, first use and the rank-up screen stay full screen.
- Safe area: content starts 12pt below the status bar, and the status bar area is always covered, so nothing scrolls under it. The tab bar sits above the Home indicator.
- Today fits one screen and never scrolls. A past slot card shows a neutral gray line with the original slot time (S72). New buttons under task cards: "Switch attribute" (up to 2 per card) and "Other talent" (a list of the other active talents with the attribute each would practice; the session counts for that talent's slot this week).
- Talents tab: This Week and the talent list. The Progress Archive moved to each talent page.
- Me tab: Mana Stones, then Appearance, Guide and Settings.
- 12 black-and-white themes (renamed: Typewriter, Ink, Midnight, Stone, Arcade). Each changes only background, font, weight and case, tag symbols, lines, corners, texture, Start style, progress bar style and entrance motion. Button positions and sizes are the same in every theme. No motion with Reduce Motion. Purchased and equipped themes keep working.
- Appearance shows every theme, badge, title frame and title as it really looks; tap one for a larger preview with Buy or Use.
- Guide: one block per feature with Open, Locked (and how it unlocks) or Off.
- Add talent: four sections with one help line under each field. Place is gone from Add talent, slot editing and the talent page (old place data is kept but not used).
- Export to Calendar removed.
- Validation data: a Check at the top compares last week with the goals (On track, Worth a look, Not enough data yet) with a suggestion under each "Worth a look". "Copy data for review" copies every table as plain text.
- Copy: S72-S104, L76-L84 and G01-G13 added; S57, S58 and L53 removed; L60, L61, L62 and L69 updated. New label L85 "Material" (attribute editor on the talent page).

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
