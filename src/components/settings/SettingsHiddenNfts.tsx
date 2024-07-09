import React, { memo, useMemo, useState } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiNft } from '../../api/types';

import { selectCurrentAccountState } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';

import useHistoryBack from '../../hooks/useHistoryBack';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useScrolledState from '../../hooks/useScrolledState';

import UnhideNftModal from '../main/modals/UnhideNftModal';
import Button from '../ui/Button';
import ModalHeader from '../ui/ModalHeader';
import Switcher from '../ui/Switcher';

import styles from './Settings.module.scss';

interface OwnProps {
  isActive?: boolean;
  handleBackClick: NoneToVoidFunction;
  isInsideModal?: boolean;
}

interface StateProps {
  blacklistedNftAddresses?: string[];
  whitelistedNftAddresses?: string[];
  orderedAddresses?: string[];
  byAddress?: Record<string, ApiNft>;
  isUnhideNftModalOpen?: boolean;
}

function SettingsHiddenNfts({
  isActive,
  handleBackClick,
  isInsideModal,
  blacklistedNftAddresses,
  whitelistedNftAddresses,
  orderedAddresses,
  byAddress,
  isUnhideNftModalOpen,
}: OwnProps & StateProps) {
  const {
    openUnhideNftModal,
    removeNftSpecialStatus,
    closeUnhideNftModal,
  } = getActions();

  const lang = useLang();

  useHistoryBack({
    isActive,
    onBack: handleBackClick,
  });

  const {
    isScrolled,
    handleScroll: handleContentScroll,
  } = useScrolledState();

  const nfts = useMemo(() => {
    if (!orderedAddresses || !byAddress) {
      return undefined;
    }

    return orderedAddresses
      .map((address) => byAddress[address])
      .filter(Boolean);
  }, [
    byAddress, orderedAddresses,
  ]);

  const hiddenByUserNfts = useMemo(() => {
    const blacklistedNftAddressesSet = new Set(blacklistedNftAddresses);
    return nfts?.filter((nft) => blacklistedNftAddressesSet.has(nft.address));
  }, [nfts, blacklistedNftAddresses]);

  const probablyScamNfts = useMemo(() => {
    return nfts?.filter((nft) => nft.isHidden);
  }, [nfts]);

  const whitelistedNftAddressesSet = useMemo(() => {
    return new Set(whitelistedNftAddresses);
  }, [whitelistedNftAddresses]);

  const [selectedNft, setSelectedNft] = useState<{ address: string; name: string } | undefined>();

  const handleProbablyScamNftClick = useLastCallback((nft: ApiNft) => {
    const isWhitelisted = whitelistedNftAddressesSet?.has(nft.address);
    if (isWhitelisted) {
      removeNftSpecialStatus({ address: nft.address });
    } else {
      setSelectedNft({ address: nft.address, name: nft.name! });
      openUnhideNftModal();
    }
  });

  function renderHiddenByUserNfts() {
    return (
      <>
        <p className={styles.blockTitle}>{lang('Hidden By Me')}</p>
        <div className={styles.block}>
          {
            hiddenByUserNfts!.map((nft) => {
              return (
                <div
                  className={styles.item}
                  onClick={() => removeNftSpecialStatus({ address: nft.address })}
                  key={nft.address}
                >
                  <img className={styles.nftImage} src={nft.image} alt={nft.name} />
                  <div className={styles.nftPrimaryCell}>
                    <span className={styles.nftName}>{nft.name}</span>
                    {
                      nft.collectionName && <span className={styles.nftCollection}>{nft.collectionName}</span>
                    }
                  </div>

                  <Button isSmall isPrimary isText className={styles.nftButtonUnhide}>{lang('Unhide')}</Button>
                </div>
              );
            })
          }
        </div>
      </>
    );
  }

  function renderProbablyScamNfts() {
    return (
      <>
        <p className={styles.blockTitle}>{lang('Probably Scam')}</p>
        <div className={buildClassName(styles.block, styles.settingsBlockWithDescription)}>
          {
            probablyScamNfts!.map((nft) => {
              const isWhitelisted = whitelistedNftAddressesSet?.has(nft.address);
              return (
                <div
                  className={styles.item}
                  onClick={() => handleProbablyScamNftClick(nft)}
                  key={nft.address}
                >
                  <img className={styles.nftImage} src={nft.image} alt={nft.name} />
                  <div className={styles.nftPrimaryCell}>
                    <span className={styles.nftName}>{nft.name}</span>
                    {
                      nft.collectionName && <span className={styles.nftCollection}>{nft.collectionName}</span>
                    }
                  </div>

                  <Switcher
                    className={styles.menuSwitcher}
                    label={lang('Show')}
                    checked={isWhitelisted}
                  />
                </div>
              );
            })
          }
        </div>
        <p className={styles.blockDescription}>
          {lang('$settings_nft_probably_scam_description')}
        </p>
      </>
    );
  }

  return (
    <div className={styles.slide}>
      {isInsideModal ? (
        <ModalHeader
          title={lang('Hidden NFTs')}
          withNotch={isScrolled}
          onBackButtonClick={handleBackClick}
          className={styles.modalHeader}
        />
      ) : (
        <div className={buildClassName(styles.header, 'with-notch-on-scroll', isScrolled && 'is-scrolled')}>
          <Button isSimple isText onClick={handleBackClick} className={styles.headerBack}>
            <i className={buildClassName(styles.iconChevron, 'icon-chevron-left')} aria-hidden />
            <span>{lang('Back')}</span>
          </Button>
          <span className={styles.headerTitle}>{lang('Hidden NFTs')}</span>
        </div>
      )}

      <div
        className={buildClassName(styles.content, 'custom-scroll')}
        onScroll={handleContentScroll}
      >
        {Boolean(hiddenByUserNfts?.length) && renderHiddenByUserNfts()}
        {Boolean(probablyScamNfts?.length) && renderProbablyScamNfts()}
      </div>

      <UnhideNftModal
        isOpen={isUnhideNftModalOpen}
        onClose={closeUnhideNftModal}
        nftAddress={selectedNft?.address}
        nftName={selectedNft?.name}
      />
    </div>
  );
}

export default memo(withGlobal<OwnProps>((global): StateProps => {
  const {
    blacklistedNftAddresses,
    whitelistedNftAddresses,
    isUnhideNftModalOpen,
  } = selectCurrentAccountState(global) ?? {};
  const {
    orderedAddresses,
    byAddress,
  } = selectCurrentAccountState(global)?.nfts ?? {};
  return {
    blacklistedNftAddresses,
    whitelistedNftAddresses,
    orderedAddresses,
    byAddress,
    isUnhideNftModalOpen,
  };
})(SettingsHiddenNfts));
