export function isValidString(value: any, maxLength = 100) {
  return typeof value === 'string' && value.length <= maxLength;
}

export function isValidUrl(url: string) {
  const isString = isValidString(url, 150);
  if (!isString) return false;

  try {
    // eslint-disable-next-line no-new
    new URL(url);
    return true;
  } catch (err) {
    return false;
  }
}
