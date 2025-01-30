import React, { memo, useState } from '../../lib/teact/teact';

import type { ApiDapp } from '../../api/types';

import { ANIMATED_STICKER_BIG_SIZE_PX } from '../../config';
import buildClassName from '../../util/buildClassName';
import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';

import useFlag from '../../hooks/useFlag';
import useHistoryBack from '../../hooks/useHistoryBack';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useScrolledState from '../../hooks/useScrolledState';

import DappInfo from '../dapps/DappInfo';
import DisconnectDappModal from '../main/modals/DisconnectDappModal';
import AnimatedIconWithPreview from '../ui/AnimatedIconWithPreview';
import Button from '../ui/Button';
import ModalHeader from '../ui/ModalHeader';
import Transition from '../ui/Transition';

import styles from './Settings.module.scss';

interface OwnProps {
  isActive: boolean;
  dapps: ApiDapp[];
  handleBackClick: () => void;
  isInsideModal?: boolean;
}

function SettingsDapps({
  isActive,
  dapps,
  handleBackClick,
  isInsideModal,
}: OwnProps) {
  const lang = useLang();

  const [isDisconnectModalOpen, openDisconnectModal, closeDisconnectModal] = useFlag();
  const [dappToDelete, setDappToDelete] = useState<ApiDapp | undefined>();

  useHistoryBack({
    isActive,
    onBack: handleBackClick,
  });

  const {
    handleScroll: handleContentScroll,
    isScrolled,
  } = useScrolledState();

  const handleDisconnectDapp = useLastCallback((origin: string) => {
    const dapp = dapps.find((d) => d.origin === origin);
    setDappToDelete(dapp);
    openDisconnectModal();
  });

  const handleDisconnectAll = useLastCallback(() => {
    setDappToDelete(undefined);
    openDisconnectModal();
  });

  function renderDapp(dapp: ApiDapp) {
    const {
      iconUrl, name, url, origin,
    } = dapp;

    return (
      <DappInfo
        key={origin}
        iconUrl={iconUrl}
        name={name}
        url={url}
        origin={origin}
        className={styles.dapp}
        onDisconnect={handleDisconnectDapp}
      />
    );
  }

  function renderDapps() {
    const dappList = dapps.map(renderDapp);

    return (
      <>
        <div className={styles.disconnectAllBlock}>
          <Button
            className={styles.disconnectButton}
            isSimple
            onClick={handleDisconnectAll}
          >
            {lang('Disconnect All Dapps')}
          </Button>
          <p className={styles.blockDescription}>{lang('$dapps-description')}</p>
        </div>

        <p className={styles.blockTitle}>{lang('Logged in with MyTonWallet')}</p>

        <div className={styles.block}>
          {dappList}
        </div>
      </>
    );
  }

  function renderEmptyDappsMessage(isPlaying: boolean) {
    return (
      <div className={styles.emptyList}>
        <AnimatedIconWithPreview
          play={isPlaying}
          tgsUrl={ANIMATED_STICKERS_PATHS.noData}
          previewUrl={ANIMATED_STICKERS_PATHS.noDataPreview}
          size={ANIMATED_STICKER_BIG_SIZE_PX}
          noLoop={false}
          nonInteractive
        />
        <p className={styles.emptyListTitle}>{lang('No active connections')}</p>
      </div>
    );
  }

  const content = dapps.length === 0
    ? renderEmptyDappsMessage(isActive)
    : renderDapps();

  return (
    <div className={styles.slide}>
      {isInsideModal ? (
        <ModalHeader
          title={lang('Dapps')}
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
          <span className={styles.headerTitle}>{lang('Dapps')}</span>
        </div>
      )}
      <div
        className={buildClassName(styles.content, 'custom-scroll')}
        onScroll={handleContentScroll}
      >
        <Transition activeKey={dapps.length === 0 ? 0 : 1} name="fade">
          {content}
        </Transition>
      </div>
      <DisconnectDappModal isOpen={isDisconnectModalOpen} onClose={closeDisconnectModal} dapp={dappToDelete} />
    </div>
  );
}

export default memo(SettingsDapps);
