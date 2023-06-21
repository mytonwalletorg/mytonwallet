import React, { memo, useCallback, useState } from '../../lib/teact/teact';

import type { ApiDapp } from '../../api/types';

import { ANIMATED_STICKER_BIG_SIZE_PX } from '../../config';
import buildClassName from '../../util/buildClassName';
import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';

import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';

import DappInfo from '../dapps/DappInfo';
import DisconnectDappModal from '../main/modals/DisconnectDappModal';
import AnimatedIconWithPreview from '../ui/AnimatedIconWithPreview';
import Button from '../ui/Button';
import ModalHeader from '../ui/ModalHeader';

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

  const handleDisconnectDapp = useCallback((origin: string) => {
    const dapp = dapps.find((d) => d.origin === origin);
    setDappToDelete(dapp);
    openDisconnectModal();
  }, [openDisconnectModal, dapps]);

  const handleDisconnectAll = useCallback(() => {
    setDappToDelete(undefined);
    openDisconnectModal();
  }, [openDisconnectModal]);

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
      <div className={buildClassName(styles.slide, 'custom-scroll')}>
        <div>
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
      </div>
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
          className={styles.sticker}
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
    <div className={buildClassName(styles.slide, 'custom-scroll')}>
      {isInsideModal ? (
        <ModalHeader title={lang('Dapps')} onBackButtonClick={handleBackClick} />
      ) : (
        <div className={styles.header}>
          <Button isSimple isText onClick={handleBackClick} className={styles.headerBack}>
            <i className={buildClassName(styles.iconChevron, 'icon-chevron-left')} aria-hidden />
            <span>{lang('Back')}</span>
          </Button>
          <span className={styles.headerTitle}>{lang('Dapps')}</span>
        </div>
      )}
      <div className={styles.content}>
        {content}
      </div>
      <DisconnectDappModal isOpen={isDisconnectModalOpen} onClose={closeDisconnectModal} dapp={dappToDelete} />
    </div>
  );
}

export default memo(SettingsDapps);
