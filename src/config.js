// All tunable numbers in one place (spec section 9). Adjust after the trial period.

export const CONFIG = Object.freeze({
  exp: {
    practice: 40, challenge: 40, checkpoint: 40, findStart: 40, quick: 6,
  },
  gateMultiplier: 1.5,

  // EXP needed to go from Lv L to L+1 = round(base * growth^(L-1))
  levelCurve: { base: 100, growth: 1.1 },

  // Today's target (spec 6.4): 2 passes in a row = one step toward the goal, 2 misses = one step back.
  target: { passesToStepUp: 2, missesToStepDown: 2 },

  // Step slider on Add talent page 3 (spec 5.6.2): 5-50 steps to the goal, default gap / 12.
  stepSlider: { minSteps: 5, maxSteps: 50, defaultSteps: 12 },

  // Rank cut points as a share of all steps (spec 6.3): E D C B A S.
  ranks: ['E', 'D', 'C', 'B', 'A', 'S'],
  rankShares: [0, 1 / 12, 3 / 12, 6 / 12, 9 / 12, 1],

  crit: {
    chance: 1 / 5, manaAmount: 5, ticketAmount: 1, manaShareAfterUnlock: 0.5,
  },

  slots: {
    windowBeforeMin: 15, // slot window opens 15 min before the start
    windowAfterMin: 60, // and closes 60 min after it (spec 6.8)
    weeklyWarnLimit: 5,
    warnWeeks: 4,
    mainDaysPerWeek: 3, // S121 on Add talent page 6
    maintainDaysPerWeek: 1,
  },
  talentSlotsStart: 2,
  mainMax: 1,

  sundayCardHour: 18,
  rescheduleTonightHour: 21,
  rescheduleTonightCutoffHour: 20,
  rescheduleStepMin: 15,
  rescheduleLastHour: 23,

  returnAfterDays: 7,

  plateau: { bounces: 3 }, // same value eased 3 times (spec 7.4)

  mana: { weeklyWin: 5, perRank: 10 },

  vault: {
    firstDraw: '2026-01-04T00:00',
    epoch: '2026-01-01T00:00',
    everyDays: 3,
    numberMax: 14,
    numbersPerTicket: 3,
    prizeMana: 10,
    pendingReleaseRatio: 1 / 5,
    jackpotOdds: '1/364',
    prizeOdds: '33/364',
  },

  prices: {
    theme: 30, badge: 30, titleFrame: 15, logbook: 15, keepsake: 20,
  },

  companions: {
    eventChancePerDay: 1 / 42,
    growthWeeks: { fast: 6, medium: 10, slow: 16 },
    maxRank: 'B',
    maxDownEventsAtOnce: 10,
    longWeekendChancePerDay: 1 / 90,
    typhoonChancePerDay: 1 / 30,
    typhoonMonths: [7, 8, 9],
    attendanceCap: 0.98,
    newTeacherGrowthBoost: 1.5,
    congratsMin: 1,
    congratsMax: 3,
  },

  feed: { perDay: 10 },
  trialPeriodWeeks: 8,

  undoMs: 3000, // Saved · Undo note (spec 5.3.2)
  finishStayMs: 2000, // finish screen stays about 2 s
  noteMs: 2000, // short notes under Today (S09)
});
