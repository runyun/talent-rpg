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
  S57: 'After you change slots, export again.',
  S58: '[Training] {talent}',
  S59: '{count} practice days',
  S60: 'EXP comes from every session. It raises your Lv and unlocks nothing.',
  S61: 'Trials decide your rank: a 2-min measured run every 4 weeks (Main) or 8 weeks (Maintain).',
  S62: "Your answer sets next time's difficulty.",
  S63: '2 min counts for the week too.',

  // Version 11 additions
  S64: 'Version {version}',

  // Added in the app: S04 without an anchor (the time is exact, so no "around").
  S65: 'Next training slot: {day} {time}',
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
  L53: ['Home', 'Commute', 'Work', 'Custom'],
  L54: ['In 1 hour', 'Tonight 21:00', 'Tomorrow, same time'],
  L55: ['Today', 'Tomorrow', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  L56: 'Limit reached: {count}',

  L60: ['Talents', 'This Week', 'Progress Archive', 'Feed', 'System Vault', 'Appearance', 'Settings'],
  L61: ['Name', 'Level', 'Material', 'Speed', 'Trial piece', 'Main metric', 'Unit', 'Role', 'Training slots'],
  L62: ['Day', 'Anchor (e.g. after dinner)', 'Time', 'Length', 'Place'],
  L63: ['Material history', 'Target', 'Slots', 'Trial history'],
  L64: ['Trials', '30-sec records', 'Pick two to compare'],
  L65: ['Talent', 'Personality', 'Rank', 'Base attendance', 'Preferred time', 'Current event', 'Last 7 days'],
  L66: ['Today', 'Yesterday'],
  L67: ['Next draw', 'Pool', 'Your tickets', 'Recent draws', 'No prize', 'Prize', 'Jackpot'],
  L68: ['Mana Stones', 'Themes', 'Badges', 'Title frames', 'Titles'],
  L69: ['Companions', 'System Vault', 'Lucky numbers', 'Auto pick', 'Export to Calendar', 'About your data', 'Validation data'],
  // Added in the app (not yet in the copy sheet):
  L71: 'sec', // unit for Performance length
  L72: 'Back', // back button (accessibility label of the back arrow)

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

// Item names.
export const ITEMS = {
  legendaryTitles: ['Before Dawn', 'The Lamp That Stays Lit', 'The Thousandth Time', 'Quiet Strength', 'The One Who Finished'],
  themes: [
    'Pure Black', 'Terminal', 'Amber Screen', 'Notebook', 'Washi', 'Newspaper',
    'Blueprint', 'Night Sky', 'Forest', 'Neon', 'Daylight', 'High Contrast',
  ],
  badges: ['Circle', 'Square', 'Triangle', 'Diamond', 'Hexagon', 'Double Circle', 'Cross', 'Star'],
  titleFrames: ['Single Line', 'Double Line', 'Dashed', 'Bold', 'Rounded', 'Square Brackets', 'Double Brackets', 'None'],
};
