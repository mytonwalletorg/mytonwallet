import React, { memo, useEffect, useMemo } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiNft } from '../../../../api/types';

import {
  ANIMATED_STICKER_BIG_SIZE_PX,
  GETGEMS_BASE_MAINNET_URL,
  GETGEMS_BASE_TESTNET_URL,
  NOTCOIN_VOUCHERS_ADDRESS,
} from '../../../../config';
import renderText from '../../../../global/helpers/renderText';
import { selectCurrentAccountState } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import captureEscKeyListener from '../../../../util/captureEscKeyListener';
import { IS_ANDROID_APP, IS_IOS_APP } from '../../../../util/windowEnvironment';
import { ANIMATED_STICKERS_PATHS } from '../../../ui/helpers/animatedAssets';

import { useDeviceScreen } from '../../../../hooks/useDeviceScreen';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import AnimatedIconWithPreview from '../../../ui/AnimatedIconWithPreview';
import Button from '../../../ui/Button';
import Loading from '../../../ui/Loading';
import Transition from '../../../ui/Transition';
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
  isTestnet?: boolean;
  blacklistedNftAddresses?: string[];
  whitelistedNftAddresses?: string[];
}

const GETGEMS_ENABLED = !IS_IOS_APP && !IS_ANDROID_APP;

function Nfts({
  isActive,
  orderedAddresses,
  selectedAddresses,
  byAddress,
  currentCollectionAddress,
  isTestnet,
  blacklistedNftAddresses,
  whitelistedNftAddresses,
}: OwnProps & StateProps) {
  const { clearNftsSelection, burnNfts } = getActions();

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

    const blacklistedNftAddressesSet = new Set(blacklistedNftAddresses);
    const whitelistedNftAddressesSet = new Set(whitelistedNftAddresses);

    return orderedAddresses
      .map((address) => byAddress[address])
      .filter((nft) => {
        if (!nft) return false;

        return !currentCollectionAddress || nft.collectionAddress === currentCollectionAddress;
      })
      .filter((nft) => (
        !nft.isHidden || whitelistedNftAddressesSet.has(nft.address)
      ) && !blacklistedNftAddressesSet.has(nft.address));
  }, [
    byAddress, currentCollectionAddress, orderedAddresses, blacklistedNftAddresses, whitelistedNftAddresses,
  ]);

  const handleBurnNotcoinVouchersClick = useLastCallback(() => {
    burnNfts({ nfts: nfts! });
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
          {/* eslint-disable-next-line max-len */}
          <svg className={styles.notcoinVoucherIcon} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" color="#ffffff" style="transform: rotateX(180deg);"><path fill-rule="evenodd" clip-rule="evenodd" d="M7.14138 15.4996C7.2095 15.5943 7.34508 15.767 7.576 15.8689C7.84607 15.9881 8.15383 15.9881 8.4239 15.8689C8.65482 15.767 8.7904 15.5943 8.85852 15.4996C8.92424 15.4081 8.99102 15.2945 9.04911 15.1957L14.3316 6.21548C14.6645 5.64971 14.9405 5.18052 15.1235 4.79199C15.3081 4.40015 15.4553 3.97793 15.4105 3.52755C15.3472 2.89047 15.0155 2.31052 14.4985 1.93295C14.133 1.66602 13.6944 1.57879 13.2631 1.53922C12.8355 1.49998 12.2912 1.49999 11.6348 1.5H4.36532C3.70891 1.49999 3.16447 1.49998 2.73678 1.53922C2.30546 1.57879 1.86692 1.66602 1.50141 1.93294C0.984382 2.31052 0.652684 2.89047 0.589388 3.52755C0.544641 3.97793 0.691804 4.40015 0.876386 4.79199C1.05941 5.18052 1.33542 5.6497 1.66824 6.21547L6.95075 15.1956C7.00885 15.2945 7.07565 15.4081 7.14138 15.4996ZM8.74995 3L8.74994 12.7458L8.74995 12.7563L13.4336 4.80929C13.7831 4.21637 13.9578 3.91991 13.9337 3.67629C13.9127 3.46383 13.8022 3.27038 13.6298 3.14442C13.4322 3 13.088 3 12.3996 3H8.74995ZM7.99995 14.0208L7.98772 14H8.01218L7.99995 14.0208ZM7.24995 12.7563V3H3.60028C2.91192 3 2.56774 3 2.37007 3.14442C2.19769 3.27038 2.08716 3.46383 2.06617 3.67629C2.04211 3.91991 2.21684 4.21637 2.56629 4.80929L7.24995 12.7563Z" fill="currentColor" /></svg>
          {lang('Burn NOT Vouchers')}
        </Button>
      )}
      <Transition
        name="fade"
        activeKey={nfts.length}
        shouldCleanup
      >
        <div className={buildClassName(styles.list, isLandscape && styles.landscapeList)}>
          {nfts.map((nft) => <Nft key={nft.address} nft={nft} selectedAddresses={selectedAddresses} />)}
        </div>
      </Transition>
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

      const {
        blacklistedNftAddresses,
        whitelistedNftAddresses,
      } = selectCurrentAccountState(global) || {};

      return {
        orderedAddresses,
        selectedAddresses,
        byAddress,
        currentCollectionAddress,
        isTestnet: global.settings.isTestnet,
        blacklistedNftAddresses,
        whitelistedNftAddresses,
      };
    },
    (global, _, stickToFirst) => {
      const {
        currentCollectionAddress,
      } = selectCurrentAccountState(global)?.nfts || {};

      return stickToFirst(`${global.currentAccountId}_${currentCollectionAddress || 'all'}`);
    },
  )(Nfts),
);
