import type { ContextId, PickerContext } from '../types';

/** Четыре контекста из FR4.1. Жанры — те же ключи, что сохраняет обогащение из RAWG. */
export const PICKER_CONTEXTS: readonly PickerContext[] = [
  {
    id: 'short-session',
    title: 'У меня 30 минут',
    description: 'Короткие головоломки и аркады',
    icon: '⏱️',
    genres: ['puzzle', 'arcade', 'casual'],
    // По ТЗ: playtime < 60 мин — игры, в которые ещё не успели засесть надолго.
    maxPlaytimeMinutes: 60,
  },
  {
    id: 'addictive',
    title: 'Хочу залипательное',
    description: 'Рогалики и «ещё один забег»',
    icon: '🌀',
    genres: ['puzzle', 'arcade', 'roguelike'],
  },
  {
    id: 'story',
    title: 'Хочу сюжетку',
    description: 'RPG и приключения с историей',
    icon: '📖',
    genres: ['rpg', 'adventure', 'narrative'],
  },
  {
    id: 'action',
    title: 'Хочу экшен',
    description: 'Шутеры, платформеры, драйв',
    icon: '💥',
    genres: ['action', 'shooter', 'platformer'],
  },
];

export const findContext = (id: string): PickerContext | undefined =>
  PICKER_CONTEXTS.find((context) => context.id === id);

export const isContextId = (id: string): id is ContextId => findContext(id) !== undefined;
