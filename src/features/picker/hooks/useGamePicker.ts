import { useCallback, useMemo, useState } from 'react';

import { useBacklog } from '@/features/backlog/hooks/useBacklog';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { accountRevision } from '@/shared/services/accountScope';
import { useGamePreferences } from '@/features/backlog/hooks/useGamePreferences';
import { isBlockedByPreference } from '@/features/backlog/types/GamePreference';
import type { BacklogErrorCode, Game } from '@/features/backlog/types/Game';
import { newSeed, seededRandom } from '@/shared/utils/random';

import type { BlacklistService, PostponeDuration } from '../services/blacklist';
import { PICKER_MODE_LABELS, type PickerContext, type PickerMode } from '../types';
import { filterCandidates, pickGame, priorityOf } from '../utils/pickGame';
import { explainPick } from '../utils/explainPick';
import { useBlacklist } from './useBlacklist';
import { useInstalledGames } from '@/features/backlog/hooks/useInstalledGames';

export type PickerStatus =
  /** Ещё нет бэклога или чёрного списка. */
  | 'loading'
  /** Игра подобрана. */
  | 'ready'
  /** Под контекст ничего не подходит (FR4.2). */
  | 'empty'
  /** Бэклог не загрузился: подбирать не из чего. */
  | 'error';

export interface UseGamePickerResult {
  status: PickerStatus;
  game: Game | null;
  /** Сколько игр отложено (чтобы объяснить пустой результат). */
  postponedCount: number;
  excludedCount: number;
  /** «Другой вариант»: новая игра, не показанная в этой серии (FR4.3). */
  next: () => void;
  /** После подтверждённого откладывания подбирается следующая игра. */
  postpone: (duration?: PostponeDuration) => Promise<boolean>;
  actionError: string | null;
  /** true, если условиям соответствует только одна игра. */
  isLastOption: boolean;
  /** Ошибка загрузки бэклога (код и текст для BacklogErrorView). */
  errorCode: BacklogErrorCode | null;
  errorMessage: string | null;
  /** Идёт повторная загрузка бэклога после ошибки. */
  isRetrying: boolean;
  /** Повторить загрузку бэклога. */
  refresh: () => Promise<void>;
  reasons: readonly string[];
  isSeriesExhausted: boolean;
  restart: () => void;
  emptyReason: string;
  canRelaxGenres: boolean;
  metadataIncomplete: boolean;
  metadataMessage: string | null;
  libraryEmpty: boolean;
  retryMetadata: () => Promise<void>;
  isRetryingMetadata: boolean;
}

interface PickerOptions {
  mode?: PickerMode;
  ignoreGenres?: boolean;
  installedOnly?: boolean;
  blacklistService?: BlacklistService;
}
interface Series {
  scope: string;
  currentId: number | null;
  shown: readonly number[];
  seed: number;
}

/**
 * Подбор игры по контексту (FR4.2–FR4.4). Работает на кэшированном бэклоге, значит и оффлайн
 * (NFR2.3). Случайность — из зерна в состоянии: рендер чистый, а новое зерно появляется
 * только по нажатию кнопки.
 */
