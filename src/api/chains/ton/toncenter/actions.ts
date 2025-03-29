import { Cell } from '@ton/core';

import type {
  ApiActivity,
  ApiNetwork,
  ApiNft,
  ApiSwapActivity,
  ApiToken,
  ApiTransactionActivity,
  ApiTransactionType,
} from '../../../types';
import type {
  AddressBook,
  AnyAction,
  AnyTokenMetadata,
  AuctionBidAction,
  CallContractAction,
  ChangeDnsAction,
  ContractDeployAction,
  DeleteDnsAction,
  DexDepositLiquidityAction,
  DexWithdrawLiquidityAction,
  JettonBurnAction,
  JettonMasterMetadata,
  JettonMintAction,
  JettonTransferAction,
  MetadataMap,
  NftCollectionMetadata,
  NftItemMetadata,
  NftMintAction,
  NftTransferAction,
  RenewDnsAction,
  StakeDepositAction,
  StakeWithdrawalAction,
  StakeWithdrawalRequestAction,
  SwapAction,
  TonTransferAction,
} from './types';

import {
  BURN_ADDRESS,
  DNS_IMAGE_GEN_URL,
  LIQUID_POOL,
  MYCOIN_STAKING_POOL,
  NFT_FRAGMENT_COLLECTIONS,
  NFT_FRAGMENT_GIFT_IMAGE_TO_URL_REGEX,
  NFT_FRAGMENT_GIFT_IMAGE_URL_PREFIX,
  STON_PTON_ADDRESS,
  TONCOIN,
} from '../../../../config';
import { buildTxId } from '../../../../util/activities';
import { toMilliseconds, toSeconds } from '../../../../util/datetime';
import { toDecimal } from '../../../../util/decimals';
import { getDnsDomainZone } from '../../../../util/dns';
import { omitUndefined } from '../../../../util/iteratees';
import { fixIpfsUrl } from '../../../../util/metadata';
import { readComment } from '../util/metadata';
import { toBase64Address } from '../util/tonCore';
import { checkHasScamLink, checkIsTrustedCollection } from '../../../common/addresses';
import { buildTokenSlug, getTokenBySlug } from '../../../common/tokens';
import {
  EXCESS_OP_CODES,
  JettonStakingOpCode,
  OpCode,
  OUR_FEE_PAYLOAD_BOC,
  TeleitemOpCode,
} from '../constants';
import { callToncenterV3 } from './other';

type ActionsResponse = {
  actions: AnyAction[];
  address_book: AddressBook;
  metadata?: MetadataMap;
};

type ParseOptions<T extends AnyAction = AnyAction> = {
  network: ApiNetwork;
  action: T;
  addressBook: AddressBook;
  walletAddress: string;
  metadata: MetadataMap;
};

type PartialTx = Pick<ApiTransactionActivity, 'kind' | 'id' | 'txId' | 'timestamp' | 'fee' | 'externalMsgHash'>;

const TME_RENEW_HASH_SUFFIX = '0000000000000000000000000000000000000000000000';

export async function fetchActions(options: {
  network: ApiNetwork;
  address: string | string[];
  limit: number;
  walletAddress: string;
  fromTimestamp?: number;
  toTimestamp?: number;
  shouldIncludeFrom?: boolean;
  shouldIncludeTo?: boolean;
  includeTypes?: AnyAction['type'][];
  excludeTypes?: AnyAction['type'][];
}): Promise<ApiActivity[]> {
  const {
    network, address, limit, toTimestamp, fromTimestamp,
    shouldIncludeFrom, shouldIncludeTo, walletAddress,
    includeTypes, excludeTypes,
  } = options;

  const {
    actions: rawActions,
    address_book: addressBook,
    metadata = {},
  } = await callToncenterV3<ActionsResponse>(network, '/actions', {
    account: address,
    limit,
    start_utime: fromTimestamp && toSeconds(fromTimestamp) + (!shouldIncludeFrom ? 1 : 0),
    end_utime: toTimestamp && toSeconds(toTimestamp) - (!shouldIncludeTo ? 1 : 0),
    sort: 'desc',
    ...(includeTypes?.length && { action_type: includeTypes.join(',') }),
    ...(excludeTypes?.length && { exclude_action_type: excludeTypes.join(',') }),
  });

  const result: ApiActivity[] = [];

  for (const action of rawActions) {
    const activities = await parseAction(action, {
      network, action, addressBook, walletAddress, metadata,
    });

    for (const activity of activities) {
      result.push(activity);
    }
  }

  return result;
}

