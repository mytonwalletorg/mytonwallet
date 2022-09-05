import { base64ToString } from '../../../common/utils';

const IPFS_EXPLORER_BASE_URL: string = 'https://ipfs.io/ipfs/';

export function fixIpfsUrl(url: string) {
  return url.replace('ipfs://', IPFS_EXPLORER_BASE_URL);
}

export function fixBase64ImageData(data: string) {
  const decodedData = base64ToString(data);
  if (decodedData.includes('<svg')) {
    return `data:image/svg+xml;base64,${data}`;
  }
  return `data:image/png;base64,${data}`;
}
