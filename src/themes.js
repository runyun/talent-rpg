// Theme codes (copy sheet part 6) and the one theme variable that needs JavaScript:
// the progress bar style. Everything else is CSS (theme.css, [data-theme="..."]).
// The codes never change; version 14 only changed names and looks (spec section 3).

export const THEME_CODES = [
  'pureBlack', 'terminal', 'amberScreen', 'notebook', 'washi', 'newspaper',
  'blueprint', 'nightSky', 'forest', 'neon', 'daylight', 'highContrast',
];

// solid: a filled line; cells: ▮▮▮▯▯; dots: ●●●○○; text: [####------]
export const BAR_STYLES = {
  pureBlack: 'solid',
  terminal: 'text',
  amberScreen: 'text',
  notebook: 'dots',
  washi: 'dots',
  newspaper: 'cells',
  blueprint: 'cells',
  nightSky: 'solid',
  forest: 'solid',
  neon: 'cells',
  daylight: 'solid',
  highContrast: 'cells',
};

export function currentTheme() {
  const code = document.documentElement.dataset.theme;
  return THEME_CODES.includes(code) ? code : 'pureBlack';
}