function parseAction(action: AnyAction, options: ParseOptions): MaybePromise<ApiActivity[]> {
  const id = buildTxId(action.trace_id, action.start_lt);

  const partialTx: PartialTx = {
    kind: 'transaction',
    id,
    txId: id,
    timestamp: toMilliseconds(action.end_utime),
    externalMsgHash: action.trace_external_hash,
    fee: 0n, // Calculated when TransactionModal opens
  };

  let result: (ApiActivity | undefined)[] = [];

  switch (action.type) {
    case 'ton_transfer': {
      result = [parseTonTransfer(action, options, partialTx)];
      break;
    }
    case 'call_contract': {
      result = [parseCallContract(action, options, partialTx)];
      break;
    }
    case 'contract_deploy': {
      result = [parseContractDeploy(action, options, partialTx)];
      break;
    }
    case 'nft_transfer': {
      result = [parseNftTransfer(action, options, partialTx)];
      break;
    }
    case 'nft_mint': {
      result = [parseNftMint(action, options, partialTx)];
      break;
    }
    case 'jetton_transfer': {
      result = [parseJettonTransfer(action, options, partialTx)];
      break;
    }
    case 'jetton_mint': {
      result = [parseJettonMint(action, options, partialTx)];
      break;
    }
    case 'jetton_burn': {
      result = [parseJettonBurn(action, options, partialTx)];
      break;
    }
    case 'stake_deposit': {
      result = [parseStakeDeposit(action, options, partialTx)];
      break;
    }
    case 'stake_withdrawal': {
      result = [parseStakeWithdrawal(action, options, partialTx)];
      break;
    }
    case 'stake_withdrawal_request': {
      result = [parseStakeWithdrawalRequest(action, options, partialTx)];
      break;
    }
    case 'jetton_swap': {
      result = [parseJettonSwap(action, options)];
      break;
    }
    case 'change_dns':
    case 'delete_dns':
    case 'renew_dns': {
      result = [parseDns(action, options, partialTx)];
      break;
    }
    case 'auction_bid': {
      result = [parseAuctionBid(action, options, partialTx)];
      break;
    }
    case 'dex_deposit_liquidity': {
      result = parseLiquidityDeposit(action, options, partialTx);
      break;
    }
    case 'dex_withdraw_liquidity': {
      result = parseLiquidityWithdraw(action, options, partialTx);
      break;
    }
  }

  for (const activity of result) {
    if (!activity) continue;

    if ('nft' in activity && activity.nft?.isHidden) {
      activity.shouldHide = true;
    }

    if (activity.kind === 'transaction' && !activity.isIncoming) {
      activity.shouldLoadDetails ??= true;
    }
  }

  return result.filter(Boolean);
}

function parseTonTransfer(
  action: TonTransferAction,
  options: ParseOptions,
  partial: PartialTx,
): ApiTransactionActivity {
  const { network, addressBook, walletAddress } = options;
  const { details } = action;
  const { encrypted: isEncrypted } = details;
  const fromAddress = addressBook[details.source].user_friendly;
  const toAddress = addressBook[details.destination].user_friendly;
  const isIncoming = toAddress === walletAddress;
  const amount = isIncoming ? BigInt(details.value) : -BigInt(details.value);
  const normalizedAddress = toBase64Address(isIncoming ? fromAddress : toAddress, true, network);
  const comment = (!isEncrypted && details.comment) || undefined;
  const encryptedComment = (isEncrypted && details.comment) || undefined;

  return {
    ...partial,
    slug: TONCOIN.slug,
    amount,
    isIncoming,
    fromAddress,
    toAddress,
    normalizedAddress,
    comment,
    encryptedComment,
  };
}

