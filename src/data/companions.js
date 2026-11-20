// The 30 virtual companions (fixed data).
// attendance: base chance of practicing on a day. growth: fast | medium | slow.
// tone: gentle | brief | firedUp (used for congratulations).

export const COMPANIONS = Object.freeze([
  { id: 1, title: 'Early-rising office worker', talent: 'Japanese', personality: 'Practices before leaving home. Rarely changes.', attendance: 0.9, preferredTime: '06:30', growth: 'medium', startRank: 'D', tone: 'brief' },
  { id: 2, title: 'Night-owl college student', talent: 'Guitar', personality: 'Often leaves it until midnight. Skips now and then.', attendance: 0.6, preferredTime: '23:30', growth: 'fast', startRank: 'E', tone: 'firedUp' },
  { id: 3, title: 'Grandma, 40 years in', talent: 'Calligraphy', personality: "Hasn't stopped in 40 years.", attendance: 0.98, preferredTime: '05:30', growth: 'slow', startRank: 'B', tone: 'gentle' },
  { id: 4, title: 'Career-switching new developer', talent: 'Web development', personality: 'Grows fast, gets stuck often.', attendance: 0.75, preferredTime: '21:00', growth: 'fast', startRank: 'E', tone: 'brief' },
  { id: 5, title: 'Shift-work nurse', talent: 'Piano', personality: 'Practice follows the shift schedule.', attendance: 0.65, preferredTime: '15:00', growth: 'medium', startRank: 'D', tone: 'gentle' },
  { id: 6, title: 'Grad who lives on the court', talent: 'Basketball shooting', personality: 'At the court every day.', attendance: 0.8, preferredTime: '17:30', growth: 'fast', startRank: 'E', tone: 'firedUp' },
  { id: 7, title: "Mom after the kids' bedtime", talent: 'Watercolor', personality: 'Free only after the kids are asleep.', attendance: 0.7, preferredTime: '22:00', growth: 'medium', startRank: 'D', tone: 'gentle' },
  { id: 8, title: 'Commuting engineer', talent: 'English speaking', personality: 'Practices on the commute. Rests on weekends.', attendance: 0.72, preferredTime: '07:50', growth: 'medium', startRank: 'C', tone: 'brief' },
  { id: 9, title: 'Lunch-break designer', talent: 'Sketching', personality: 'One sketch every lunch break.', attendance: 0.85, preferredTime: '12:30', growth: 'medium', startRank: 'C', tone: 'gentle' },
  { id: 10, title: 'Delivery rider between orders', talent: 'Korean', personality: 'Practices while waiting for orders.', attendance: 0.68, preferredTime: '14:00', growth: 'medium', startRank: 'E', tone: 'firedUp' },
  { id: 11, title: 'Grad student, gone at exams', talent: 'Violin', personality: 'Always stops during exams.', attendance: 0.62, preferredTime: '20:00', growth: 'slow', startRank: 'D', tone: 'brief' },
  { id: 12, title: 'Chef who writes after closing', talent: 'Short fiction', personality: 'Starts writing after the restaurant closes.', attendance: 0.66, preferredTime: '00:30', growth: 'medium', startRank: 'E', tone: 'firedUp' },
  { id: 13, title: 'Accountant, busy at month-end', talent: 'Ukulele', personality: 'Busy at month-end, steady at month-start.', attendance: 0.7, preferredTime: '21:30', growth: 'fast', startRank: 'E', tone: 'gentle' },
  { id: 14, title: "Student who can't stop drawing", talent: 'Digital illustration', personality: 'Long sessions, then a few days off.', attendance: 0.58, preferredTime: '23:00', growth: 'fast', startRank: 'D', tone: 'brief' },
  { id: 15, title: 'Teacher, busiest on school breaks', talent: 'Japanese', personality: 'Practices most during school breaks.', attendance: 0.78, preferredTime: '20:30', growth: 'medium', startRank: 'D', tone: 'gentle' },
  { id: 16, title: 'Traveling salesperson', talent: 'Drums', personality: 'Travels a lot, catches up at home.', attendance: 0.6, preferredTime: '19:30', growth: 'medium', startRank: 'E', tone: 'firedUp' },
  { id: 17, title: 'Freelancer with a steady routine', talent: 'French', personality: 'Keeps a steady routine.', attendance: 0.88, preferredTime: '09:00', growth: 'medium', startRank: 'C', tone: 'brief' },
  { id: 18, title: 'Retired uncle, 4 p.m. sharp', talent: 'Erhu', personality: 'Practices every afternoon at the same time.', attendance: 0.95, preferredTime: '16:00', growth: 'slow', startRank: 'C', tone: 'gentle' },
  { id: 19, title: 'Weekend-only office worker', talent: 'Singing', personality: 'Has real time only on weekends.', attendance: 0.64, preferredTime: '21:00', growth: 'medium', startRank: 'E', tone: 'firedUp' },
  { id: 20, title: 'CS student before contests', talent: 'Algorithms', personality: 'Sprints before contests.', attendance: 0.74, preferredTime: '22:00', growth: 'fast', startRank: 'D', tone: 'brief' },
  { id: 21, title: 'Hairdresser on days off', talent: 'Photography', personality: 'Practices most on salon days off.', attendance: 0.67, preferredTime: '10:00', growth: 'medium', startRank: 'D', tone: 'gentle' },
  { id: 22, title: 'Chess fan, one puzzle a day', talent: 'Chess', personality: 'Solves one puzzle every day.', attendance: 0.92, preferredTime: '12:45', growth: 'slow', startRank: 'B', tone: 'brief' },
  { id: 23, title: 'Dancer before showtime', talent: 'Street dance', personality: 'Sprints before shows.', attendance: 0.7, preferredTime: '19:00', growth: 'fast', startRank: 'D', tone: 'firedUp' },
  { id: 24, title: 'Taxi driver between rides', talent: 'English listening', personality: 'Practices while waiting for passengers.', attendance: 0.8, preferredTime: '15:30', growth: 'slow', startRank: 'D', tone: 'gentle' },
  { id: 25, title: 'Piano beginner at 60', talent: 'Piano (from zero)', personality: 'Started at 60. Very steady.', attendance: 0.9, preferredTime: '08:30', growth: 'slow', startRank: 'E', tone: 'gentle' },
  { id: 26, title: 'Researcher who pauses when busy', talent: 'German', personality: 'Stops for a while when work gets busy.', attendance: 0.6, preferredTime: '22:30', growth: 'medium', startRank: 'D', tone: 'brief' },
  { id: 27, title: 'Early-shift barista', talent: 'Latte art', personality: 'Pours 10 cups before work.', attendance: 0.85, preferredTime: '07:00', growth: 'medium', startRank: 'C', tone: 'firedUp' },
  { id: 28, title: 'Weekend woodworker', talent: 'Woodworking', personality: 'Works only on weekends.', attendance: 0.55, preferredTime: '14:00', growth: 'slow', startRank: 'D', tone: 'brief' },
  { id: 29, title: 'Social worker, signing after work', talent: 'Sign language', personality: 'Practices after work, every day.', attendance: 0.82, preferredTime: '20:00', growth: 'medium', startRank: 'D', tone: 'gentle' },
  { id: 30, title: 'Magic club student', talent: 'Magic', personality: 'Very active in the club during the semester.', attendance: 0.72, preferredTime: '16:30', growth: 'fast', startRank: 'E', tone: 'firedUp' },
]);

