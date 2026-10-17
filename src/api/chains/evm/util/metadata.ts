import type { ApiNetwork, EVMChain } from '../../../types';

import { buildTokenSlug, getTokenBySlug, updateTokensFetchedTogether } from '../../../common/tokens';
import { fetchAssetsByAddresses } from '../wallet';

export async function updateTokensMetadataByAddress(
  network: ApiNetwork,
  chain: EVMChain,
  addresses: string[],
  signal?: AbortSignal,
) {
  const slugs = addresses.map((e) => ({ address: e, slug: buildTokenSlug(chain, e) }));

  const uncachedTokenAddresses: string[] = [];
  for (const asset of slugs) {
    const metadata = getTokenBySlug(asset.slug);

    if (!metadata) {
      uncachedTokenAddresses.push(asset.address);
    }
  }

  if (uncachedTokenAddresses.length) {
    const fetched = await fetchAssetsByAddresses(network, chain, uncachedTokenAddresses, signal);
    await updateTokensFetchedTogether(fetched, { signal });
  }
}
