import type { Ref, RefObject } from 'react';
import type { TeactNode } from '../../../../lib/teact/teact';
import React, { memo, useMemo } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { ApiTokenWithPrice, ApiTransactionActivity, ApiYieldType } from '../../../../api/types';
import type { Account, AppTheme, SavedAddress } from '../../../../global/types';
import { MediaType } from '../../../../global/types';

import { ANIMATED_STICKER_TINY_ICON_PX, FRACTION_DIGITS, TONCOIN, TRANSACTION_ADDRESS_SHIFT } from '../../../../config';
import {
  DNS_TRANSACTION_TYPES,
  getIsTxIdLocal,
  getTransactionAmountDisplayMode,
  getTransactionTitle,
  isScamTransaction,
  shouldShowTransactionAddress,
  shouldShowTransactionAnnualYield,
  shouldShowTransactionComment,
  STAKING_TRANSACTION_TYPES,
} from '../../../../util/activities';
import { bigintAbs } from '../../../../util/bigint';
import buildClassName from '../../../../util/buildClassName';
import { formatTime } from '../../../../util/dateFormat';
import { toDecimal } from '../../../../util/decimals';
import { formatCurrencyExtended } from '../../../../util/formatNumber';
import { getLocalAddressName } from '../../../../util/getLocalAddressName';
import getPseudoRandomNumber from '../../../../util/getPseudoRandomNumber';
import { shortenAddress } from '../../../../util/shortenAddress';
import { ANIMATED_STICKERS_PATHS } from '../../../ui/helpers/animatedAssets';

import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import AnimatedIconWithPreview from '../../../ui/AnimatedIconWithPreview';
import Button from '../../../ui/Button';
import SensitiveData from '../../../ui/SensitiveData';

import styles from './Activity.module.scss';

import scamImg from '../../../../assets/scam.svg';

type OwnProps = {
  ref?: Ref<HTMLElement>;
  tokensBySlug?: Record<string, ApiTokenWithPrice>;
  transaction: ApiTransactionActivity;
  isLast?: boolean;
  isActive?: boolean;
  withChainIcon?: boolean;
  annualYield?: number;
  yieldType?: ApiYieldType;
  appTheme: AppTheme;
  savedAddresses?: SavedAddress[];
  doesNftExist?: boolean;
  isSensitiveDataHidden?: boolean;
  isFuture?: boolean;
  accounts?: Record<string, Account>;
  currentAccountId: string;
  onClick?: (id: string) => void;
};

const TRANSACTION_HEIGHT = 4; // rem
const NFT_EXTRA_HEIGHT = 3.875; // rem
const COMMENT_EXTRA_HEIGHT = 2.375; // rem
const SUBHEADER_RELEASE_HEIGHT = 1.25; // rem

