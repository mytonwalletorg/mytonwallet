export default function isEmptyObject(obj: object) {
  return !isKeyCountGreater(obj, 0);
}

export function isKeyCountGreater(obj: object, countToOutnumber: number) {
  if (countToOutnumber < 0) return true;
  let keyCount = 0;

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
