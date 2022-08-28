import { Storage } from '../../storages/types';
import { getTonWeb } from './util/tonweb';

const TON_DNS_ZONE = '.ton';

export async function resolveAddress(address: string) {
  if (!address.endsWith(TON_DNS_ZONE)) {
    return address;
  }

  const tonWeb = getTonWeb();
  try {
    return (await tonWeb.dns.getWalletAddress(address))?.toString(true, true, true);
  } catch (err: any) {
    if (err.message !== 'http provider parse response error') {
      throw err;
    }
    return undefined;
  }
}

export async function fetchAddress(storage: Storage, accountId: string): Promise<string> {
  const addressesJson = (await storage.getItem('addresses'))!;
  const addresses = JSON.parse(addressesJson);
  return addresses[accountId];
}
