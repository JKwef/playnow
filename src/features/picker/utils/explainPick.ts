import type { Game } from '@/features/backlog/types/Game';
import type { GamePreference } from '@/features/backlog/types/GamePreference';
import { genreLabel } from '@/features/backlog/utils/genres';
import { isManualAppId } from '@/features/backlog/utils/manualGame';
import { formatPlaytime } from '@/shared/utils/format';

import { PICKER_MODE_LABELS, type PickerContext, type PickerMode } from '../types';

export const explainPick = (
  game: Game,
  context: PickerContext,
  mode: PickerMode,
  preference?: GamePreference,
  ignoreGenres = false,
): string[] => {
  const reasons: string[] = [];
  const explicit =
    mode === 'new'
      ? preference?.progressStatus === 'not_started'
      : preference?.progressStatus === 'playing';
  if (explicit)
    reasons.push(
      `Вы отметили «${mode === 'new' ? 'Не начинал' : 'Играю'}» — приоритет режима «${PICKER_MODE_LABELS[mode]}».`,
    );
  else if (game.steamImported === true && !isManualAppId(game.appid))
    reasons.push(
      mode === 'new'
        ? 'По истории Steam время игры равно нулю; статус прохождения не указан.'
        : `Выбрана по истории Steam: ${formatPlaytime(game.playtimeMinutes)} в игре, статус прохождения не указан.`,
    );
  else
    reasons.push(
      mode === 'new'
        ? 'В библиотеке указано нулевое время игры; статус прохождения не указан.'
        : 'Выбрана по ненулевому времени в библиотеке; статус прохождения не указан.',
    );
  if (ignoreGenres)
    reasons.push('Фильтр жанров отключён по вашему выбору. Режим и исключения сохранены.');
  else {
    const genres = game.genres.filter((genre) => context.genres.includes(genre)).map(genreLabel);
    if (genres.length > 0)
      reasons.push(
        `${game.genresOverride ? 'Указанные вами жанры подходят' : 'Подходит по жанрам'}: ${genres.join(', ')}.`,
      );
  }
  return reasons;
};
