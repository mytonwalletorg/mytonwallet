import type { Storage } from '../../storages/types';
import type { ApiNft } from '../../types';

import { BRILLIANT_API_BASE_URL } from '../../../config';
import { parseAccountId } from '../../../util/account';
import { fetchStoredAddress } from '../../common/accounts';
import { handleFetchErrors } from '../../common/utils';

export async function getAccountNfts(storage: Storage, accountId: string) {
  const { network } = parseAccountId(accountId);
  const address = await fetchStoredAddress(storage, accountId);
  const url = `${BRILLIANT_API_BASE_URL}/nfts?`;
  const response = await fetch(url + new URLSearchParams({
    network,
    account: address,
  }));
  handleFetchErrors(response);

  return (await response.json()).nfts as ApiNft[];
}
