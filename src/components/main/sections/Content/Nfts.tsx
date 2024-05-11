import React, { memo, useEffect, useMemo } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiNft } from '../../../../api/types';

import {
  ANIMATED_STICKER_BIG_SIZE_PX,
  BURN_ADDRESS,
  GETGEMS_BASE_MAINNET_URL,
  GETGEMS_BASE_TESTNET_URL,
  NOTCOIN_VOUCHERS_ADDRESS,
  TON_TOKEN_SLUG,
} from '../../../../config';
import renderText from '../../../../global/helpers/renderText';
import { selectCurrentAccountState, selectIsHardwareAccount } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import captureEscKeyListener from '../../../../util/captureEscKeyListener';
import { IS_ANDROID_APP, IS_IOS_APP } from '../../../../util/windowEnvironment';
import { NFT_TRANSFER_TON_AMOUNT } from '../../../../api/blockchains/ton/constants';
import { ANIMATED_STICKERS_PATHS } from '../../../ui/helpers/animatedAssets';

import { getIsPortrait, useDeviceScreen } from '../../../../hooks/useDeviceScreen';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import AnimatedIconWithPreview from '../../../ui/AnimatedIconWithPreview';
import Button from '../../../ui/Button';
import Loading from '../../../ui/Loading';
import Nft from './Nft';

import styles from './Nft.module.scss';

interface OwnProps {
  isActive?: boolean;
}

interface StateProps {
  orderedAddresses?: string[];
  selectedAddresses?: string[];
  byAddress?: Record<string, ApiNft>;
  currentCollectionAddress?: string;
  isHardware?: boolean;
  isTestnet?: boolean;
}

const GETGEMS_ENABLED = !IS_IOS_APP && !IS_ANDROID_APP;

function Nfts({
  isActive, orderedAddresses, selectedAddresses, byAddress, currentCollectionAddress, isHardware, isTestnet,
}: OwnProps & StateProps) {
  const { clearNftsSelection, startTransfer, submitTransferInitial } = getActions();

  const lang = useLang();
  const { isLandscape } = useDeviceScreen();
  const hasSelection = Boolean(selectedAddresses?.length);

  useEffect(clearNftsSelection, [clearNftsSelection, isActive, currentCollectionAddress]);
  useEffect(() => (hasSelection ? captureEscKeyListener(clearNftsSelection) : undefined), [hasSelection]);

  const getgemsBaseUrl = isTestnet ? GETGEMS_BASE_TESTNET_URL : GETGEMS_BASE_MAINNET_URL;

  const nfts = useMemo(() => {
    if (!orderedAddresses || !byAddress) {
      return undefined;
    }

    return orderedAddresses
      .map((address) => byAddress[address])
      .filter((nft) => {
        if (!nft) return false;

        return !currentCollectionAddress || nft.collectionAddress === currentCollectionAddress;
      });
  }, [byAddress, currentCollectionAddress, orderedAddresses]);

  const handleBurnNotcoinVouchersClick = useLastCallback(() => {
    const collectionNfts = Object.values(nfts!).filter((nft) => {
      return nft.collectionAddress === NOTCOIN_VOUCHERS_ADDRESS && !nft.isOnSale;
    });

    startTransfer({
      isPortrait: getIsPortrait(),
      nfts: collectionNfts,
    });

    submitTransferInitial({
      tokenSlug: TON_TOKEN_SLUG,
      amount: NFT_TRANSFER_TON_AMOUNT,
      toAddress: BURN_ADDRESS,
      nftAddresses: collectionNfts.map(({ address }) => address),
    });
  });

  if (nfts === undefined) {
    return (
      <div className={buildClassName(styles.emptyList, styles.emptyListLoading)}>
        <Loading />
      </div>
    );
  }

  if (nfts.length === 0) {
    return (
      <div className={styles.emptyList}>
        {!isHardware ? (
          <>
            <AnimatedIconWithPreview
              play={isActive}
              tgsUrl={ANIMATED_STICKERS_PATHS.happy}
              previewUrl={ANIMATED_STICKERS_PATHS.happyPreview}
              size={ANIMATED_STICKER_BIG_SIZE_PX}
              className={styles.sticker}
              noLoop={false}
              nonInteractive
            />
            <p className={styles.emptyListTitle}>{lang('No NFTs yet')}</p>
            {GETGEMS_ENABLED && (
              <>
                <p className={styles.emptyListText}>{renderText(lang('$nft_explore_offer'))}</p>
                <a className={styles.emptyListButton} href={getgemsBaseUrl} rel="noreferrer noopener" target="_blank">
                  {lang('Open Getgems')}
                </a>
              </>
            )}
          </>
        ) : (
          <>
            <AnimatedIconWithPreview
              play={isActive}
              tgsUrl={ANIMATED_STICKERS_PATHS.noData}
              previewUrl={ANIMATED_STICKERS_PATHS.noDataPreview}
              size={ANIMATED_STICKER_BIG_SIZE_PX}
              className={styles.sticker}
              noLoop={false}
              nonInteractive
            />
            <p className={styles.emptyListText}>{lang('$nft_hardware_unsupported')}</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      {currentCollectionAddress === NOTCOIN_VOUCHERS_ADDRESS && (
        <Button
          isPrimary
          className={styles.notcoinVoucherButton}
          onClick={handleBurnNotcoinVouchersClick}
        >
          {lang('Burn NOT Vouchers')}
        </Button>
      )}
      <div className={buildClassName(styles.list, isLandscape && styles.landscapeList)}>
        {nfts.map((nft) => <Nft key={nft.address} nft={nft} selectedAddresses={selectedAddresses} />)}
      </div>
    </div>
  );
}
export default memo(
  withGlobal<OwnProps>(
    (global): StateProps => {
      const {
        orderedAddresses,
        byAddress,
        currentCollectionAddress,
        selectedAddresses,
      } = selectCurrentAccountState(global)?.nfts || {};

      return {
        orderedAddresses,
        selectedAddresses,
        byAddress,
        isHardware: selectIsHardwareAccount(global),
        currentCollectionAddress,
        isTestnet: global.settings.isTestnet,
      };
    },
    (global, _, stickToFirst) => stickToFirst(global.currentAccountId),
  )(Nfts),
);
