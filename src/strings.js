// All user-visible text. Keys are the copy codes (S01, L01, ...).
// Do not write sentences anywhere else in the app; look them up with text() from text.js.
// Lists that the copy sheet separates with " · " are stored as arrays.

export const S = {
  // Home task card
  S01: '[TRAINING] {talent} · {attribute}',
  // S02 is produced by the practice patterns (P series).
  S03: '{size} · {min} min · +{exp} EXP',
  S04: 'Next training slot: {day} {anchor} (around {time})',
  S05: '{talent} · {attribute} | {min} min',
  S06: '[SYSTEM] Enough for today. Next training slot: {day} {time}.',
  S07: 'This week {done}/{planned}. Mini counts too.',
  S08: '[BASELINE] {talent} | {piece} · 2 min. Record your starting point.',
  S09: 'Slot moved to {day} {time}.',

  // Finish screen
  S10: '[CLEAR] +{exp} EXP',
  S11: '[CLEAR] Mini +6 EXP. Counts for this week.',
  S12: '{attribute} difficulty up: {old} → {new}',
  S13: '{attribute} difficulty down: {old} → {new}',
  S14: '[CRITICAL HIT] Chest: Mana Stone ×5',
  S15: '[CRITICAL HIT] Chest: Vault Ticket ×1',
  S16: "[MATERIAL CLEARED] {material} reached its target. What's next?",
  S17: '[LEVEL UP] Lv {old} → Lv {new}',
  S18: '[WEEKLY WIN] This week {done}/{planned}. Win #{count}.',
  S19: 'Save a 30-sec record? You can skip.',

  // Trial
  S20: '[TRIAL] {talent} · {piece}. Eligible.',
  S21: '[TRIAL] Warm-up, 5 min: {material}, one step easier.',
  S22: '[TRIAL] Measured run, 2 min. Record your {metric} at the end.',
  S23: 'This time: {value}   Last time: {prev}   To pass: {target}',
  S24: 'Last time and this time, side by side. Can you hear or see the improvement?',
  S25: '[TRIAL PASSED] {talent} is now Rank {rank}. {metric}: {old} → {new}.',
  S26: '[TRIAL PASSED] Rank {rank} progress: {k}/{need}.',
  S27: '[TRIAL] Still needed: {metric} {gap}. Retry from {date}.',
  S28: '[TRIAL PASSED] {talent} Rank S ★{count}.',
  S29: '[CLASS CHANGE] {talent} reached Rank C. New material for all 4 attributes. New trial piece.',
  S30: 'Main talent for the next 4 weeks: {talent}. Change it?',

  // Plateau dungeon
  S31: '[PLATEAU DUNGEON] {talent} · {attribute}: a different method this week.',
  S32: '[PLATEAU DUNGEON] {talent} · {attribute}: back to the usual method.',

  // Return and dormant
  S33: '[SYSTEM] Welcome back. Start with 2 minutes.',
  S34: 'Difficulty is one step lower. Do your slots still fit?',
  S35: '[AWAKEN] {talent}: 2-min retest first. Rank stays {rank}.',
  S36: '[AWAKEN] Retest done. Difficulty reset for each attribute.',

  // Sunday check
  S37: '[NEXT WEEK] {count} slots. Keep them?',
  S38: '[NEXT WEEK] Same slots as last week.',
  S39: 'This week, the app made my stress: 1 much lower … 5 much higher',

  // System Vault
  S40: '[SYSTEM VAULT] Now open. 1 ticket per Standard or Deep session.',
  S41: '[DRAW] #{draw}: {a} · {b} · {c}. Your {k} tickets: no prize.',
  S42: '[DRAW] #{draw}: 2 numbers matched. Prize: {prize}.',
  S43: '[DRAW] #{draw}: 3 numbers matched. Jackpot: Mana Stone ×{pool} + legendary title "{title}". Added to Pending.',
  S44: '[DRAW] {count} draws since your last session: {x} prizes, {y} jackpots.',
  S45: 'Pending released: Mana Stone ×{m} ({r} left).',
  S46: 'Draw #{draw} jackpot: {name}, Mana Stone ×{pool}.',

  // First use
  S47: '[SYSTEM] Registration complete. Your first quest is ready.',
  S48: 'Tap Share → Add to Home Screen. It opens full screen, and your data is less likely to be cleared.',
  S49: 'These companions are virtual. They follow public rules.',

  // Version 10 additions
  S50: 'Lv {lv} · {talent} Rank {rank}',
  S51: 'This week {done}/{planned}',
  S52: 'First 4 weeks: up to 5 slots a week is recommended.',
  S53: 'Virtual companion. Behavior follows public rules: base attendance + daily roll + special events.',
  S54: 'Your data lives only on this iPhone. No backup. Deleting the Home Screen icon deletes the data too.',
  S55: 'Move {count} slots from the old main talent to {talent}?',
  S56: 'This time, raise speed or length by one step and keep 0 mistakes.',
  // S57 and S58 were deleted in copy version 14 (calendar export removed); do not reuse.
  S59: '{count} practice days',
  S60: 'EXP comes from every session. It raises your Lv and unlocks nothing.',
  S61: 'Trials decide your rank: a 2-min measured run every 4 weeks (Main) or 8 weeks (Maintain).',
  S62: "Your answer sets next time's difficulty.",
  S63: '2 min counts for the week too.',

  // Version 11 additions
  S64: 'Version {version}',

  // Version 12 additions
  // S04 without an anchor (the time is exact, so no "around").
  S65: 'Next training slot: {day} {time}',

  // System Vault "Rules & verification" page (spec 5.11).
  S66: 'Each ticket has 3 different numbers from 1 to 14. A draw opens every 3 days at 00:00 and picks 3 numbers. A ticket joins the next draw after it is made.',
  S67: 'Chance per ticket: jackpot (3 numbers match) 1/364, prize (2 numbers match) 33/364.',
  S68: 'Each ticket adds 1 Mana Stone to the pool. Jackpot winners share the whole pool, rounded down; the rest stays. With no jackpot, the pool carries over. Prizes do not come from the pool.',
  S69: 'How the numbers are drawn: the draw date and every ticket of the draw (owner, time, numbers; sorted by owner, then time) are joined into one text. Its SHA-256 hash is read byte by byte. Bytes of 252 or more are skipped; each other byte gives (byte mod 14) + 1. Repeats are skipped until there are 3 numbers. If the hash runs out, it is hashed again.',
  S70: 'Owner 0 is you. Owners 1-30 are the companions, in the order of their profiles.',
  S71: 'Draw #{draw} · {date}: {a} · {b} · {c} | {count} tickets | Pool {pool}',

  // Version 14 additions
  // Past slot card, muted line above S01 (spec 6.2 item 4).
  S72: 'Slot time was {day} {time}. Any time this week counts.',

  // Validation data: Check (spec 10.1).
  S73: 'Based on last week, from {date}.',
  S74: 'Sessions: {done} of {planned} · Goal: {goal} or more',
  S75: 'Started within 15 min of the slot: {x}% · Goal: 50% or more',
  S76: 'Open to Start: {x} sec · Goal: 10 sec or less',
  S77: 'Just right: {x}% (too easy {a}%, too hard {b}%) · Goal: 50–75%',
  S78: 'Stress: {x} / 5 on average · Goal: 2.5 or lower',
  S79: 'Material edits: {count} · Goal: 2 or fewer',
  S80: 'Adding a talent: {x} sec · Goal: 90 sec or less',
  S81: 'Last trial: {talent} {metric} {old} → {new}',
  S82: 'Fewer or shorter slots may fit better. Change them on the Sunday card.',
  S83: 'Try a different anchor or time for the slots that start late.',
  S84: 'Starting takes a while. Note what slowed you down.',
  S85: 'Mostly too easy. Raise the start values or targets with a long press.',
  S86: 'Mostly too hard. Try Mini more often, or lower the start values with a long press.',
  S87: 'Try one week with Companions or the Vault off, then compare.',
  S88: 'Write each material as one concrete item, like "G to C change".',
  S89: 'Note which fields were unclear.',
  S90: 'Copied. Paste it into a chat or your notes.',

  // Add talent: one help line under each field (spec 5.6).
  S91: 'Sets the starting difficulty. You can change it later.',
  S92: 'One short line each. Fill 1 or 2 to start; empty ones are skipped.',
  S93: 'A basic move to repeat without mistakes. e.g. G to C chord change',
  S94: 'A whole piece to do from start to finish. e.g. Twinkle Twinkle',
  S95: 'Something to record and compare with a model. e.g. my strumming vs the original',
  S96: 'Things to learn and use, as a plural. e.g. chords',
  S97: 'How many in a row, or how long, to begin with. Filled in from your level.',
  S98: "Optional. Leave it empty if speed doesn't apply. BPM turns on a metronome.",
  S99: 'Every 4 or 8 weeks you record 2 minutes of this and compare it with last time. e.g. Twinkle Twinkle, first 2 min',
  S100: 'Speed: faster is better · Mistakes: fewer is better · Length or count: more is better · Time: shorter is better',
  S101: 'What the number counts, e.g. BPM, words, sec.',
  S102: 'Main: your focus, 3 slots a week, a trial every 4 weeks · Maintain: keep it going, 1 slot a week, a trial every 8 weeks · Dormant: paused, no slots, rank kept',
  S103: 'A daily moment to start after, e.g. after dinner. Optional.',
  S104: '15 min: one drill · 45 min: warm-up, drill, cool-down',
};

