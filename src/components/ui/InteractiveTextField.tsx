import React, {
  memo, useEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiChain } from '../../api/types';
import type { IAnchorPosition, SavedAddress } from '../../global/types';
import type { DropdownItem } from './Dropdown';

import { selectCurrentAccountState, selectIsMultichainAccount } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import captureKeyboardListeners from '../../util/captureKeyboardListeners';
import { copyTextToClipboard } from '../../util/clipboard';
import { stopEvent } from '../../util/domEvents';
import { handleOpenUrl, openUrl } from '../../util/openUrl';
import { shortenAddress } from '../../util/shortenAddress';
import { getExplorerAddressUrl, getExplorerName, getHostnameFromUrl } from '../../util/url';
import { IS_TOUCH_ENV } from '../../util/windowEnvironment';

import useFlag from '../../hooks/useFlag';
import useFocusAfterAnimation from '../../hooks/useFocusAfterAnimation';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useLongPress from '../../hooks/useLongPress';

import DeleteSavedAddressModal from '../main/modals/DeleteSavedAddressModal';
import Button from './Button';
import DropdownMenu from './DropdownMenu';
import Input from './Input';
import Modal from './Modal';
import Transition from './Transition';

import styles from './InteractiveTextField.module.scss';
import modalStyles from './Modal.module.scss';

import scamImg from '../../assets/scam.svg';

interface OwnProps {
  chain?: ApiChain;
  address?: string;
  addressName?: string;
  addressUrl?: string;
  isScam?: boolean;
  isTransaction?: boolean;
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
  savedAddresses?: SavedAddress[];
  isMultichainAccount?: boolean;
  isTestnet?: boolean;
}

type MenuHandler = 'copy' | 'addressBook' | 'explorer';

const SAVED_ADDRESS_NAME_MAX_LENGTH = 255;
const MENU_VERTICAL_OFFSET_PX = -16;

function InteractiveTextField({
  chain,
  address,
  addressName,
  addressUrl,
  isScam,
  isTransaction,
  text,
  spoiler,
  spoilerRevealText,
  spoilerCallback,
  copyNotification,
  noSavedAddress,
  noExplorer,
  className,
  textClassName,
  savedAddresses,
  isTestnet,
  isMultichainAccount,
}: OwnProps & StateProps) {
  const { showNotification, addSavedAddress } = getActions();

  // eslint-disable-next-line no-null/no-null
  const addressNameRef = useRef<HTMLInputElement>(null);
  const lang = useLang();
  const [isSaveAddressModalOpen, openSaveAddressModal, closeSaveAddressModal] = useFlag();
  const [isDeleteSavedAddressModalOpen, openDeletedSavedAddressModal, closeDeleteSavedAddressModal] = useFlag();
  const [savedAddressName, setSavedAddressName] = useState<string | undefined>(addressName);
  const [isConcealedWithSpoiler, , revealSpoiler] = useFlag(Boolean(spoiler));
  const isAddressAlreadySaved = useMemo(() => {
    return Boolean(address && chain && (savedAddresses || []).find((savedAddress) => {
      return savedAddress.address === address && savedAddress.chain === chain;
    }));
  }, [address, chain, savedAddresses]);

  addressUrl = addressUrl ?? (chain ? getExplorerAddressUrl(chain, address, isTestnet) : undefined);
  const saveAddressTitle = lang(isAddressAlreadySaved ? 'Remove From Saved' : 'Save Address');
  const explorerTitle = lang('View on Explorer');
  const withSavedAddresses = Boolean(!isScam && !noSavedAddress && address);
  const withExplorer = Boolean(!noExplorer && addressUrl);

  useEffect(() => {
    if (isSaveAddressModalOpen) {
      setSavedAddressName('');
    }
  }, [isSaveAddressModalOpen]);

  const handleSaveAddressSubmit = useLastCallback(() => {
    if (!savedAddressName || !address || !chain) {
      return;
    }

    addSavedAddress({ address, chain, name: savedAddressName });
    showNotification({ message: lang('Address was saved!'), icon: 'icon-star' });
    closeSaveAddressModal();
  });

  useEffect(() => (
    isSaveAddressModalOpen
      ? captureKeyboardListeners({ onEnter: handleSaveAddressSubmit })
      : undefined
  ), [handleSaveAddressSubmit, isSaveAddressModalOpen]);

  useFocusAfterAnimation(addressNameRef, !isSaveAddressModalOpen);

  const handleCopy = useLastCallback(() => {
    if (!copyNotification) return;
    showNotification({ message: copyNotification, icon: 'icon-copy' });
    void copyTextToClipboard(address || text || '');
  });

  const handleTonExplorerOpen = useLastCallback(() => {
    void openUrl(addressUrl!, { title: getExplorerName(chain!), subtitle: getHostnameFromUrl(addressUrl!) });
  });

  const {
    menuPosition,
    isActionsMenuOpen,
    menuItems,
    handleMenuShow,
    handleMenuItemSelect,
    closeActionsMenu,
  } = useDropdownMenu({
    copy: handleCopy,
    addressBook: isAddressAlreadySaved ? openDeletedSavedAddressModal : openSaveAddressModal,
    explorer: handleTonExplorerOpen,
  }, {
    isAddressAlreadySaved,
    isWalletAddress: Boolean(address && chain && noSavedAddress && !isTransaction),
    isTransaction,
    withSavedAddresses,
    withExplorer,
  });

  const shouldUseMenu = !spoiler && IS_TOUCH_ENV && menuItems.length > 1;

  const longPressHandlers = useLongPress({
    onClick: handleMenuShow,
    onStart: handleCopy,
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
        tabIndex={0}
        role="button"
        title={!shouldUseMenu ? lang('Copy') : undefined}
        onClick={!shouldUseMenu ? handleCopy : undefined}
      >
        {isScam && <img src={scamImg} alt={lang('Scam')} className={styles.scamImage} />}
        {isMultichainAccount && (
          <i className={buildClassName(styles.chainIcon, `icon-chain-${chain}`)} aria-label={chain} />
        )}
        {content}
        {Boolean(addressName) && (
          <span className={buildClassName(styles.shortAddress, isScam && styles.scam)}>{shortenAddress(address!)}</span>
        )}
        {Boolean(copyNotification) && !shouldUseMenu && (
          <i className={buildClassName(styles.icon, 'icon-copy')} aria-hidden />
        )}
      </span>
    );
  }

  function renderActions() {
    if (shouldUseMenu) {
      const iconClassName = buildClassName(
        styles.icon,
        styles.iconCaretDown,
        'icon-caret-down',
        !addressName && styles.iconBlack,
        isScam && styles.scam,
      );

      return (
        <>
          <i className={iconClassName} aria-hidden />
          <DropdownMenu
            withPortal
            shouldTranslateOptions
            isOpen={isActionsMenuOpen}
            items={menuItems}
            anchorPosition={menuPosition}
            bubbleClassName={styles.menu}
            buttonClassName={styles.menuItem}
            fontIconClassName={styles.menuIcon}
            onSelect={handleMenuItemSelect}
            onClose={closeActionsMenu}
          />
        </>
      );
    }

    return (
      <>
        {withSavedAddresses && (
          <span
            className={styles.button}
            title={saveAddressTitle}
            aria-label={saveAddressTitle}
            tabIndex={0}
            role="button"
            onClick={isAddressAlreadySaved ? openDeletedSavedAddressModal : openSaveAddressModal}
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

        {withExplorer && (
          <a
            href={addressUrl}
            className={styles.button}
            title={explorerTitle}
            aria-label={explorerTitle}
            target="_blank"
            rel="noreferrer noopener"
            onClick={handleOpenUrl}
          >
            <i className={buildClassName(styles.icon, 'icon-tonexplorer-small')} aria-hidden />
          </a>
        )}
      </>
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
      <div
        className={buildClassName(styles.wrapper, className)}
        /* eslint-disable-next-line react/jsx-props-no-spreading */
        {...(shouldUseMenu && !isActionsMenuOpen && {
          ...longPressHandlers,
          tabIndex: 0,
          role: 'button',
        })}
        onContextMenu={shouldUseMenu ? stopEvent : undefined}
      >
        {renderContentOrSpoiler()}
        {renderActions()}
      </div>

      {address && (
        <>
          {renderSaveAddressModal()}
          <DeleteSavedAddressModal
            isOpen={isDeleteSavedAddressModalOpen}
            address={address}
            chain={chain}
            onClose={closeDeleteSavedAddressModal}
          />
        </>
      )}
    </>
  );
}

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const accountState = selectCurrentAccountState(global);

    return {
      savedAddresses: accountState?.savedAddresses,
      isMultichainAccount: selectIsMultichainAccount(global, global.currentAccountId!),
      isTestnet: global.settings.isTestnet,
    };
  },
)(InteractiveTextField));

