// Navigation hub. main.js fills these functions in; screens call them at runtime.
// (Keeps screens from importing each other.)

export const app = {
  home: () => {}, // Today
  tab: () => {}, // tab(name): 'today' | 'talents' | 'world' | 'me'
  back: () => {}, // back arrow of a page: the tab it was opened from
  refresh: () => {}, // refresh({ force }): draw the current screen again
  welcome: () => {},
  addTalent: () => {},
  setup: () => {}, // setup(talentId): Set up for a talent from before data v5
  talent: () => {}, // talent(id, { openChecks })
  targetStep: () => {},
  challenge: () => {}, // challenge intro
  challengeBack: () => {},
  challengeRun: () => {},
  challengeResult: () => {},
  checkpoint: () => {},
  needsWork: () => {},
  talentPage: () => {}, // talentPage(talentId, 'challenges' | 'fixed' | 'recordings')
  finish: () => {},
  companion: () => {},
  vaultRules: () => {},
  appearance: () => {},
  guide: () => {},
  howItWorks: () => {},
  settings: () => {},
};