// Companion event definitions (copy sheet part 3). kind: down | up | growth | global | none.
// multiplier: attendance multiplier. days: [min, max] duration.
export const EVENTS = Object.freeze({
  E01: { kind: 'down', multiplier: 0.2, days: [3, 7] },
  E02: { kind: 'down', multiplier: 0.4, days: [3, 10] },
  E03: { kind: 'down', multiplier: 0.3, days: [5, 14] },
  E04: { kind: 'down', multiplier: 0.2, days: [5, 10] },
  E05: { kind: 'down', multiplier: 0.4, days: [7, 14] },
  E06: { kind: 'down', multiplier: 0.5, days: [5, 14] },
  E07: { kind: 'up', multiplier: 1.3, days: [7, 14] },
  E08: { kind: 'up', multiplier: 1.2, days: [14, 14], growthBoost: true },
  E09: { kind: 'up', multiplier: 1.2, days: [7, 7] },
  E10: { kind: 'growth', multiplier: 1, days: [14, 14], growthPaused: true },
  E11: { kind: 'growth', multiplier: 1, days: [1, 1] },
  E12: { kind: 'growth', multiplier: 1, days: [1, 1] },
  E13: { kind: 'growth', multiplier: 1, days: [1, 1] },
  E14: { kind: 'global', multiplier: 0.7, days: [3, 3] },
  E15: { kind: 'global', multiplier: 0.8, days: [1, 1] },
  E16: { kind: 'none' },
});