function parseCallContract(
  action: CallContractAction,
  options: ParseOptions,
  partial: PartialTx,
): ApiTransactionActivity | undefined {
  const { network, addressBook, walletAddress } = options;
  const { details } = action;

  const fromAddress = addressBook[details.source].user_friendly;
  const toAddress = addressBook[details.destination].user_friendly;

  const isIncoming = toAddress === walletAddress;
  const amount = isIncoming ? BigInt(details.value) : -BigInt(details.value);
  const normalizedAddress = toBase64Address(isIncoming ? fromAddress : toAddress, true, network);
  const opCode = Number(details.opcode);
  const shouldHide = !isIncoming && [OpCode.OurFee, TeleitemOpCode.Ok].includes(opCode);

  let type: ApiTransactionType | undefined;
  if (EXCESS_OP_CODES.includes(opCode)) {
    type = 'excess';
  } else if (opCode === 0xffffffff) {
    type = 'bounced';
  } else if ([JettonStakingOpCode.UnstakeRequest, JettonStakingOpCode.ClaimRewards].includes(opCode)) {
    type = 'unstakeRequest';
  } else if (toAddress !== walletAddress) {
    type = 'callContract';
  }

  return {
    ...partial,
    slug: TONCOIN.slug,
    amount,
    isIncoming,
    fromAddress,
    toAddress,
    normalizedAddress,
    type,
    shouldHide,
  };
}

function parseContractDeploy(
  action: ContractDeployAction,
  options: ParseOptions,
  partial: PartialTx,
): ApiTransactionActivity | undefined {
  const { network, addressBook, walletAddress } = options;
  const { details } = action;

  if (!details.source) {
    return undefined;
  }

  const fromAddress = addressBook[details.source].user_friendly;
  const toAddress = addressBook[details.destination].user_friendly;

  if (fromAddress !== walletAddress) {
    return undefined;
  }

  return {
    ...partial,
    slug: TONCOIN.slug,
    amount: -0n,
    isIncoming: false,
    fromAddress,
    toAddress,
    normalizedAddress: toBase64Address(toAddress, true, network),
    type: 'contractDeploy',
  };
}

function parseJettonTransfer(
  action: JettonTransferAction,
  options: ParseOptions,
  partial: PartialTx,
): ApiTransactionActivity {
  const { details } = action;
  const { network, walletAddress, addressBook } = options;
  const { is_encrypted_comment: isEncrypted, forward_payload: forwardPayload } = details;
  const fromAddress = addressBook[details.sender].user_friendly;
  const toAddress = addressBook[details.receiver].user_friendly;
  const isIncoming = toAddress === walletAddress;
  const amount = isIncoming ? BigInt(details.amount) : -BigInt(details.amount);
  const normalizedAddress = toBase64Address(isIncoming ? fromAddress : toAddress, true, network);
  const comment = (!isEncrypted && details.comment) || undefined;
  const encryptedComment = (isEncrypted && details.comment) || undefined;
  const slug = buildTokenSlug('ton', toBase64Address(details.asset, true, network));
  const shouldHide = !isIncoming && forwardPayload === OUR_FEE_PAYLOAD_BOC;

  let type: ApiTransactionType;
  if (toAddress === BURN_ADDRESS) {
    type = 'burn';
  } else if (toAddress === MYCOIN_STAKING_POOL) {
    type = 'stake';
  } else if (fromAddress === MYCOIN_STAKING_POOL) {
    type = 'unstake';
  }

  return {
    ...partial,
    slug,
    amount,
    isIncoming,
    fromAddress,
    toAddress,
    normalizedAddress,
    comment,
    encryptedComment,
    shouldHide,
    type,
  };
}

function parseJettonMint(
  action: JettonMintAction,
  options: ParseOptions,
  partial: PartialTx,
): ApiTransactionActivity {
  const { details } = action;
  const { network, walletAddress, addressBook } = options;

  const fromAddress = addressBook[details.receiver_jetton_wallet].user_friendly;
  const toAddress = addressBook[details.receiver].user_friendly;
  const isIncoming = toAddress === walletAddress;
  const amount = isIncoming ? BigInt(details.amount) : -BigInt(details.amount);
  const normalizedAddress = toBase64Address(isIncoming ? fromAddress : toAddress, true, network);
  const slug = buildTokenSlug('ton', toBase64Address(details.asset, true, network));

  return {
    ...partial,
    slug,
    amount,
    isIncoming,
    fromAddress,
    toAddress,
    normalizedAddress,
    type: 'mint',
  };
}

