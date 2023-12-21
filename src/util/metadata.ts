import { BRILLIANT_API_BASE_URL, IS_CAPACITOR } from '../config';

const IPFS_GATEWAY_BASE_URL: string = 'https://ipfs.io/ipfs/';

export function fetchJsonMetadata(url: string) {
  url = fixIpfsUrl(url);

  const reserveUrl = `${BRILLIANT_API_BASE_URL}/utils/download-json?url=${url}`;

  if (IS_CAPACITOR) {
    return fetchJson(reserveUrl);
  }

  return fetchJson(url).catch(() => {
    return fetchJson(reserveUrl);
  });
}

export function fixIpfsUrl(url: string) {
  return url.replace('ipfs://', IPFS_GATEWAY_BASE_URL);
}

async function fetchJson(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw Error(`Http error ${response.status}`);
  }
  return response.json();
}
