/**
 * Имена шрифтов Inter. Сами .ttf будут подключены через expo-font
 * на этапе полировки UI; до этого используется системный шрифт.
 */
export const fontFamily = {
  regular: 'Inter-Regular',
  medium: 'Inter-Medium',
  bold: 'Inter-Bold',
} as const;

export const fontSize = {
  caption: 12,
  body: 16,
  subtitle: 20,
  title: 28,
  display: 36,
} as const;
