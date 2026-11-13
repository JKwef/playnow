export const PROGRESS_STATUSES = ['unspecified', 'not_started', 'playing', 'completed'] as const;
export type ProgressStatus = (typeof PROGRESS_STATUSES)[number];

export interface GamePreference {
  progressStatus: ProgressStatus;
  excluded: boolean;
}
export type GamePreferences = ReadonlyMap<number, GamePreference>;
export type PreferencePatch = Partial<GamePreference>;
export const DEFAULT_PREFERENCE: GamePreference = {
  progressStatus: 'unspecified',
  excluded: false,
};
export const PROGRESS_LABELS: Record<ProgressStatus, string> = {
  unspecified: 'Не указан',
  not_started: 'Не начинал',
  playing: 'Играю',
  completed: 'Пройдено',
};

/** Playtime never assigns a progression status. */
export const isBlockedByPreference = (preference?: GamePreference): boolean =>
  preference?.excluded === true || preference?.progressStatus === 'completed';
