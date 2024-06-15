export function base64ToHex(base64: string): string {
  const buffer = Buffer.from(base64, 'base64');
  return buffer.toString('hex');
}
