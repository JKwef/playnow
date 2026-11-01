import { BacklogError, type BacklogErrorCode } from '../types/Game';

const MESSAGES: Record<BacklogErrorCode, string> = {
  network: 'Нет подключения к интернету',
  private_profile: 'Профиль Steam скрыт, поэтому список игр недоступен',
  unauthorized: 'Сессия истекла. Войдите снова',
  steam_unavailable: 'Steam сейчас недоступен. Попробуйте позже',
  server: 'Сервис временно недоступен. Попробуйте позже',
};

/** Пошаговая инструкция для приватного профиля (FR2.7). */
export const PRIVATE_PROFILE_STEPS = [
  'Откройте Steam и перейдите в свой профиль',
  'Нажмите «Редактировать профиль» → «Настройки приватности»',
  'Для «Мой профиль» и «Игровая информация» выберите «Открытый»',
  'Вернитесь сюда и нажмите «Повторить». Steam иногда применяет изменения несколько минут',
] as const;

export const STEAM_PRIVACY_SETTINGS_URL = 'https://steamcommunity.com/my/edit/settings';

export const backlogErrorCode = (error: unknown): BacklogErrorCode =>
  error instanceof BacklogError ? error.code : 'server';

export const backlogErrorMessage = (error: unknown): string => MESSAGES[backlogErrorCode(error)];
