/** Идентификаторы контекстов Solo Mode (FR4.1). Используются в маршруте Result. */
export type ContextId = 'short-session' | 'addictive' | 'story' | 'action';

export interface PickerContext {
  id: ContextId;
  title: string;
  description: string;
  /** Эмодзи-иконка: без сторонней библиотеки иконок. */
  icon: string;
  /** Игра подходит, если у неё есть хотя бы один из этих жанров. */
  genres: readonly string[];
  /** Дополнительное условие: наиграно меньше стольких минут. */
  maxPlaytimeMinutes?: number;
}
