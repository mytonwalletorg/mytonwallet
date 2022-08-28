const HUMAN_FACTOR = 1e9;

export function bigStrToHuman(amount: string) {
  return divideBigInt(BigInt(amount), BigInt(HUMAN_FACTOR));
}

export function humanToBigStr(amount: number) {
  return String(Math.round(amount * HUMAN_FACTOR));
}

function divideBigInt(a: bigint, b: bigint) {
  const div = a / b;
  return Number(div) + Number(a - div * b) / Number(b);
}
