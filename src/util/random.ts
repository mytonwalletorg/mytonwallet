export function random(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

export function sample<T>(arr: T[]) {
  return arr[random(0, arr.length - 1)];
}

export function randomBytes(size: number) {
  return self.crypto.getRandomValues(new Uint8Array(size));
}

export function randomBase64(byteSize: number) {
  return Buffer.from(randomBytes(byteSize)).toString('base64');
}
