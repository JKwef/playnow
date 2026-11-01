/** Палитра из UI1. Тёмная тема по умолчанию. */
export const colors = {
  primary: '#6200EE',
  secondary: '#03DAC6',
  background: '#121212',
  surface: '#1E1E1E',
  textPrimary: '#FFFFFF',
  textSecondary: '#B0B0B0',
  error: '#CF6679',
  border: '#2C2C2C',
} as const;

export type ColorToken = keyof typeof colors;
