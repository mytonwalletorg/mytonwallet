import type React from '../lib/teact/teact';
import { useMemo, useRef, useState } from '../lib/teact/teact';
import { getActions } from '../global';

import type { ApiChain } from '../api/types';
import type { Account, SavedAddress } from '../global/types';

import { readClipboardContent } from '../util/clipboard';
import { isDnsDomain } from '../util/dns';
import { isValidAddressOrDomain } from '../util/isValidAddressOrDomain';
import { getIsMobileTelegramApp, IS_ANDROID, IS_CLIPBOARDS_SUPPORTED, IS_IOS } from '../util/windowEnvironment';
import useFlag from './useFlag';
import useLang from './useLang';
import useLastCallback from './useLastCallback';
import useQrScannerSupport from './useQrScannerSupport';

import { INPUT_CLEAR_BUTTON_ID } from '../components/transfer/AddressInput';

interface OwnProps {
  value: string;
  chain?: ApiChain;
  callbackDebounceRef?: React.MutableRefObject<boolean>;
  currentAccountId: string;
  accounts?: Record<string, Account>;
  savedAddresses?: SavedAddress[];
  validateAddress: ({ address }: { address?: string }) => void;
  onChange: (address?: string) => void;
  onClose: NoneToVoidFunction;
}

const SAVED_ADDRESS_OPEN_DELAY = 300;

function useAddressInput({
  value,
  chain,
  callbackDebounceRef,
  currentAccountId,
  accounts,
  savedAddresses,
  validateAddress,
  onChange,
  onClose,
}: OwnProps) {
  const {
    showNotification,
    requestOpenQrScanner,
  } = getActions();

  const lang = useLang();
  // eslint-disable-next-line no-null/no-null
  const addressBookTimeoutRef = useRef<number>(null);
  // eslint-disable-next-line no-null/no-null
  const addressInputRef = useRef<HTMLInputElement>(null);

  const [shouldRenderPasteButton, setShouldRenderPasteButton] = useState(IS_CLIPBOARDS_SUPPORTED);
  const [isAddressFocused, markAddressFocused, unmarkAddressFocused] = useFlag();
  const [isAddressBookOpen, openAddressBook, closeAddressBook] = useFlag();
  const [addressForDeletion, setAddressForDeletion] = useState<string | undefined>();
  const [chainForDeletion, setChainForDeletion] = useState<ApiChain | undefined>();
  const isQrScannerSupported = useQrScannerSupport();
  const withPasteButton = shouldRenderPasteButton && !value;
  const isAddressValid = chain ? isValidAddressOrDomain(value, chain) : undefined;
  const hasAddressError = value.length > 0 && !isAddressValid;

  const addressBookAccountIds = useMemo(() => {
    return accounts ? Object.keys(accounts).filter((accountId) => accountId !== currentAccountId) : [];
  }, [currentAccountId, accounts]);
  const shouldUseAddressBook = useMemo(() => {
    return addressBookAccountIds.length > 0 || (savedAddresses && savedAddresses.length > 0);
  }, [addressBookAccountIds.length, savedAddresses]);

  const handleAddressCheck = useLastCallback((address?: string) => {
    if ((address && chain && isValidAddressOrDomain(address, chain)) || !address) {
      validateAddress({ address });
    }
  });

  const handlePasteClick = useLastCallback(async () => {
    try {
      const { type, text } = await readClipboardContent();

      if (type === 'text/plain') {
        if (callbackDebounceRef) {
          callbackDebounceRef.current = true;
        }
        const newToAddress = text.trim();
        onChange(newToAddress);

        handleAddressCheck(newToAddress);
      }
    } catch (err: any) {
      showNotification({ message: lang('Error reading clipboard') });
      setShouldRenderPasteButton(false);
    }
  });

  const handleAddressBookClose = useLastCallback(() => {
    if (!shouldUseAddressBook || !isAddressBookOpen) return;

    closeAddressBook();

    if (addressBookTimeoutRef.current) {
      window.clearTimeout(addressBookTimeoutRef.current);
    }
  });

  const handleAddressFocus = useLastCallback(() => {
    markAddressFocused();

    if (shouldUseAddressBook) {
      // Simultaneous opening of the virtual keyboard and display of Saved Addresses causes animation degradation
      if (IS_ANDROID) {
        addressBookTimeoutRef.current = window.setTimeout(openAddressBook, SAVED_ADDRESS_OPEN_DELAY);
      } else {
        openAddressBook();
      }
    }
  });

  const handleAddressBlur = useLastCallback((e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    unmarkAddressFocused();

    if (e.relatedTarget?.id === INPUT_CLEAR_BUTTON_ID) {
      handleAddressBookClose();
      handleAddressCheck(value);

      return;
    }

    let addressToCheck = value;
    if (isDnsDomain(value) && value !== value.toLowerCase()) {
      addressToCheck = value.toLowerCase().trim();
      onChange(addressToCheck);
    } else if (value !== value.trim()) {
      addressToCheck = value.trim();
      onChange(addressToCheck);
    }

    requestAnimationFrame(() => {
      handleAddressBookClose();
      handleAddressCheck(addressToCheck);
    });
  });

  const handleAddressClear = useLastCallback(() => {
    onChange();
    handleAddressCheck();
  });

  const handleQrScanClick = useLastCallback(() => {
    if (IS_IOS && getIsMobileTelegramApp()) {
      // eslint-disable-next-line no-alert
      alert('Scanning is temporarily not available');
      return;
    }

    requestOpenQrScanner();
    onClose();
  });

  const handleAddressBookItemSelect = useLastCallback((address: string) => {
    if (callbackDebounceRef) {
      callbackDebounceRef.current = true;
    }
    onChange(address);
    closeAddressBook();
  });

  const handleDeleteSavedAddressClick = useLastCallback((address: string) => {
    setAddressForDeletion(address);
    setChainForDeletion(chain);
    closeAddressBook();
  });

  const handleDeleteSavedAddressModalClose = useLastCallback(() => {
    setAddressForDeletion(undefined);
    setChainForDeletion(undefined);
  });

  return {
    isAddressFocused,
    isAddressValid,
    hasAddressError,
    isQrScannerSupported,
    withPasteButton,
    addressInputRef,

    shouldUseAddressBook,
    isAddressBookOpen,
    addressBookAccountIds,
    addressForDeletion,
    chainForDeletion,

    closeAddressBook,
    handlePasteClick,
    handleAddressFocus,
    handleAddressBlur,
    handleAddressClear,
    handleQrScanClick,
    handleAddressBookItemSelect,
    handleDeleteSavedAddressClick,
    handleDeleteSavedAddressModalClose,
  };
}

export default useAddressInput;
