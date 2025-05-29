import type { FocusEvent } from 'react';
import React, { memo, useMemo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import { shortenAddress } from '../../util/shortenAddress';

import useLang from '../../hooks/useLang';

import Button from '../ui/Button';
import Input from '../ui/Input';
import Transition from '../ui/Transition';

import styles from './AddressInput.module.scss';

export const INPUT_CLEAR_BUTTON_ID = 'input-clear-button';

interface OwnProps {
  label: string;
  value: string;
  error?: string;
  isStatic?: boolean;
  isFocused: boolean;
  isQrScannerSupported: boolean;
  withPasteButton: boolean;
  address: string;
  addressName: string;
  inputRef: React.RefObject<HTMLInputElement>;
  onInput: (value: string) => void;
  onFocus: () => void;
  onBlur: (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onClearClick: () => void;
  onQrScanClick?: () => void;
  onPasteClick?: () => void;
}

const SHORT_ADDRESS_SHIFT = 4;
const SHORT_SINGLE_ADDRESS_SHIFT = 11;
const MIN_ADDRESS_LENGTH_TO_SHORTEN = SHORT_SINGLE_ADDRESS_SHIFT * 2;

function AddressInput({
  label,
  value,
  error,
  isStatic,
  isFocused,
  isQrScannerSupported,
  withPasteButton,
  address,
  addressName,
  inputRef,
  onInput,
  onFocus,
  onBlur,
  onClearClick,
  onQrScanClick,
  onPasteClick,
}: OwnProps) {
  const lang = useLang();
  const withQrButton = onQrScanClick && isQrScannerSupported;
  const withButton = withQrButton || withPasteButton || !!value.length;

  const addressOverlay = useMemo(() => {
    if (!address) return undefined;

    const addressShort = !addressName && address.length > MIN_ADDRESS_LENGTH_TO_SHORTEN
      ? shortenAddress(address, SHORT_SINGLE_ADDRESS_SHIFT) || ''
      : address;

    return (
      <>
        {addressName && <span className={styles.addressName}>{addressName}</span>}
        <span className={buildClassName(styles.addressValue, !addressName && styles.addressValueSingle)}>
          {addressName ? shortenAddress(address, SHORT_ADDRESS_SHIFT) : addressShort}
        </span>
      </>
    );
  }, [addressName, address]);

  function renderInputActions() {
    const wrapperClassName = buildClassName(
      styles.inputButtonWrapper,
      isFocused && styles.inputButtonWrapperWithFocus,
    );

    return (
      <Transition className={styles.inputButtonTransition} activeKey={value.length ? 0 : 1} name="fade">
        {value.length ? (
          <div className={wrapperClassName}>
            <Button
              isSimple
              id={INPUT_CLEAR_BUTTON_ID}
              className={buildClassName(styles.inputButton, styles.inputButtonClear)}
              onClick={onClearClick}
              ariaLabel={lang('Clear')}
            >
              <i className="icon-close-filled" aria-hidden />
            </Button>
          </div>
        ) : (
          <div className={wrapperClassName}>
            {withQrButton && (
              <Button
                isSimple
                className={styles.inputButton}
                onClick={onQrScanClick}
                ariaLabel={lang('Scan QR Code')}
              >
                <i className="icon-qr-scanner-alt" aria-hidden />
              </Button>
            )}
            {withPasteButton && (
              <Button isSimple className={styles.inputButton} onClick={onPasteClick} ariaLabel={lang('Paste')}>
                <i className="icon-paste" aria-hidden />
              </Button>
            )}
          </div>
        )}
      </Transition>
    );
  }

  return (
    <Input
      ref={inputRef}
      className={buildClassName(isStatic && styles.inputStatic, withButton && styles.inputWithIcon)}
      isRequired
      isStatic={isStatic}
      label={label}
      placeholder={lang('Wallet address or domain')}
      value={value}
      error={error}
      autoCorrect={false}
      valueOverlay={!error ? addressOverlay : undefined}
      onInput={onInput}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      {renderInputActions()}
    </Input>
  );
}

export default memo(AddressInput);
