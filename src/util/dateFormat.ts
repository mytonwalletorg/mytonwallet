import withCache from './withCache';

const formatDayToStringWithCache = withCache((
  dayStartAt: number,
  noYear?: boolean,
  monthFormat: 'short' | 'long' | 'numeric' = 'short',
  noDay?: boolean,
) => {
  return new Date(dayStartAt).toLocaleString(
    'en-US',
    {
      year: noYear ? undefined : 'numeric',
      month: monthFormat,
      day: noDay ? undefined : 'numeric',
    },
  );
});

export function formatHumanDay(datetime: string | number) {
  if (isToday(datetime)) {
    return 'Today';
  }

  if (isYesterday(datetime)) {
    return 'Yesterday';
  }

  return formatFullDay(datetime);
}

export function formatFullDay(datetime: string | number | Date) {
  const date = new Date(datetime);
  const dayStartAt = getDayStartAt(new Date(datetime));
  const today = getDayStart(new Date());
  const noYear = date.getFullYear() === today.getFullYear();

  return formatDayToStringWithCache(dayStartAt, noYear, 'long');
}

export function formatTime(datetime: string | number) {
  const date = new Date(datetime);

  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function getDayStart(datetime: number | Date) {
  const date = new Date(datetime);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function getDayStartAt(datetime: number | Date) {
  return getDayStart(datetime).getTime();
}

function isToday(datetime: string | number) {
  return getDayStartAt(new Date()) === getDayStartAt(new Date(datetime));
}

function isYesterday(datetime: string | number) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  return getDayStartAt(yesterday) === getDayStartAt(new Date(datetime));
}