function parseJettonBurn(
  action: JettonBurnAction,
  options: ParseOptions,
  partial: PartialTx,
): ApiTransactionActivity {
  const { details } = action;
  const { network, addressBook } = options;

  const fromAddress = addressBook[details.owner].user_friendly;
  const toAddress = addressBook[details.owner_jetton_wallet].user_friendly;
  const amount = -BigInt(details.amount);
  const normalizedAddress = toBase64Address(fromAddress, true, network);
  const slug = buildTokenSlug('ton', toBase64Address(details.asset, true, network));

  return {
    ...partial,
    slug,
    amount,
    isIncoming: false,
    fromAddress,
    toAddress,
    normalizedAddress,
    type: 'burn',
  };
}

function parseNftTransfer(
  action: NftTransferAction,
  options: ParseOptions,
  partial: PartialTx,
): ApiTransactionActivity | undefined {
  const {
    network, addressBook, metadata, walletAddress,
  } = options;

  const {
    nft_item_index: index,
    nft_item: rawNftAddress,
    nft_collection: rawCollectionAddress,
    new_owner: newOwner,
    old_owner: oldOwner,
    forward_payload: forwardPayload,
  } = action.details;

  const nft = parseToncenterNft(
    metadata,
    rawNftAddress,
    rawCollectionAddress ?? undefined,
    index ?? undefined,
  );

  const fromAddress = addressBook[oldOwner ?? rawNftAddress].user_friendly;
  const toAddress = addressBook[newOwner].user_friendly;
  const isIncoming = toAddress === walletAddress;
  const normalizedAddress = toBase64Address(isIncoming ? fromAddress : toAddress, true, network);

  if (fromAddress !== walletAddress && toAddress !== walletAddress) {
    return undefined;
  }

  const comment = (forwardPayload && readComment(Cell.fromBase64(forwardPayload).asSlice())) || undefined;
  const type = toAddress === BURN_ADDRESS ? 'burn' : undefined;

  return {
    ...partial,
    slug: TONCOIN.slug,
    amount: 0n,
    isIncoming,
    fromAddress,
    toAddress,
    normalizedAddress,
    nft,
    type,
    comment,
  };
}

function parseNftMint(
  action: NftMintAction,
  options: ParseOptions,
  partial: PartialTx,
): ApiTransactionActivity {
  const {
    network, addressBook, metadata,
  } = options;

  const {
    owner,
    nft_item_index: index,
    nft_item: rawNftAddress,
    nft_collection: rawCollectionAddress,
  } = action.details;

  const nft = parseToncenterNft(
    metadata,
    rawNftAddress,
    rawCollectionAddress ?? undefined,
    index ?? undefined,
  );

  const fromAddress = addressBook[owner].user_friendly;
  const toAddress = addressBook[rawNftAddress].user_friendly;
  const normalizedAddress = toBase64Address(fromAddress, true, network);

  return {
    ...partial,
    slug: TONCOIN.slug,
    amount: 0n,
    isIncoming: false,
    fromAddress,
    toAddress,
    normalizedAddress,
    nft,
    type: 'mint',
  };
}

function parseStakeDeposit(
  action: StakeDepositAction,
  options: ParseOptions,
  partial: PartialTx,
): ApiTransactionActivity {
  const { network, addressBook } = options;
  const { details } = action;

  return {
    ...partial,
    slug: TONCOIN.slug,
    amount: -BigInt(details.amount),
    isIncoming: false,
    fromAddress: addressBook[details.stake_holder].user_friendly,
    toAddress: addressBook[details.pool].user_friendly,
    normalizedAddress: toBase64Address(details.pool, true, network),
    type: 'stake',
  };
}