function useDropdownMenu(
  menuHandlers: Record<MenuHandler, NoneToVoidFunction>,
  options: {
    withSavedAddresses?: boolean;
    withExplorer?: boolean;
    isAddressAlreadySaved?: boolean;
    isWalletAddress?: boolean;
    isTransaction?: boolean;
  },
) {
  const [menuPosition, setMenuPosition] = useState<IAnchorPosition | undefined>();
  const closeActionsMenu = useLastCallback(() => setMenuPosition(undefined));
  const isActionsMenuOpen = Boolean(menuPosition);

  const menuItems = useMemo<DropdownItem[]>(() => {
    const {
      isAddressAlreadySaved, isWalletAddress, isTransaction, withSavedAddresses, withExplorer,
    } = options;

    const items: DropdownItem[] = [{
      name: withSavedAddresses || isWalletAddress
        ? 'Copy Address'
        : (isTransaction ? 'Copy Transaction ID' : 'Copy'),
      fontIcon: 'copy',
      withSeparator: true,
      value: 'copy',
    }];

    if (withSavedAddresses) {
      items.push({
        name: isAddressAlreadySaved ? 'Remove From Saved' : 'Save Address',
        fontIcon: isAddressAlreadySaved ? 'star-filled' : 'star',
        withSeparator: true,
        value: 'addressBook',
      });
    }

    if (withExplorer) {
      items.push({
        name: 'View on Explorer',
        fontIcon: 'tonexplorer',
        withSeparator: true,
        value: 'explorer',
      });
    }

    return items;
  }, [options]);

  const handleMenuItemSelect = useLastCallback((value: string) => {
    menuHandlers[value as MenuHandler]?.();
    closeActionsMenu();
  });

  const handleMenuShow = useLastCallback((e: React.MouseEvent | React.TouchEvent) => {
    stopEvent(e);

    let x: number;
    if (e.type.startsWith('touch')) {
      const { changedTouches, touches } = (e as React.TouchEvent);
      if (touches.length > 0) {
        x = touches[0].clientX;
      } else {
        x = changedTouches[0].clientX;
      }
    } else {
      x = (e as React.MouseEvent).clientX;
    }
    const { bottom } = e.currentTarget.getBoundingClientRect();

    setMenuPosition({ x, y: bottom + MENU_VERTICAL_OFFSET_PX });
  });

  return {
    isActionsMenuOpen,
    menuPosition,
    menuItems,
    handleMenuShow,
    handleMenuItemSelect,
    closeActionsMenu,
  };
}
