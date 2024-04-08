import React, { memo, useMemo } from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../global';

import type { ApiNft } from '../../../../api/types';

import { ANIMATED_STICKER_BIG_SIZE_PX, GETGEMS_BASE_MAINNET_URL, GETGEMS_BASE_TESTNET_URL } from '../../../../config';
import renderText from '../../../../global/helpers/renderText';
import { selectCurrentAccountState, selectIsHardwareAccount } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { IS_ANDROID_APP, IS_IOS_APP } from '../../../../util/windowEnvironment';
import { ANIMATED_STICKERS_PATHS } from '../../../ui/helpers/animatedAssets';

import { useDeviceScreen } from '../../../../hooks/useDeviceScreen';
import useLang from '../../../../hooks/useLang';

import AnimatedIconWithPreview from '../../../ui/AnimatedIconWithPreview';
import Loading from '../../../ui/Loading';
import Nft from './Nft';

import styles from './Nft.module.scss';

interface OwnProps {
  isActive?: boolean;
}

interface StateProps {
  orderedAddresses?: string[];
  byAddress?: Record<string, ApiNft>;
  isHardware?: boolean;
  isTestnet?: boolean;
}

const GETGEMS_ENABLED = !IS_IOS_APP && !IS_ANDROID_APP;

function Nfts({
  isActive, orderedAddresses, byAddress, isHardware, isTestnet,
}: OwnProps & StateProps) {
  const lang = useLang();
  const { isLandscape } = useDeviceScreen();

  const getgemsBaseUrl = isTestnet ? GETGEMS_BASE_TESTNET_URL : GETGEMS_BASE_MAINNET_URL;

  const nfts = useMemo(() => {
    if (!orderedAddresses || !byAddress) {
      return undefined;
    }

    return orderedAddresses.map((address) => byAddress[address]).filter(Boolean);
  }, [byAddress, orderedAddresses]);

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
    <div className={buildClassName(styles.list, isLandscape && styles.landscapeList)}>
      {nfts.map((nft) => <Nft key={nft.address} nft={nft} />)}
    </div>
  );
}
export default memo(
  withGlobal<OwnProps>(
    (global): StateProps => {
      const { orderedAddresses, byAddress } = selectCurrentAccountState(global)?.nfts || {};

      return {
        orderedAddresses,
        byAddress,
        isHardware: selectIsHardwareAccount(global),
        isTestnet: global.settings.isTestnet,
      };
    },
    (global, _, stickToFirst) => stickToFirst(global.currentAccountId),
  )(Nfts),
);