function parseStakeWithdrawal(
  action: StakeWithdrawalAction,
  options: ParseOptions,
  partial: PartialTx,
): ApiTransactionActivity {
  const { network, addressBook } = options;
  const { details } = action;

  return {
    ...partial,
    slug: TONCOIN.slug,
    amount: BigInt(details.amount),
    isIncoming: true,
    fromAddress: details.pool ? addressBook[details.pool].user_friendly : LIQUID_POOL,
    toAddress: addressBook[details.stake_holder].user_friendly,
    normalizedAddress: details.pool ? toBase64Address(details.pool, true, network) : LIQUID_POOL,
    type: 'unstake',
    shouldLoadDetails: details.provider === 'tonstakers' && !details.payout_nft,
  };
}

function parseStakeWithdrawalRequest(
  action: StakeWithdrawalRequestAction,
  options: ParseOptions,
  partial: PartialTx,
): ApiTransactionActivity {
  const { network, addressBook } = options;
  const { details } = action;

  return {
    ...partial,
    slug: TONCOIN.slug,
    amount: 0n, // TODO (actions) Replace to real fee
    isIncoming: false,
    fromAddress: addressBook[details.pool].user_friendly,
    toAddress: addressBook[details.stake_holder].user_friendly,
    normalizedAddress: toBase64Address(details.pool, true, network),
    type: 'unstakeRequest',
  };
}

function parseJettonSwap(action: SwapAction, options: ParseOptions): ApiSwapActivity {
  const { metadata } = options;
  const {
    trace_id: traceId,
    start_lt: startLt,
    end_utime: endUtime,
    success: isSuccess,
    details: {
      dex_incoming_transfer: {
        amount: fromAmount,
        asset: fromAsset,
      },
      dex_outgoing_transfer: {
        amount: toAmount,
        asset: toAsset,
      },
    },
  } = action;

  const decimalsFrom = (fromAsset && parseToncenterJetton(fromAsset, metadata)?.decimals) || TONCOIN.decimals;
  const decimalsTo = (toAsset && parseToncenterJetton(toAsset, metadata)?.decimals) || TONCOIN.decimals;

  const fromTokenAddress = fromAsset ? toBase64Address(fromAsset, true) : undefined;
  const toTokenAddress = toAsset ? toBase64Address(toAsset, true) : undefined;

  const from = fromTokenAddress && fromTokenAddress !== STON_PTON_ADDRESS
    ? buildTokenSlug('ton', fromTokenAddress) : TONCOIN.slug;
  const to = toTokenAddress && toTokenAddress !== STON_PTON_ADDRESS
    ? buildTokenSlug('ton', toTokenAddress) : TONCOIN.slug;

  return {
    kind: 'swap',
    id: buildTxId(traceId, startLt),
    timestamp: toMilliseconds(endUtime),
    from,
    fromAmount: toDecimal(BigInt(fromAmount), decimalsFrom),
    to,
    toAmount: toDecimal(BigInt(toAmount), decimalsTo),
    networkFee: '0',
    swapFee: '0',
    ourFee: '0',
    status: isSuccess ? 'completed' : 'failed',
    hashes: [],
    externalMsgHash: action.trace_external_hash,
    shouldLoadDetails: true,
  };
}

function parseDns(
  action: ChangeDnsAction | RenewDnsAction | DeleteDnsAction,
  options: ParseOptions,
  partial: PartialTx,
): ApiTransactionActivity {
  const { network, addressBook, metadata } = options;
  const { details } = action;

  const fromAddress = addressBook[details.source].user_friendly;
  const toAddress = addressBook[details.asset].user_friendly;
  const normalizedAddress = toBase64Address(toAddress, true, network);
  const nft = parseToncenterNft(metadata, details.asset);

  let type: ApiTransactionType;
  if (action.type === 'change_dns') {
    const { sum_type: sumType } = action.details.value;
    if (sumType === 'DNSSmcAddress') {
      type = 'dnsChangeAddress';
    } else if (sumType === 'DNSAdnlAddress') {
      type = 'dnsChangeSite';
    } else if (sumType === 'DNSStorageAddress') {
      type = 'dnsChangeStorage';
    } else if (sumType === 'DNSNextResolver') {
      type = 'dnsChangeSubdomains';
    }
  } else if (
    action.type === 'renew_dns'
    || (action.type === 'delete_dns' && action.details.hash.endsWith(TME_RENEW_HASH_SUFFIX))
  ) {
    type = 'dnsRenew';
  } else {
    type = 'dnsDelete';
  }

  return {
    ...partial,
    slug: TONCOIN.slug,
    amount: 0n, // TODO (actions) Replace to real fee
    isIncoming: false,
    fromAddress,
    toAddress,
    normalizedAddress,
    type,
    nft,
  };
}

