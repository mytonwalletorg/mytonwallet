import type { TeactNode } from '../../lib/teact/teact';
import React, {
  memo, useEffect, useRef, useState,
} from '../../lib/teact/teact';
import { getActions } from '../../global';

import { SwapState, SwapType, type UserSwapToken } from '../../global/types';

import { ANIMATED_STICKER_BIG_SIZE_PX, IS_FIREFOX_EXTENSION } from '../../config';
import buildClassName from '../../util/buildClassName';
import { vibrate } from '../../util/capacitor';
import { readClipboardContent } from '../../util/clipboard';
import { shortenAddress } from '../../util/shortenAddress';
import getBlockchainNetworkName from '../../util/swap/getBlockchainNetworkName';
import { IS_FIREFOX } from '../../util/windowEnvironment';
import { callApi } from '../../api';
import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';

import { useDeviceScreen } from '../../hooks/useDeviceScreen';
import useFlag from '../../hooks/useFlag';
import useHistoryBack from '../../hooks/useHistoryBack';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useQrScannerSupport from '../../hooks/useQrScannerSupport';

import AnimatedIconWithPreview from '../ui/AnimatedIconWithPreview';
import Button from '../ui/Button';
import Input from '../ui/Input';
import ModalHeader from '../ui/ModalHeader';
import Transition from '../ui/Transition';

import modalStyles from '../ui/Modal.module.scss';
import styles from './Swap.module.scss';

interface OwnProps {
  isActive: boolean;
  swapType?: SwapType;
  toAddress?: string;
  tokenIn?: UserSwapToken;
  tokenOut?: UserSwapToken;
}

const SHORT_ADDRESS_SHIFT = 14;
const MIN_ADDRESS_LENGTH_TO_SHORTEN = SHORT_ADDRESS_SHIFT * 2;

