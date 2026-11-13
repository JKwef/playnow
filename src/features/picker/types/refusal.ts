export const REFUSAL_LABELS = {
  not_now: 'Не хочется сейчас',
  not_installed: 'Не установлена',
  already_played: 'Уже проходил',
  wrong_mood: 'Не подходит под настроение',
  other: 'Другая причина',
} as const;
export type RefusalReason = keyof typeof REFUSAL_LABELS;
export const isRefusalReason = (value: unknown): value is RefusalReason =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(REFUSAL_LABELS, value);
