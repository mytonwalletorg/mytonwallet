import React, { memo, useEffect } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiNft } from '../../../../api/types';

import { selectCurrentAccountState } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import captureEscKeyListener from '../../../../util/captureEscKeyListener';

import { getIsPortrait } from '../../../../hooks/useDeviceScreen';
import useHistoryBack from '../../../../hooks/useHistoryBack';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import Button from '../../../ui/Button';

import styles from './NftCollectionHeader.module.scss';

interface StateProps {
  byAddress?: Record<string, ApiNft>;
  selectedAddresses?: string[];
}

function NftSelectionHeader({ selectedAddresses, byAddress }: StateProps) {
  const { clearNftsSelection, startTransfer, burnNfts } = getActions();

  const lang = useLang();
  const amount = selectedAddresses?.length ?? 1;
  const isActive = Boolean(selectedAddresses?.length);

  useHistoryBack({
    isActive,
    onBack: clearNftsSelection,
  });

  useEffect(() => (isActive ? captureEscKeyListener(clearNftsSelection) : undefined), [isActive]);

  const handleSendClick = useLastCallback(() => {
    const nfts = selectedAddresses!.map((address) => byAddress![address]) ?? [];
    if (!nfts.length) return;

    clearNftsSelection();

    startTransfer({
      isPortrait: getIsPortrait(),
      nfts: selectedAddresses!.map((address) => byAddress![address]) ?? [],
    });
  });

  const handleBurnClick = useLastCallback(() => {
    const nfts = selectedAddresses!.map((address) => byAddress![address]) ?? [];
    if (!nfts.length) return;

    clearNftsSelection();

    burnNfts({ nfts });
  });

  return (
    <div className={styles.root}>
      <Button className={styles.backButton} isSimple isText onClick={clearNftsSelection}>
        <i className={buildClassName(styles.backIcon, 'icon-chevron-left')} aria-hidden />
        <span>{lang('Back')}</span>
      </Button>
      <div className={styles.content}>
        <div className={styles.title}>
          {amount > 1 ? lang('%amount% NFTs Selected', { amount }) : lang('1 NFT Selected')}
        </div>
      </div>
      <div>
        <Button
          isSimple
          isSmall
          className={styles.sendAllButton}
          ariaLabel={lang('Send All')}
          onClick={handleSendClick}
        >
          <i className={buildClassName(styles.buttonIcon, 'icon-send-small')} aria-hidden />
        </Button>
        <Button
          isSimple
          isSmall
          isDestructive
          className={styles.burnAllButton}
          ariaLabel={lang('Burn All')}
          onClick={handleBurnClick}
        >
          <i className={buildClassName(styles.buttonIcon, 'icon-trash-small')} aria-hidden />
        </Button>
      </div>

    </div>
  );
}

export default memo(withGlobal((global): StateProps => {
  const {
    selectedAddresses, byAddress,
  } = selectCurrentAccountState(global)?.nfts || {};

  return { selectedAddresses, byAddress };
})(NftSelectionHeader));