function SwapBlockchain({
  isActive,
  swapType,
  toAddress = '',
  tokenIn,
  tokenOut,
}: OwnProps) {
  const {
    cancelSwap, setSwapCexAddress,
    showNotification, setSwapScreen,
    requestOpenQrScanner,
  } = getActions();
  const lang = useLang();
  const { isPortrait } = useDeviceScreen();

  // eslint-disable-next-line no-null/no-null
  const toAddressRef = useRef<HTMLInputElement>(null);

  // Note: As of 27-11-2023, Firefox does not support readText()
  const [shouldRenderPasteButton, setShouldRenderPasteButton] = useState(!(IS_FIREFOX || IS_FIREFOX_EXTENSION));
  const [isAddressFocused, markAddressFocused, unmarkAddressFocused] = useFlag();
  const [hasToAddressError, setHasToAddressError] = useState(false);
  const [canContinue, setCanContinue] = useState(swapType !== SwapType.CrosschainFromToncoin);

  const isQrScannerSupported = useQrScannerSupport();

  const withPasteButton = shouldRenderPasteButton && toAddress === '';

  const toAddressShort = toAddress.length > MIN_ADDRESS_LENGTH_TO_SHORTEN
    ? shortenAddress(toAddress, SHORT_ADDRESS_SHIFT) || ''
    : toAddress;

  const handleCancelClick = useLastCallback(() => {
    setHasToAddressError(false);
    setCanContinue(false);
    setSwapScreen({ state: isPortrait ? SwapState.Initial : SwapState.None });
  });

  useHistoryBack({
    isActive,
    onBack: handleCancelClick,
  });

  const handleAddressFocus = useLastCallback(() => {
    const el = toAddressRef.current!;

    // `selectionStart` is only updated in the next frame after `focus` event
    requestAnimationFrame(() => {
      const caretPosition = el.selectionStart!;
      markAddressFocused();

      // Restore caret position after input field value has been focused and expanded
      requestAnimationFrame(() => {
        const newCaretPosition = caretPosition <= SHORT_ADDRESS_SHIFT + 3
          ? caretPosition
          : Math.max(0, el.value.length - (toAddressShort.length - caretPosition));

        el.setSelectionRange(newCaretPosition, newCaretPosition);
        if (newCaretPosition > SHORT_ADDRESS_SHIFT * 2) {
          el.scrollLeft = el.scrollWidth - el.clientWidth;
        }
      });
    });
  });

  const validateToAddress = useLastCallback(async (address: string) => {
    if (!address.length) {
      setHasToAddressError(false);
      setCanContinue(false);
      return;
    }

    const response = await callApi('swapCexValidateAddress', {
      slug: tokenOut?.slug!,
      address,
    });

    if (!response) {
      setHasToAddressError(false);
      setCanContinue(false);
      return;
    }

    setHasToAddressError(!response.result);
    setCanContinue(response.result);
  });

  const handleAddressBlur = useLastCallback(() => {
    unmarkAddressFocused();
  });

  const handleAddressInput = useLastCallback((newToAddress: string) => {
    setSwapCexAddress({ toAddress: newToAddress.trim() });
  });

  const handlePasteClick = useLastCallback(async () => {
    try {
      const { type, text } = await readClipboardContent();

      if (type === 'text/plain') {
        setSwapCexAddress({ toAddress: text.trim() });
        validateToAddress(text.trim());
      }
    } catch (error) {
      showNotification({
        message: lang('Error reading clipboard'),
      });
      setShouldRenderPasteButton(false);
    }
  });

  useEffect(() => {
    validateToAddress(toAddress);
  }, [toAddress, validateToAddress]);

  const submitPassword = useLastCallback(() => {
    vibrate();
    setSwapScreen({ state: SwapState.Password });
  });

  const handleQrScanClick = useLastCallback(() => {
    requestOpenQrScanner();
    cancelSwap();
  });

  function renderInfo() {
    const text = hasToAddressError
      ? lang('Incorrect address.')
      : lang('Please provide an address of your wallet in %blockchain% blockchain to receive bought tokens.', {
        blockchain: getBlockchainNetworkName(tokenOut?.blockchain),
      });

    return (
      <Transition
        name="fade"
        activeKey={hasToAddressError ? 0 : 1}
        slideClassName={styles.blockchainHintWrapper}
      >
        <span className={buildClassName(
          styles.blockchainHintText,
          hasToAddressError && styles.blockchainHintTextError,
        )}
        >
          {text}
        </span>
      </Transition>
    );
  }

  function renderInputAddress() {
    if (swapType !== SwapType.CrosschainFromToncoin) return undefined;

    return (
      <>
        <div className={styles.inputAddress}>
          <Input
            ref={toAddressRef}
            isRequired
            placeholder={lang('Your address on another blockchain')}
            value={isAddressFocused ? toAddress : toAddressShort}
            onInput={handleAddressInput}
            onFocus={handleAddressFocus}
            onBlur={handleAddressBlur}
            wrapperClassName={styles.inputAddressWrapper}
          >
            {isQrScannerSupported && (
              <Button
                isSimple
                className={buildClassName(styles.inputButton, withPasteButton && styles.inputButtonShifted)}
                onClick={handleQrScanClick}
                ariaLabel={lang('Scan QR Code')}
              >
                <i className="icon-qr-scanner-alt" aria-hidden />
              </Button>
            )}
            {withPasteButton && (
              <Button isSimple className={styles.inputButton} onClick={handlePasteClick} ariaLabel={lang('Paste')}>
                <i className="icon-paste" aria-hidden />
              </Button>
            )}
          </Input>
        </div>
        {renderInfo()}
      </>
    );
  }

  const title = (lang('$swap_from_to', {
    from: tokenIn?.symbol,
    to: tokenOut?.symbol,
  }) as TeactNode[]).join('');

  return (
    <>
      <ModalHeader title={title} onClose={cancelSwap} />
      <div className={buildClassName(styles.scrollContent, styles.selectBlockchainBlock, 'custom-scroll')}>
        <AnimatedIconWithPreview
          play={isActive}
          noLoop={false}
          nonInteractive
          tgsUrl={ANIMATED_STICKERS_PATHS.bill}
          previewUrl={ANIMATED_STICKERS_PATHS.billPreview}
          size={ANIMATED_STICKER_BIG_SIZE_PX}
        />

        {renderInputAddress()}

        <div className={buildClassName(styles.blockchainButtons, modalStyles.footerButtons)}>
          <Button onClick={handleCancelClick} className={modalStyles.buttonHalfWidth}>{lang('Close')}</Button>
          <Button
            isPrimary
            isDisabled={!canContinue}
            className={modalStyles.buttonHalfWidth}
            onClick={submitPassword}
          >
            {lang('Continue')}
          </Button>
        </div>
      </div>
    </>
  );
}

export default memo(SwapBlockchain);