function parseAuctionBid(
  action: AuctionBidAction,
  options: ParseOptions,
  partial: PartialTx,
): ApiTransactionActivity {
  const { network, addressBook, metadata, walletAddress } = options;
  const { details } = action;

  const {
    bidder,
    auction,
    nft_item_index: index,
    nft_item: rawNftAddress,
    nft_collection: rawCollectionAddress,
  } = details;

  const fromAddress = addressBook[bidder].user_friendly;
  const toAddress = addressBook[auction].user_friendly;
  const isIncoming = toAddress === walletAddress;
  const amount = isIncoming ? BigInt(details.amount) : -BigInt(details.amount);
  const normalizedAddress = toBase64Address(isIncoming ? fromAddress : toAddress, true, network);
  const nft = parseToncenterNft(
    metadata,
    rawNftAddress ?? undefined,
    rawCollectionAddress ?? undefined,
    index ?? undefined,
  );

  return {
    ...partial,
    slug: TONCOIN.slug,
    amount,
    isIncoming,
    fromAddress,
    toAddress,
    normalizedAddress,
    type: 'auctionBid',
    nft,
  };
}

function parseLiquidityDeposit(
  action: DexDepositLiquidityAction,
  options: ParseOptions,
  partial: PartialTx,
): ApiTransactionActivity[] {
  const { network, addressBook } = options;
  const { details } = action;

  const partialExtended = {
    ...partial,
    fromAddress: addressBook[details.source].user_friendly,
    toAddress: addressBook[details.pool].user_friendly,
    normalizedAddress: toBase64Address(details.pool, true, network),
    isIncoming: false,
    type: 'liquidityDeposit',
  } as const;

  const activities: ApiTransactionActivity[] = [{
    ...partialExtended,
    amount: -BigInt(details.amount_1!),
    slug: getAssetSlug(addressBook, details.asset_1),
  }];

  if (details.lp_tokens_minted) {
    const id = buildTxId(action.trace_id, action.start_lt, 'additional');
    activities.push({
      ...partialExtended,
      id,
      txId: id,
      amount: -BigInt(details.amount_2!),
      slug: getAssetSlug(addressBook, details.asset_2),
    });
  }

  return activities;
}

function parseLiquidityWithdraw(
  action: DexWithdrawLiquidityAction,
  options: ParseOptions,
  partial: PartialTx,
): ApiTransactionActivity[] {
  const { network, addressBook } = options;
  const { details } = action;

  const partialExtended = {
    ...partial,
    fromAddress: addressBook[details.pool].user_friendly,
    toAddress: addressBook[details.source].user_friendly,
    normalizedAddress: toBase64Address(details.pool, true, network),
    isIncoming: true,
    type: 'liquidityWithdraw',
  } as const;

  const additionalId = buildTxId(action.trace_id, action.start_lt, 'additional');

  return [
    {
      ...partialExtended,
      amount: BigInt(details.amount_1!),
      slug: getAssetSlug(addressBook, details.asset_1),
    },
    {
      ...partialExtended,
      id: additionalId,
      txId: additionalId,
      amount: BigInt(details.amount_2!),
      slug: getAssetSlug(addressBook, details.asset_2),
    },
  ];
}

function getAssetSlug(addressBook: AddressBook, rawAddress?: string | null) {
  return rawAddress ? buildTokenSlug('ton', addressBook[rawAddress].user_friendly) : TONCOIN.slug;
}

