import TonWeb from 'tonweb';

export function bytesToHex(bytes: Uint8Array) {
  return TonWeb.utils.bytesToHex(bytes);
}

export function hexToBytes(hex: string) {
  return TonWeb.utils.hexToBytes(hex);
}

export function bytesToBase64(bytes: Uint8Array) {
  return TonWeb.utils.bytesToBase64(bytes);
}

export function base64ToBytes(hex: string) {
  return TonWeb.utils.base64ToBytes(hex);
}

export function hexToBase64(hex: string) {
  return bytesToBase64(hexToBytes(hex));
}

export function base64ToString(base64: string) {
  return TonWeb.utils.base64toString(base64);
}

export function sha256(bytes: Uint8Array) {
  return TonWeb.utils.sha256(bytes);
}

export function handleFetchErrors(response: Response) {
  if (!response.ok) {
    throw new Error(response.statusText);
  }
  return response;
}

export function sumBigString(a: string, b: string) {
  return (BigInt(a) + BigInt(b)).toString();
}
