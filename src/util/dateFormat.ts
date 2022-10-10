import withCache from './withCache';

const formatDayToStringWithCache = withCache((
  dayStartAt: number,
  noYear?: boolean,
  monthFormat: 'short' | 'long' | 'numeric' | false = 'short',
  noDay?: boolean,
  withTime = false,
) => {
  return new Date(dayStartAt).toLocaleString(
    'en-US',
    {
      year: noYear ? undefined : 'numeric',
      month: monthFormat || undefined,
      day: noDay ? undefined : 'numeric',
      hour: withTime ? 'numeric' : undefined,
      minute: withTime ? 'numeric' : undefined,
      hour12: false,
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
  const dayStartAt = getDayStartAt(date);
  const today = getDayStart(new Date());
  const noYear = date.getFullYear() === today.getFullYear();

  return formatDayToStringWithCache(dayStartAt, noYear, 'long');
}

export function formatShortDay(datetime: string | number | Date, withTime = false) {
  const date = new Date(datetime);
  const dayStartAt = getDayStartAt(date);
  const today = getDayStart(new Date());
  const todayStartAt = getDayStartAt(today);
  const noYear = date.getFullYear() === today.getFullYear();
  const noDate = withTime && dayStartAt === todayStartAt;
  const targetAt = withTime ? getMinuteStart(date).getTime() : dayStartAt;

  return formatDayToStringWithCache(targetAt, noYear, !noDate && 'short', noDate, withTime);
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

export function getMinuteStart(datetime: number | Date) {
  const date = new Date(datetime);
  date.setSeconds(0, 0);
  return date;
}

function isToday(datetime: string | number) {
  return getDayStartAt(new Date()) === getDayStartAt(new Date(datetime));
}

function isYesterday(datetime: string | number) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  return getDayStartAt(yesterday) === getDayStartAt(new Date(datetime));
}
