// All tunable numbers in one place (spec section 9). Adjust after the trial period.

export const CONFIG = Object.freeze({
  exp: { mini: 6, standard: 30, deep: 80 },

  // EXP needed to go from Lv L to L+1 = round(base * growth^(L-1))
  levelCurve: { base: 100, growth: 1.1 },

  sizes: {
    mini: { minutes: 2 },
    standard: { minutes: 15 },
    deep: { minutes: 45, warmUp: 5, main: 35, coolDown: 5 },
  },

  // Starting difficulty by level: beginner / basic / intermediate
  startDifficulty: {
    count: { beginner: 3, basic: 5, intermediate: 8 },
    performanceLengthSec: { beginner: 30, basic: 60, intermediate: 120 },
    speedBpm: { beginner: 60, basic: 70, intermediate: 80 },
  },
  targetMultiplier: 2,

  knob: {
    countFactor: 1.2, // N x1.2 per step, at least +/-1
    countMinStep: 1,
    speedPercent: 0.05, // +/-5% per step
    speedBpmStep: 5, // BPM +/-5 per step
    floorRatio: 0.5, // never below half of the start value
    streakToChange: 2, // 2 same answers in a row
  },

  mini: { countFactor: 1 / 3, countMin: 1 },

  crit: { chance: 1 / 5, stoneAmount: 5, ticketAmount: 1, stoneShareAfterUnlock: 0.5 },

  trial: {
    cycleWeeks: { main: 4, maintain: 8 },
    eligibilityRatio: 3 / 4,
    retryAfterWeeks: 2,
    measuredRunMin: 2,
    warmUpMin: 5,
    steps: {
      speedBpm: 5,
      speedPercent: 0.05,
      mistakesPercent: 0.2,
      mistakesMin: 1,
      lengthPercent: 0.1,
      lengthMin: 1,
      timePercent: 0.1,
      timeMinSec: 1,
    },
  },

  // Passes needed for E->D, D->C, C->B, B->A, A->S; after S each pass adds 1 star.
  rankPasses: [1, 2, 3, 4, 6],
  ranks: ['E', 'D', 'C', 'B', 'A', 'S'],

  slots: { weeklyWarnLimit: 5, warnWeeks: 4, onTimeMin: 15, beforeStartMin: 15 },
  roles: { mainMax: 1, maintainMaxEarly: 2, maintainMax: 3, earlyWeeks: 4, mainSlotsPerWeek: 3, maintainSlotsPerWeek: 1 },

  sundayCardHour: 18,
  rescheduleTonightHour: 21,
  rescheduleTonightCutoffHour: 20,
  rescheduleStepMin: 15,
  rescheduleLastHour: 23,

  returnAfterDays: 7,

  plateau: { failedTrialsInRow: 2, knobIdleWeeks: 4, minSessions: 4, methodDays: 7, breakthroughWeeks: 4 },

  vault: {
    firstDraw: '2026-01-04T00:00',
    epoch: '2026-01-01T00:00',
    everyDays: 3,
    numberMax: 14,
    numbersPerTicket: 3,
    prizeStones: 10,
    pendingReleaseRatio: 1 / 5,
    jackpotOdds: '1/364',
    prizeOdds: '33/364',
  },

  prices: { theme: 30, badge: 30, titleFrame: 15 },

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

  feed: { perDay: 10, daysBack: 7 },
  evidence: { keepPerTalent: 30, seconds: 30 },
  trialPeriodWeeks: 8,

  // Goals of the validation Check (spec 10.1). The copy (S74-S80) states the same numbers.
  check: {
    onTimeRate: 0.5, // at least
    secondsToStart: 10, // at most
    justRight: { min: 0.5, max: 0.75 },
    stress: 2.5, // average at most
    materialEdits: 2, // per week at most
    materialEditsFromWeek: 3, // weeks 1-2 are always On track
    addTalentSec: 90, // at most
  },
});