export const useGamePicker = (
  context: PickerContext,
  {
    mode = 'new',
    ignoreGenres = false,
    installedOnly = false,
    blacklistService,
  }: PickerOptions = {},
): UseGamePickerResult => {
  const backlog = useBacklog();
  const { games } = backlog;
  const preferences = useGamePreferences();
  const installed = useInstalledGames();
  const blacklist = useBlacklist(blacklistService);
  const postponed = blacklist.postponed;
  const steamId = useAuth((state) => state.user?.steamId ?? null);
  const scope = `${steamId ?? ''}:${accountRevision(steamId ?? '')}:${context.id}:${mode}:${ignoreGenres}:${installedOnly}`;
  const [series, setSeries] = useState<Series>(() => ({
    scope,
    currentId: null,
    shown: [],
    seed: newSeed(),
  }));
  const active = useMemo<Series>(
    () =>
      series.scope === scope ? series : { scope, currentId: null, shown: [], seed: series.seed },
    [series, scope],
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const candidates = useMemo(
    () =>
      filterCandidates(games ?? [], context, {
        exclude: new Set(postponed.keys()),
        preferences: preferences.preferences,
        mode,
        ignoreGenres,
        installedOnly,
        installedIds: installed.marked,
      }),
    [
      games,
      context,
      postponed,
      preferences.preferences,
      mode,
      ignoreGenres,
      installedOnly,
      installed.marked,
    ],
  );
  const previousSeen = useMemo(() => new Set(active.shown), [active.shown]);
  const available = candidates.filter(
    (item) => !previousSeen.has(item.appid) || item.appid === active.currentId,
  );
  const bestTier = Math.min(
    ...available.map(
      (item) => priorityOf(item, mode, preferences.preferences.get(item.appid)) ?? Infinity,
    ),
  );
  const retained = available.find(
    (item) =>
      item.appid === active.currentId &&
      priorityOf(item, mode, preferences.preferences.get(item.appid)) === bestTier,
  );
  const canPick =
    games !== undefined &&
    backlog.status !== 'error' &&
    !preferences.isLoading &&
    !preferences.isUnavailable &&
    !blacklist.isLoading &&
    (!installedOnly || installed.isReady) &&
    !blacklist.errorMessage;
  const game = canPick
    ? (retained ??
      pickGame(candidates, context, {
        exclude: previousSeen,
        preferences: preferences.preferences,
        mode,
        ignoreGenres,
        random: seededRandom(active.seed),
      }))
    : null;
  // Record each displayed result, including results introduced by metadata/status changes.
  // A guarded render adjustment avoids committing a stale result or recording a
  // result later in an effect after the candidate data has already changed.
  if (game && (series.scope !== scope || series.currentId !== game.appid)) {
    setSeries({
      ...active,
      scope,
      currentId: game.appid,
      shown: [...new Set([...active.shown, game.appid])],
    });
  }
  const seen = useMemo(
    () => new Set([...active.shown, ...(game ? [game.appid] : [])]),
    [active.shown, game],
  );
  const unseen = candidates.filter((item) => !seen.has(item.appid));
  const isSeriesExhausted = candidates.length > 0 && unseen.length === 0;
  const next = useCallback(() => {
    if (!game || isSeriesExhausted) return;
    setSeries({ scope, shown: [...seen], currentId: null, seed: newSeed() });
  }, [game, isSeriesExhausted, scope, seen]);
  const restart = useCallback(() => {
    if (candidates.length > 0) setSeries({ scope, shown: [], currentId: null, seed: newSeed() });
  }, [scope, candidates.length]);

  const { postpone: addToBlacklist } = blacklist;
  const postpone = useCallback(
    async (duration?: PostponeDuration) => {
      if (game === null) return false;
      setActionError(null);
      try {
        await addToBlacklist(game.appid, duration);
      } catch {
        setActionError('Не удалось отложить игру. Попробуйте ещё раз.');
        return false;
      }
      setSeries({ scope, shown: [...seen], currentId: null, seed: newSeed() });
      return true;
    },
    [game, addToBlacklist, scope, seen],
  );

  let status: PickerStatus = 'ready';
  if (backlog.status === 'error') status = 'error';
  else if (preferences.isUnavailable || blacklist.errorMessage) status = 'error';
  else if (installedOnly && !installed.isReady && installed.error) status = 'error';
  else if (installedOnly && !installed.isReady) status = 'loading';
  else if (games === undefined || blacklist.isLoading || preferences.isLoading) status = 'loading';
  else if (game === null) status = 'empty';

  const modeCandidates = filterCandidates(games ?? [], context, {
    exclude: new Set(postponed.keys()),
    preferences: preferences.preferences,
    mode,
    ignoreGenres: true,
    installedOnly,
    installedIds: installed.marked,
  });
  const allowedCount = (games ?? []).filter(
    (item) =>
      !postponed.has(item.appid) && !isBlockedByPreference(preferences.preferences.get(item.appid)),
  ).length;
  const unrecognizedGenres = (games ?? []).some((item) => item.genres.length === 0);
  const metadataIncomplete =
    (games?.length ?? 0) > 0 && (backlog.genresStatus !== 'done' || unrecognizedGenres);
  const emptyReason =
    (games?.length ?? 0) === 0
      ? backlog.errorMessage
        ? 'Сохранённая библиотека пуста, а обновить её не удалось.'
        : 'В библиотеке пока нет игр.'
      : allowedCount === 0
        ? 'Все игры пройдены, постоянно исключены или отложены.'
        : modeCandidates.length === 0 && installedOnly
          ? 'Среди отмеченных установленными нет игр выбранного режима. Проверьте отметки в библиотеке или явно отключите фильтр установки.'
          : modeCandidates.length === 0
            ? `В режиме «${PICKER_MODE_LABELS[mode]}» нет игр с подходящим статусом или временем игры.`
            : 'Нет игр, подходящих одновременно выбранному режиму и жанрам контекста.';

  return {
    status,
    game,
    postponedCount: postponed.size,
    excludedCount: (games ?? []).filter((item) =>
      isBlockedByPreference(preferences.preferences.get(item.appid)),
    ).length,
    next,
    postpone,
    actionError,
    isLastOption: game !== null && candidates.length === 1,
    isSeriesExhausted,
    restart,
    emptyReason,
    reasons: game
      ? [
          ...explainPick(
            game,
            context,
            mode,
            preferences.preferences.get(game.appid),
            ignoreGenres,
          ),
          ...(installedOnly
            ? [
                'Вы вручную отметили игру установленной на игровом компьютере. Установка не проверяется автоматически.',
              ]
            : []),
        ]
      : [],
    canRelaxGenres:
      !ignoreGenres && metadataIncomplete && candidates.length === 0 && modeCandidates.length > 0,
    metadataIncomplete,
    libraryEmpty: games !== undefined && games.length === 0,
    metadataMessage: !metadataIncomplete
      ? null
      : backlog.genresStatus === 'error'
        ? 'Не удалось загрузить метаданные. Игры остаются в библиотеке.'
        : backlog.genresRemaining !== null &&
            backlog.genresRemaining !== undefined &&
            backlog.genresRemaining > 0
          ? `Метаданные обработаны не полностью. Осталось игр: ${backlog.genresRemaining}.`
          : unrecognizedGenres
            ? 'У части игр нет распознанных жанров. Их можно исправить в библиотеке или явно отключить фильтр жанров.'
            : 'Метаданные ещё не проверены полностью. Можно повторить обработку.',
    retryMetadata: backlog.retryGenres,
    isRetryingMetadata: backlog.genresStatus === 'loading',
    errorCode:
      preferences.isUnavailable ||
      blacklist.errorMessage ||
      (installedOnly && !installed.isReady && installed.error)
        ? 'server'
        : backlog.errorCode,
    errorMessage: preferences.isUnavailable
      ? preferences.loadError
      : (blacklist.errorMessage ??
        (installedOnly && !installed.isReady ? installed.error : null) ??
        backlog.errorMessage),
    isRetrying: backlog.isRefreshing || preferences.isRefreshing,
    refresh: preferences.isUnavailable
      ? preferences.retry
      : installedOnly && !installed.isReady
        ? installed.retry
        : blacklist.errorMessage
          ? blacklist.retry
          : backlog.refresh,
  };
};
