export function trimStringByMaxBytes(str: string, maxBytes: number): string {
  const decoder = new TextDecoder('utf-8');
  const encoded = new TextEncoder().encode(str);
  const sliced = encoded.slice(0, maxBytes);

  return decoder.decode(sliced).replace(/\uFFFD/g, '');
}