// Practice patterns. *_MINI are the mini variants from the notes column.
export const P = {
  P1: '{material} | {n} in a row, no mistakes | {speed}',
  P2: '{material}, start to finish | no stopping | length {n}',
  P2_MINI: 'The opening section of {material}',
  P3: 'Record {material} and compare with a reference | find {n} differences',
  P3_MINI: 'Record {material} and compare with a reference | find 1 difference',
  P4: 'Learn {n} new {material} | use each once without notes',
  P5: 'Half speed: {material} | {speed} | {n} in a row, no mistakes',
  P5_NO_SPEED: 'twice the time for each',
  P6: 'Only the part you miss most: {material} | {n} in a row, no mistakes',
  P7: '{min}-min challenge: {material} | as many as you can | record the count',
};

// Companion events: [Text A, Text B].
export const E = {
  E01: ['{name} has a cold. {talent} is on hold for a few days.', '{name} is sick and taking a few days off.'],
  E02: ['{name} is on a business trip. {talent} is paused.', '{name} is traveling and practices now and then.'],
  E03: ['{name} has exams. {talent} can wait.', '{name} is studying for exams.'],
  E04: ['{name} is moving. The gear is still in boxes.', '{name} is moving house. {talent} is paused.'],
  E05: ["{name} hasn't done much {talent} lately.", '{name} took a few days off {talent}.'],
  E06: ['{name} is working late and practicing less.', '{name} is busy at work. Less {talent} for now.'],
  E07: ['{name} has a show next week. {talent} sprint is on.', '{name} is preparing for a contest and practicing daily.'],
  E08: ['{name} found a new teacher and started {talent} lessons.', '{name} switched to a new {talent} teacher.'],
  E09: ['{name} got new gear and is practicing more.', '{name} bought new gear.'],
  E10: ["{name}'s {talent} has been stuck at the same stage for 2 weeks.", "{name} keeps practicing. Rank hasn't moved yet."],
  E11: ["{name}'s {talent} broke through the plateau.", '{name} got past the stuck stage.'],
  E12: ["{name}'s {talent} reached Rank {rank}.", '{name}: {talent} Rank {rank}.'],
  E13: ['{name} is back to {talent}.', '{name} took a break and came back today.'],
  E14: ['Long weekend. Everyone is practicing less.', 'First day of the long weekend. The feed is quiet.'],
  E15: ['Typhoon day. Some practice more at home, some rest.', 'Typhoon day. Everyone is staying in.'],
  E16: ['{name} practiced {talent} for {min} min.', "{name} finished today's {talent}."],
};

