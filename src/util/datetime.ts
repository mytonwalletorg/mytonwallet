export function toMilliseconds(seconds: number) {
  return seconds * 1000;
}

export function toSeconds(ms: number) {
  return Math.floor(ms / 1000);
}