function Transaction({
  ref,
  tokensBySlug,
  transaction,
  isActive,
  annualYield,
  yieldType,
  savedAddresses,
  isLast,
  appTheme,
  withChainIcon,
  doesNftExist,
  isSensitiveDataHidden,
  isFuture,
  accounts,
  currentAccountId,
  onClick,
}: OwnProps) {
  const { openMediaViewer } = getActions();
  const lang = useLang();

  const {
    txId,
    amount,
    fromAddress,
    toAddress,
    timestamp,
    comment,
    encryptedComment,
    isIncoming,
    type,
    metadata,
    slug,
    nft,
  } = transaction;

  const isStake = type === 'stake';
  const isStaking = STAKING_TRANSACTION_TYPES.has(type);
  const isDnsOperation = DNS_TRANSACTION_TYPES.has(type);

  const token = tokensBySlug?.[slug];
  const { chain } = token || {};
  const address = isIncoming ? fromAddress : toAddress;
  const localAddressName = useMemo(() => {
    if (!chain) return undefined;

    return getLocalAddressName({
      address,
      chain,
      currentAccountId,
      accounts,
      savedAddresses,
    });
  }, [accounts, address, chain, currentAccountId, savedAddresses]);
  const addressName = localAddressName || metadata?.name;
  const isLocal = getIsTxIdLocal(txId);
  const amountCols = useMemo(() => getPseudoRandomNumber(5, 13, timestamp.toString()), [timestamp]);
  const attachmentsTakeSubheader = shouldAttachmentTakeSubheader(transaction, isFuture);
  const isNoSubheaderLeft = !!isFuture;
  const isNoSubheaderRight = !shouldShowTransactionAddress(transaction)
    && !shouldShowTransactionAnnualYield(transaction);

  let operationColorClass: string | undefined;
  let waitingIconName: keyof typeof ANIMATED_STICKERS_PATHS.light.preview = 'iconClockGray';
  if (type === 'burn') {
    operationColorClass = styles.colorNegative;
    waitingIconName = 'iconClockRed';
  } else if (isIncoming) {
    operationColorClass = styles.colorPositive;
    waitingIconName = 'iconClockGreen';
  } else if (isStake) {
    operationColorClass = styles.colorStake;
    waitingIconName = 'iconClockPurpleWhite';
  }

  const handleNftClick = useLastCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    openMediaViewer({ mediaId: nft!.address, mediaType: MediaType.Nft, txId });
  });

  function renderNft() {
    const isNftIncoming = type === 'nftTrade' ? !isIncoming : isIncoming;
    const nftColorClass = type === 'nftTrade'
      ? isNftIncoming
        ? styles.colorPositive
        : undefined
      : operationColorClass;

    return (
      <div
        className={buildClassName(
          styles.attachment,
          styles.nft,
          !doesNftExist && styles.nonInteractive,
          isNftIncoming && styles.received,
          comment && styles.nftWithComment,
          nftColorClass,
          'transaction-nft',
        )}
        onClick={doesNftExist ? handleNftClick : undefined}
        data-nft-address={nft?.address}
        data-tx-id={txId}
      >
        <img src={nft!.thumbnail} alt={nft!.name} className={styles.nftImage} />
        <div className={styles.nftData}>
          <div className={styles.nftName}>{nft!.name}</div>
          <div className={styles.nftCollection}>{nft!.collectionName}</div>
        </div>
      </div>
    );
  }

  function renderComment() {
    const className = buildClassName(
      styles.attachment,
      styles.comment,
      isIncoming && styles.received,
      operationColorClass,
    );

    return (
      <div className={className}>
        {encryptedComment && <i className={buildClassName(styles.commentIcon, 'icon-lock')} aria-hidden />}
        {encryptedComment ? <i>{lang('Encrypted Message')}</i> : comment}
      </div>
    );
  }

  function renderIcon() {
    let iconName: string;
    if (isStaking) {
      iconName = 'icon-earn';
    } else if (type === 'callContract' || type === 'contractDeploy') {
      iconName = 'icon-cog';
    } else if (isDnsOperation) {
      iconName = 'icon-globe-alt';
    } else if (type === 'mint') {
      iconName = 'icon-magic-wand';
    } else if (type === 'burn') {
      iconName = 'icon-fire';
    } else if (type === 'auctionBid') {
      iconName = 'icon-auction-alt';
    } else if (type === 'nftTrade') {
      iconName = isIncoming ? 'icon-tag' : 'icon-purchase';
    } else if (type === 'liquidityDeposit') {
      iconName = 'icon-can-in';
    } else if (type === 'liquidityWithdraw') {
      iconName = 'icon-can-out';
    } else if (isIncoming) {
      iconName = 'icon-receive-alt';
    } else {
      iconName = 'icon-send-alt';
    }

    return (
      <i className={buildClassName(styles.icon, iconName, operationColorClass)} aria-hidden>
        {isLocal && (
          <AnimatedIconWithPreview
            play
            size={ANIMATED_STICKER_TINY_ICON_PX}
            className={styles.iconWaiting}
            nonInteractive
            noLoop={false}
            forceOnHeavyAnimation
            tgsUrl={ANIMATED_STICKERS_PATHS[appTheme][waitingIconName]}
            previewUrl={ANIMATED_STICKERS_PATHS[appTheme].preview[waitingIconName]}
          />
        )}
      </i>
    );
  }

  function renderAmount() {
    const amountDisplayMode = getTransactionAmountDisplayMode(transaction);
    let content: TeactNode;
    let isSensitiveData = false;

    if (amountDisplayMode !== 'hide') {
      const noSign = amountDisplayMode === 'noSign';
      content = formatCurrencyExtended(
        toDecimal(noSign ? bigintAbs(amount) : amount, token?.decimals ?? FRACTION_DIGITS),
        token?.symbol || TONCOIN.symbol,
        noSign,
        undefined,
        !isIncoming,
      );
      isSensitiveData = true;
    } else if (isDnsOperation) {
      content = 'TON DNS';
    } else if (nft) {
      content = 'NFT';
    } else {
      return undefined;
    }

    return (
      <SensitiveData
        isActive={isSensitiveDataHidden && isSensitiveData}
        cols={amountCols}
        rows={2}
        cellSize={8}
        align="right"
        className={buildClassName(
          styles.amount,
          operationColorClass,
          isNoSubheaderRight && attachmentsTakeSubheader === 'none' && styles.atMiddle,
        )}
      >
        {content}
      </SensitiveData>
    );
  }

  function renderAddress() {
    return (
      <div className={styles.address}>
        {shouldShowTransactionAddress(transaction) && lang(isIncoming ? '$transaction_from' : '$transaction_to', {
          address: (
            <span className={styles.addressValue}>
              {withChainIcon && Boolean(chain) && (
                <i
                  className={buildClassName(styles.chainIcon, `icon-chain-${chain.toLowerCase()}`)}
                  aria-label={chain}
                />
              )}
              {addressName || shortenAddress(address, TRANSACTION_ADDRESS_SHIFT)}
            </span>
          ),
        })}
        {shouldShowTransactionAnnualYield(transaction) && lang('at %annual_yield%', {
          annual_yield: <span className={styles.addressValue}>{yieldType} {annualYield}%</span>,
        })}
      </div>
    );
  }

  return (
    <Button
      ref={ref as RefObject<HTMLButtonElement>}
      className={buildClassName(
        styles.item,
        isLast && styles.itemLast,
        isActive && styles.active,
        onClick && styles.interactive,
        attachmentsTakeSubheader === 'full' ? styles.attachmentsInFullSubheader
          : attachmentsTakeSubheader === 'half' ? styles.attachmentsInHalfSubheader : undefined,
      )}
      onClick={onClick && (() => onClick(txId))}
      isSimple
    >
      {renderIcon()}
      <div className={styles.header}>
        <div
          className={buildClassName(
            styles.operationName,
            isNoSubheaderLeft && attachmentsTakeSubheader === 'none' && styles.atMiddle,
          )}
        >
          {getTransactionTitle(transaction, isFuture ? 'future' : 'past', lang)}
          {isScamTransaction(transaction) && <img src={scamImg} alt={lang('Scam')} className={styles.scamImage} />}
        </div>
        {renderAmount()}
      </div>
      <div className={styles.subheader}>
        <div>{!isFuture && formatTime(timestamp)}</div>
        {renderAddress()}
      </div>
      {nft && renderNft()}
      {shouldShowTransactionComment(transaction) && renderComment()}
    </Button>
  );
}