// Congratulations by tone.
export const C = {
  C1: { gentle: '{done} sessions this week. You made it. Congrats.', brief: 'Weekly win +1.', firedUp: 'Weekly win! Win #{count}!' },
  C2: { gentle: '{talent} reached Rank {rank}. Congrats.', brief: '{talent} Rank {rank}. Congrats.', firedUp: '{talent} Rank {rank}! Rank up!' },
  C3: { gentle: 'Good to see you practicing {talent} again.', brief: 'Back.', firedUp: "You're back! Let's keep going!" },
  C4: { gentle: '{talent} got past the stuck part.', brief: 'Plateau cleared.', firedUp: 'Plateau Dungeon cleared!' },
  C5: { gentle: "Hello. I'm practicing {companionTalent} too.", brief: 'Hi. I do {companionTalent}.', firedUp: "Hey! I'm on {companionTalent}. Let's go!" },
};

// Interface labels.
export const L = {
  L01: 'Start',
  L02: 'Done',
  L03: 'Cancel',
  L04: 'Too easy',
  L05: 'Just right',
  L06: 'Too hard',
  L07: 'Reschedule',
  L08: 'Keep for now',
  L09: 'Do it now',
  L10: 'Not now',
  L11: 'Later',
  L12: 'Yes',
  L13: 'No',
  L14: 'OK',
  L15: 'Skip',
  L16: 'Delete',
  L17: 'Tap again to delete',
  L18: 'Rename',
  L19: 'Awaken',
  L20: '+ Add talent',
  L21: 'Save',
  L22: 'Change slots',
  L23: 'Play',
  L24: 'Record',
  L25: 'Stop',
  L26: 'Take photo',
  L27: 'Paste text',
  L28: 'Record full piece (optional)',
  L29: 'Save image',
  L30: 'Share',
  L31: 'Buy',
  L32: 'Use',
  L33: 'In use',
  L34: 'Recompute this draw',
  L35: 'Matches the record',
  L36: 'Does not match the record',
  L37: 'Rules & verification',
  L38: 'Metronome',
  L39: ['On', 'Off'],

  L40: 'Mini',
  L41: 'Standard',
  L42: 'Deep',
  L43: '{min} min',
  L44: ['Warm-up', 'Main', 'Cool-down'],
  L45: 'Main',
  L46: 'Maintain',
  L47: 'Dormant',
  L48: 'Rank {rank}',
  L49: ['Fundamentals', 'Performance', 'Perception', 'Knowledge'],
  L50: ['Beginner', 'Basic', 'Intermediate'],
  L51: ['Speed', 'Mistakes', 'Length or count', 'Time'],
  L52: ['BPM', 'Custom'],
  // L53 (place) was deleted in copy version 14; do not reuse.
  L54: ['In 1 hour', 'Tonight 21:00', 'Tomorrow, same time'],
  L55: ['Today', 'Tomorrow', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  L56: 'Limit reached: {count}',

  L60: ['This Week', 'Talents', 'Feed', 'System Vault', 'Appearance', 'Guide', 'Settings'],
  L61: ['Name', 'Level', 'Start', 'Speed (optional)', 'Trial piece', 'Measure by', 'Unit', 'Role', 'Training slots'],
  L62: ['Day', 'Anchor (optional)', 'Time', 'Length'],
  L63: ['Material history', 'Target', 'Slots', 'Trial history'],
  L64: ['Trials', '30-sec records', 'Pick two to compare'],
  L65: ['Talent', 'Personality', 'Rank', 'Base attendance', 'Preferred time', 'Current event', 'Last 7 days'],
  L66: ['Today', 'Yesterday'],
  L67: ['Next draw', 'Pool', 'Your tickets', 'Recent draws', 'No prize', 'Prize', 'Jackpot'],
  L68: ['Mana Stones', 'Themes', 'Badges', 'Title frames', 'Titles'],
  L69: ['Companions', 'System Vault', 'Lucky numbers', 'Auto pick', 'About your data', 'Validation data'],
  // Version 12 additions
  L71: 'sec', // unit for Performance length
  L72: 'Back', // back button (accessibility label of the back arrow)
  L73: 'Mana Stone ×{n}', // vault prize and prices
  L74: 'talent-rpg', // app name under the Home Screen icon; keep manifest.webmanifest and index.html in sync
  // Version 13 additions
  L75: '+ Add slot', // talent page: add training slots (spec 5.8)

  // Version 14 additions
  L76: 'Switch attribute', // under the task card (spec 5.1, 6.4)
  L77: 'Other talent',
  L78: 'Copy data for review',
  L79: ['On track', 'Worth a look', 'Not enough data yet'],
  L80: 'Details',
  L81: ['Today', 'Talents', 'World', 'Me'], // tab bar (spec 5.0)
  L82: ['Appearance', 'Guide', 'Settings'], // rows of the Me tab
  L83: ['Open', 'Locked', 'Off'], // Guide status
  L84: ['Talent', 'What to practice', 'Trial', 'Role and slots'], // Add talent sections

  // Added in the app (not yet in the copy sheet):
  L85: 'Material', // talent page: material field of the attribute editor (L61 no longer has it)

  L70: [
    'Sessions vs planned',
    'On-time start rate',
    'Off-slot share',
    'Seconds to Start (median)',
    'Time to add a talent',
    'Material edits',
    'Too easy / Just right / Too hard',
    'Opens without practice',
    'Stress score',
    'Companions / Vault on-off periods',
    'Trial results',
  ],
};

// Guide (spec 5.12): title, text, unlock (null = open from the start).
export const G = {
  G01: { title: 'Training slots', text: 'Planned start times for each talent. A slot is a cue, not a deadline: any time that week counts.', unlock: null },
  G02: { title: 'Sizes', text: '2, 15 or 45 min. All count for the week. Only 15 and 45 change difficulty and count for trials.', unlock: null },
  G03: { title: 'Difficulty', text: 'After 15 or 45 min, answer Too easy, Just right or Too hard. Two of the same in a row moves the difficulty one step.', unlock: null },
  G04: { title: 'EXP and Lv', text: 'Every session gives EXP. Lv only goes up and unlocks nothing.', unlock: null },
  G05: { title: 'Weekly win', text: 'Finish your planned sessions for the week. With 3 or more planned, one fewer is enough.', unlock: null },
  G06: { title: 'Main, Maintain, Dormant', text: 'Main is your focus. Maintain keeps a talent going. Dormant pauses it and keeps its rank.', unlock: null },
  G07: { title: 'Trials and Rank', text: 'A 2-min measured run, compared with last time. Passing raises the rank from E to S.', unlock: 'Every 4 weeks for Main and 8 for Maintain, after 3/4 of the planned sessions.' },
  G08: { title: 'Critical hit', text: 'Sometimes a chest after a session: Mana Stones, or a Vault ticket once the Vault is open.', unlock: 'After a 15 or 45-min session marked Just right or Too hard.' },
  G09: { title: 'Mana Stones and Appearance', text: 'Spend Mana Stones on themes, badges and title frames.', unlock: 'Your first Mana Stones come from a critical hit.' },
  G10: { title: 'Plateau Dungeon', text: 'A different method for one week when progress stalls.', unlock: 'When a trial is not passed twice in a row, or a difficulty stays the same for 4 weeks.' },
  G11: { title: 'Companions', text: '30 virtual companions with their own talents. They congratulate milestones and fill the Feed.', unlock: null },
  G12: { title: 'System Vault', text: 'A draw every 3 days with a pool shared with the companions. 1 ticket per 15 or 45-min session.', unlock: 'When any talent reaches Rank D.' },
  G13: { title: 'Class change', text: 'New material for all 4 attributes and a new trial piece.', unlock: 'When a talent reaches Rank C.' },
};

// Item names.
export const ITEMS = {
  legendaryTitles: ['Before Dawn', 'The Lamp That Stays Lit', 'The Thousandth Time', 'Quiet Strength', 'The One Who Finished'],
  themes: [
    'Pure Black', 'Terminal', 'Typewriter', 'Notebook', 'Ink', 'Newspaper',
    'Blueprint', 'Midnight', 'Stone', 'Arcade', 'Daylight', 'High Contrast',
  ],
  badges: ['Circle', 'Square', 'Triangle', 'Diamond', 'Hexagon', 'Double Circle', 'Cross', 'Star'],
  titleFrames: ['Single Line', 'Double Line', 'Dashed', 'Bold', 'Rounded', 'Square Brackets', 'Double Brackets', 'None'],
};
