import React, {
  memo, type TeactNode, useEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import { TON_EXPLORER_NAME } from '../../config';
import { selectCurrentAccountState } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import captureKeyboardListeners from '../../util/captureKeyboardListeners';
import { copyTextToClipboard } from '../../util/clipboard';
import { handleOpenUrl } from '../../util/openUrl';
import { shortenAddress } from '../../util/shortenAddress';
import { getTonExplorerAddressUrl } from '../../util/url';

import useFlag from '../../hooks/useFlag';
import useFocusAfterAnimation from '../../hooks/useFocusAfterAnimation';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import DeleteSavedAddressModal from '../main/modals/DeleteSavedAddressModal';
import Button from './Button';
import Input from './Input';
import Modal from './Modal';
import Transition from './Transition';

import styles from './InteractiveTextField.module.scss';
import modalStyles from './Modal.module.scss';

import scamImg from '../../assets/scam.svg';

interface OwnProps {
  address?: string;
  addressName?: string;
  isScam?: boolean;
  text?: string;
  spoiler?: string;
  spoilerRevealText?: string;
  spoilerCallback?: NoneToVoidFunction;
  copyNotification?: string;
  className?: string;
  textClassName?: string;
  noSavedAddress?: boolean;
  noExplorer?: boolean;
}

interface StateProps {
  isAddressAlreadySaved?: boolean;
  isTestnet?: boolean;
}

const SAVED_ADDRESS_NAME_MAX_LENGTH = 255;

function InteractiveTextField({
  address,
  addressName,
  isScam,
  text,
  spoiler,
  spoilerRevealText,
  spoilerCallback,
  copyNotification,
  noSavedAddress,
  noExplorer,
  className,
  textClassName,
  isAddressAlreadySaved,
  isTestnet,
}: OwnProps & StateProps) {
  const { showNotification, addSavedAddress } = getActions();

  // eslint-disable-next-line no-null/no-null
  const addressNameRef = useRef<HTMLInputElement>(null);
  const lang = useLang();
  const [isSaveAddressModalOpen, openSaveAddressModal, closeSaveAddressModal] = useFlag();
  const [isDeleteSavedAddressModalOpen, openDeletedSavedAddressModal, closeDeleteSavedAddressModal] = useFlag();
  const [savedAddressName, setSavedAddressName] = useState<string | undefined>(addressName);
  const [isConcealedWithSpoiler, , revealSpoiler] = useFlag(Boolean(spoiler));

  const addressUrl = getTonExplorerAddressUrl(address, isTestnet);
  const tonExplorerTitle = useMemo(() => {
    return (lang('View Address on %ton_explorer_name%', {
      ton_explorer_name: TON_EXPLORER_NAME,
    }) as TeactNode[]
    ).join('');
  }, [lang]);

  useEffect(() => {
    if (isSaveAddressModalOpen) {
      setSavedAddressName('');
    }
  }, [isSaveAddressModalOpen]);

  const handleSaveAddressSubmit = useLastCallback(() => {
    if (!savedAddressName || !address) {
      return;
    }

    addSavedAddress({ address, name: savedAddressName });
    showNotification({ message: lang('Address was saved!'), icon: 'icon-star' });
    closeSaveAddressModal();
  });

  useEffect(() => (
    isSaveAddressModalOpen
      ? captureKeyboardListeners({
        onEnter: handleSaveAddressSubmit,
      })
      : undefined
  ), [handleSaveAddressSubmit, isSaveAddressModalOpen]);

  useFocusAfterAnimation(addressNameRef, !isSaveAddressModalOpen);

  const handleCopy = useLastCallback(() => {
    if (!copyNotification) return;
    showNotification({ message: copyNotification, icon: 'icon-copy' });
    void copyTextToClipboard(address || text || '');
  });

  const handleRevealSpoiler = useLastCallback(() => {
    revealSpoiler();
    spoilerCallback?.();
  });

  function renderContentOrSpoiler() {
    const content = addressName || address || text;

    if (!spoiler) {
      return renderContent(content);
    }

    const isConcealed = isConcealedWithSpoiler || !content;
    return (
      <Transition activeKey={isConcealed ? 1 : 0} name="fade" className={styles.commentContainer}>
        {isConcealed ? (
          <span className={buildClassName(styles.button, styles.button_spoiler, textClassName)}>
            <i>{spoiler}</i>
            <span
              onClick={handleRevealSpoiler}
              tabIndex={0}
              role="button"
              className={styles.revealSpoiler}
            >
              {spoilerRevealText}
            </span>
          </span>
        ) : renderContent(content)}
      </Transition>
    );
  }

  function renderContent(content?: string) {
    return (
      <span
        className={buildClassName(styles.button, isScam && styles.scam, textClassName)}
        title={lang('Copy')}
        onClick={handleCopy}
        tabIndex={0}
        role="button"
      >
        {isScam && <img src={scamImg} alt={lang('Scam')} className={styles.scamImage} />}
        {content}
        {Boolean(addressName) && (
          <span className={buildClassName(styles.shortAddress, isScam && styles.scam)}>{shortenAddress(address!)}</span>
        )}
        {Boolean(copyNotification) && (
          <i className={buildClassName(styles.icon, 'icon-copy')} aria-hidden />
        )}
      </span>
    );
  }

  function renderSaveAddressModal() {
    return (
      <Modal
        title={lang('Save Address')}
        isCompact
        isOpen={isSaveAddressModalOpen}
        onClose={closeSaveAddressModal}
      >
        <p>{lang('You can save this address for quick access while sending.')}</p>
        <Input
          ref={addressNameRef}
          placeholder={lang('Name')}
          onInput={setSavedAddressName}
          value={savedAddressName}
          maxLength={SAVED_ADDRESS_NAME_MAX_LENGTH}
          className={styles.nameInput}
        />

        <div className={modalStyles.buttons}>
          <Button onClick={closeSaveAddressModal} className={modalStyles.button}>{lang('Cancel')}</Button>
          <Button
            onClick={handleSaveAddressSubmit}
            isPrimary
            isDisabled={!savedAddressName}
            className={modalStyles.button}
          >
            {lang('Save')}
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <>
      <div className={buildClassName(styles.wrapper, className)}>
        {renderContentOrSpoiler()}

        {!isScam && !noSavedAddress && address && (
          <span
            className={styles.button}
            title={lang(isAddressAlreadySaved ? 'Remove From Saved Addresses' : 'Add To Saved Addresses')}
            onClick={isAddressAlreadySaved ? openDeletedSavedAddressModal : openSaveAddressModal}
            tabIndex={0}
            role="button"
          >
            <i
              className={buildClassName(
                styles.icon,
                styles.iconStar,
                isAddressAlreadySaved ? 'icon-star-filled' : 'icon-star',
              )}
              aria-hidden
            />
          </span>
        )}

        {!noExplorer && address && (
          <a
            href={addressUrl}
            className={styles.button}
            title={tonExplorerTitle}
            target="_blank"
            rel="noreferrer noopener"
            onClick={handleOpenUrl}
          >
            <i className={buildClassName(styles.icon, 'icon-tonexplorer-small')} aria-hidden />
          </a>
        )}
      </div>
      {address && (
        <>
          {renderSaveAddressModal()}
          <DeleteSavedAddressModal
            isOpen={isDeleteSavedAddressModalOpen}
            address={address}
            onClose={closeDeleteSavedAddressModal}
          />
        </>
      )}
    </>
  );
}

export default memo(withGlobal<OwnProps>(
  (global, { address }): StateProps => {
    const accountState = selectCurrentAccountState(global);
    const isAddressAlreadySaved = Boolean(address && accountState?.savedAddresses?.[address]);

    return {
      isAddressAlreadySaved,
      isTestnet: global.settings.isTestnet,
    };
  },
)(InteractiveTextField));
