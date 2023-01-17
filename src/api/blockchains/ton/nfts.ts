import { Storage } from '../../storages/types';
import { BRILLIANT_API_BASE_URL } from '../../../config';
import { handleFetchErrors } from '../../common/utils';
import { ApiNft } from '../../types';
import { fetchAddress } from './address';
import { parseAccountId } from '../../../util/account';

export async function getAccountNfts(storage: Storage, accountId: string) {
  const { network } = parseAccountId(accountId);
  const address = await fetchAddress(storage, accountId);
  const url = `${BRILLIANT_API_BASE_URL}/nfts?`;
  const response = await fetch(url + new URLSearchParams({
    network,
    account: address,
  }));
  handleFetchErrors(response);

  return (await response.json()).nfts as ApiNft[];
}
