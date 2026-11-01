/** «Не запускалась», «45 мин», «3 ч», «12 ч 5 мин». */
export const formatPlaytime = (minutes: number): string => {
  if (!Number.isFinite(minutes) || minutes <= 0) return 'Не запускалась';
  const total = Math.floor(minutes);
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${rest} мин`;
  return rest === 0 ? `${hours} ч` : `${hours} ч ${rest} мин`;
};

/** Короткая дата и время по-русски: «1 нояб., 22:04». */
export const formatDateTime = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};
