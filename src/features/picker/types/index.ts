/** Идентификаторы контекстов Solo Mode (FR4.1). Используются в маршруте Result. */
export type ContextId = 'short-session' | 'addictive' | 'story' | 'action';
export type PickerMode = 'new' | 'continue';
export type GenreFilter = 'context' | 'any';

export const PICKER_MODE_LABELS: Record<PickerMode, string> = {
  new: 'Новое',
  continue: 'Продолжить',
};
export const isPickerMode = (value: unknown): value is PickerMode =>
  value === 'new' || value === 'continue';

export interface PickerContext {
  id: ContextId;
  title: string;
  description: string;
  /** Эмодзи-иконка: без сторонней библиотеки иконок. */
  icon: string;
  /** Игра подходит, если у неё есть хотя бы один из этих жанров. */
  genres: readonly string[];
}
