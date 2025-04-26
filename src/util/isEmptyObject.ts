export default function isEmptyObject(obj: Object) {
  return !isKeyCountGreater(obj, 0);
}

export function isKeyCountGreater(obj: Object, countToOutnumber: number) {
  if (countToOutnumber < 0) return true;
  let keyCount = 0;

  // eslint-disable-next-line no-restricted-syntax
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      keyCount++;
      if (keyCount > countToOutnumber) {
        return true;
      }
    }
  }

  return false;
}