function parseToncenterNft(
  metadataMap: MetadataMap,
  rawNftAddress: string,
  rawCollectionAddress?: string,
  index?: string,
): ApiNft | undefined {
  try {
    const nftMetadata = extractMetadata<NftItemMetadata>(rawNftAddress, metadataMap, 'nft_items');

    if (!nftMetadata) {
      return undefined;
    }

    const { name, description, extra } = nftMetadata;
    let { image } = nftMetadata;

    const nftAddress = toBase64Address(rawNftAddress, true);
    const collectionMetadata = rawCollectionAddress
      ? extractMetadata<NftCollectionMetadata>(rawCollectionAddress, metadataMap, 'nft_collections')
      : undefined;
    const collectionAddress = rawCollectionAddress ? toBase64Address(rawCollectionAddress, true) : undefined;

    // TODO (actions) Determine that this is a domain by the collection address once Toncenter adds it
    const domain = extra?.domain ?? name ?? '';
    const domainZone = getDnsDomainZone(domain)?.zone;

    if (domainZone && (!collectionAddress || !image)) {
      if (domainZone.suffixes[0] === 'ton') {
        image = `${DNS_IMAGE_GEN_URL}${extra!.domain!}`;
      }

      return omitUndefined<ApiNft>({
        index: Number(index),
        name: domain,
        address: nftAddress,
        // eslint-disable-next-line no-underscore-dangle
        thumbnail: extra?._image_medium ?? image!,
        image: image!,
        description,
        isOnSale: false, // TODO (actions) Replace with real value when Toncenter supports it
        collectionAddress: collectionAddress ?? domainZone.resolver,
        collectionName: domainZone.collectionName,
        metadata: {},
      });
    }

    let hasScamLink = false;

    if (!collectionAddress || !checkIsTrustedCollection(collectionAddress)) {
      for (const text of [name, description].filter(Boolean)) {
        if (checkHasScamLink(text)) {
          hasScamLink = true;
        }
      }
    }

    const isScam = hasScamLink; // TODO (actions) Replace with real value when Toncenter supports it
    const isHidden = extra?.render_type === 'hidden' || isScam;
    const isFragmentGift = image?.startsWith(NFT_FRAGMENT_GIFT_IMAGE_URL_PREFIX);
    const fixedImage = image ? fixIpfsUrl(image) : undefined;
    // eslint-disable-next-line no-underscore-dangle
    const thumbnail = extra?._image_medium ?? fixedImage!;

    const nft: ApiNft = omitUndefined<ApiNft>({
      index: Number(index),
      name: name!,
      address: nftAddress,
      thumbnail,
      image: fixedImage!,
      description,
      isOnSale: false, // TODO (actions) Replace with real value when Toncenter supports it
      isHidden,
      metadata: {
        ...(isFragmentGift && {
          fragmentUrl: image!.replace(NFT_FRAGMENT_GIFT_IMAGE_TO_URL_REGEX, 'https://$1'),
        }),
      },
      ...(collectionAddress && {
        collectionAddress,
        collectionName: collectionMetadata?.name,
        isOnFragment: isFragmentGift || NFT_FRAGMENT_COLLECTIONS.has(rawCollectionAddress!),
      }),
    });

    return nft;
  } catch (err) {
    return undefined;
  }
}

function parseToncenterJetton(rawAddress: string, metadata: MetadataMap): ApiToken | undefined {
  const tokenAddress = toBase64Address(rawAddress, true);
  const slug = buildTokenSlug('ton', tokenAddress);
  const token = getTokenBySlug(slug);

  if (token) {
    return token;
  }

  const jettonMetadata = extractMetadata<JettonMasterMetadata>(rawAddress, metadata, 'jetton_masters');

  if (!jettonMetadata) {
    return undefined;
  }

  return {
    tokenAddress,
    slug,
    chain: 'ton',
    name: jettonMetadata.name!,
    symbol: jettonMetadata.symbol!,
    image: jettonMetadata.image!,
    decimals: Number(jettonMetadata.extra!.decimals),
  };
}

function extractMetadata<T extends AnyTokenMetadata>(
  rawAddress: string,
  metadata: MetadataMap,
  type: AnyTokenMetadata['type'],
): T | undefined {
  const data = metadata[rawAddress];
  if (!data || !data.is_indexed) return undefined;
  return data.token_info?.find((tokenInfo) => tokenInfo.type === type) as T;
}
