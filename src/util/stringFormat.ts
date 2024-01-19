export function isAscii(str: string) {
  for (let i = 0; i < str.length; i++) {
    if (str.charCodeAt(i) > 127) {
      return false;
    }
  }
  return true;
}

export function insertSubstring(str: string, start: number, newSubStr: string) {
  if (start < 0) {
    start = str.length - start;
  }
  return str.slice(0, start) + newSubStr + str.slice(start);
}
