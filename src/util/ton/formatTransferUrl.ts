// https://github.com/toncenter/tonweb/blob/944455da2effaa307a2030d00e19a37e6e94897c/src/utils/index.js#L94-L109
export default function formatTransferUrl(address: string, amount?: bigint, text?: string, jettonAddress?: string) {
  const url = `ton://transfer/${address}`;

  const params = [];

  if (amount) {
    params.push(`amount=${amount}`);
  }
  if (text) {
    params.push(`text=${encodeURIComponent(text)}`);
  }
  if (jettonAddress) {
    params.push(`jetton=${encodeURIComponent(jettonAddress)}`);
  }

  if (params.length === 0) return url;

  return `${url}?${params.join('&')}`;
}