export default memo(Transaction);

export function getTransactionHeight(transaction: ApiTransactionActivity, isFuture?: boolean) {
  return TRANSACTION_HEIGHT
    + (transaction.nft ? NFT_EXTRA_HEIGHT : 0)
    + (shouldShowTransactionComment(transaction) ? COMMENT_EXTRA_HEIGHT : 0)
    - (shouldAttachmentTakeSubheader(transaction, isFuture) !== 'none' ? SUBHEADER_RELEASE_HEIGHT : 0);
}

function shouldAttachmentTakeSubheader(
  transaction: ApiTransactionActivity,
  isFuture?: boolean,
): 'none' | 'half' | 'full' {
  if (!transaction.nft && !shouldShowTransactionComment(transaction)) {
    return 'none';
  }

  const isNoSubheaderLeft = !!isFuture || transaction.type === 'nftTrade';
  const isNoSubheaderRight = !shouldShowTransactionAddress(transaction)
    && !shouldShowTransactionAnnualYield(transaction)
    && transaction.type !== 'nftTrade';

  return transaction.isIncoming
    ? isNoSubheaderLeft ? isNoSubheaderRight ? 'full' : 'half' : 'none'
    : isNoSubheaderRight ? isNoSubheaderLeft ? 'full' : 'half' : 'none';
}
