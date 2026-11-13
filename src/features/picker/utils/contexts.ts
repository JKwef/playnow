import type { ContextId, PickerContext } from '../types';

/** Четыре контекста из FR4.1. Жанры — те же ключи, что сохраняет обогащение из RAWG. */
export const PICKER_CONTEXTS: readonly PickerContext[] = [
  {
    id: 'short-session',
    title: 'Головоломки и аркады',
    description: 'Задачи, аркады и казуальные игры',
    icon: '🧩',
    genres: ['puzzle', 'arcade', 'casual'],
  },
  {
    id: 'addictive',
    title: 'Ещё один забег',
    description: 'Рогалики и «ещё один забег»',
    icon: '🌀',
    genres: ['puzzle', 'arcade', 'roguelike'],
  },
  {
    id: 'story',
    title: 'Погрузиться в мир',
    description: 'Истории, RPG и приключения',
    icon: '📖',
    genres: ['rpg', 'adventure', 'narrative'],
  },
  {
    id: 'action',
    title: 'Больше драйва',
    description: 'Шутеры, платформеры, драйв',
    icon: '💥',
    genres: ['action', 'shooter', 'platformer'],
  },
];

export const findContext = (id: string): PickerContext | undefined =>
  PICKER_CONTEXTS.find((context) => context.id === id);

export const isContextId = (id: string): id is ContextId => findContext(id) !== undefined;
