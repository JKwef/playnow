import { DarkTheme, type Theme } from '@react-navigation/native';

import { colors } from '@/shared/constants';

/** Тема React Navigation на основе палитры UI1 (шапки, фон, разделители). */
export const navigationTheme: Theme = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    primary: colors.secondary,
    background: colors.background,
    card: colors.surface,
    text: colors.textPrimary,
    border: colors.border,
    notification: colors.secondary,
  },
};
