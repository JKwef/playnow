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

export const themePalettes = {
  spectrum: darkColors,
  spectrumLight: lightColors,
  dark: darkColors,
  light: lightColors,
  glass: {
    ...lightColors,
    background: '#DDEAF7',
    surface: 'rgba(255,255,255,0.76)',
    elevated: 'rgba(255,255,255,0.9)',
    border: '#A0B8D0',
    primary: '#245380',
    secondary: '#245380',
    mintMuted: '#C9DDF3',
    textPrimary: '#162D46',
    textSecondary: '#3C5771',
  },
  green: {
    ...darkColors,
    background: '#09251A',
    surface: '#113C2B',
    elevated: '#19513A',
    border: '#397B58',
    primary: '#62E49F',
    secondary: '#62E49F',
    mintMuted: '#21533C',
    textPrimary: '#EBFFF2',
    textSecondary: '#B3D7C0',
  },
  burgundy: {
    ...darkColors,
    background: '#261019',
    surface: '#391823',
    elevated: '#502330',
    border: '#784153',
    primary: '#FF9EAE',
    secondary: '#FF9EAE',
    mintMuted: '#562537',
    onPrimary: '#39101D',
    textPrimary: '#FFF0F4',
    textSecondary: '#E3BBC7',
  },
} satisfies Record<string, ThemeColors>;
