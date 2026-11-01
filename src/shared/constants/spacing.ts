/** Шкала отступов из UI1 (8 / 16 / 24 / 32). */
export const spacing = {
  xs: 8,
  sm: 16,
  md: 24,
  lg: 32,
} as const;

/** Радиусы скругления из UI1. */
export const radius = {
  button: 8,
  card: 16,
} as const;

export type SpacingToken = keyof typeof spacing;
