// Navigation hub. main.js fills these functions in; screens call them at runtime.
// (Keeps screens from importing each other.)

export const app = {
  home: () => {}, // Today
  tab: () => {}, // tab(name): 'today' | 'talents' | 'world' | 'me'
  back: () => {}, // back arrow of a page: the tab it was opened from
  refresh: () => {}, // draw the current screen again
  welcome: () => {},
  addTalent: () => {},
  talent: () => {},
  timer: () => {},
  finish: () => {},
  trial: () => {},
  companion: () => {},
  vaultRules: () => {},
  appearance: () => {},
  guide: () => {},
  settings: () => {},
  validation: () => {},
};
