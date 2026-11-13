/** Quaeso: тёмные зелёные поверхности и мятный акцент логотипа. */
export const darkColors = {
  primary: '#65D6A6',
  secondary: '#65D6A6',
  background: '#0C1513',
  surface: '#16231F',
  elevated: '#21332C',
  mintMuted: '#203D30',
  brandPaper: '#EDF7F1',
  onPrimary: '#092519',
  textPrimary: '#F1F6F3',
  textSecondary: '#A6B9AF',
  error: '#FF9BA9',
  border: '#30453A',
} as const;

export type ColorToken = keyof typeof darkColors;
export type ThemeColors = Readonly<Record<ColorToken, string>>;

export const lightColors: ThemeColors = {
  primary: '#176647',
  secondary: '#176647',
  background: '#F4F8F5',
  surface: '#FFFFFF',
  elevated: '#E5EEE7',
  mintMuted: '#D8F0E2',
  brandPaper: '#EDF7F1',
  onPrimary: '#FFFFFF',
  textPrimary: '#14281D',
  textSecondary: '#4E6556',
  error: '#B72D46',
  border: '#CBDACF',
};
