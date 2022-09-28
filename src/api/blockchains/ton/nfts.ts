import { Storage } from '../../storages/types';
import { BRILLIANT_API_BASE_URL, IS_TESTNET } from '../../../config';
import { handleFetchErrors } from '../../common/utils';
import { ApiNft } from '../../types';
import { fetchAddress } from './address';

export async function getAccountNfts(storage: Storage, accountId: string) {
  const address = await fetchAddress(storage, accountId);
  const url = `${BRILLIANT_API_BASE_URL}/nfts?`;
  const response = await fetch(url + new URLSearchParams({
    ...(IS_TESTNET && { network: 'testnet' }),
    account: address,
  }));
  handleFetchErrors(response);

  return (await response.json()).nfts as ApiNft[];
}
