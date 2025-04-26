import React, { memo, useMemo } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type { ApiChain } from '../../api/types';
import type { Account, SavedAddress } from '../../global/types';

import { TONCOIN } from '../../config';
import { selectCurrentAccountState, selectIsMultichainAccount, selectNetworkAccounts } from '../../global/selectors';
import { shortenAddress } from '../../util/shortenAddress';

import useLang from '../../hooks/useLang';

import Menu from '../ui/Menu';
import AddressBookItem from './AddressBookItem';

import styles from './Transfer.module.scss';

interface OwnProps {
  isOpen: boolean;
  isNftTransfer: boolean;
  currentAddress?: string;
  otherAccountIds?: string[];
  onClose: NoneToVoidFunction;
  onAddressSelect: (address: string) => void;
  onSavedAddressDelete: (address: string) => void;
}

interface StateProps {
  savedAddresses?: SavedAddress[];
  accounts?: Record<string, Account>;
  isMultichainAccount?: boolean;
}

function AddressBook({
  isOpen, isNftTransfer, currentAddress = '', otherAccountIds,
  accounts, savedAddresses, isMultichainAccount,
  onAddressSelect, onSavedAddressDelete, onClose,
}: OwnProps & StateProps) {
  const lang = useLang();

  const renderedSavedAddresses = useMemo(() => {
    if (!savedAddresses || savedAddresses.length === 0) {
      return undefined;
    }

    return savedAddresses
      .filter((item) => {
        // NFT transfer is only available on the TON blockchain
        return (!isNftTransfer || item.chain === 'ton') && doesSavedAddressFitSearch(item, currentAddress);
      })
      .map((item) => (
        <AddressBookItem
          key={`saved-${item.address}-${item.chain}`}
          address={item.address}
          name={item.name}
          chain={isMultichainAccount ? item.chain : undefined}
          deleteLabel={lang('Delete')}
          isSavedAddress
          onClick={onAddressSelect}
          onDeleteClick={onSavedAddressDelete}
        />
      ));
  }, [currentAddress, isMultichainAccount, isNftTransfer, lang, onAddressSelect, onSavedAddressDelete, savedAddresses]);

  const renderedOtherAccounts = useMemo(() => {
    if (!otherAccountIds || otherAccountIds.length === 0) return undefined;

    const addressesToBeIgnored = savedAddresses?.map((item) => `${item.chain}:${item.address}`) ?? [];
    const uniqueAddresses = new Set<string>();
    const otherAccounts = otherAccountIds
      .reduce((acc, accountId) => {
        const account = accounts![accountId];

        Object.keys(account.addressByChain).forEach((currentChain) => {
          const address = account.addressByChain[currentChain as ApiChain];
          const key = `${currentChain}:${address}`;
          if (
            address
            && !uniqueAddresses.has(key)
            // NFT transfer is only available on the TON blockchain
            && (!isNftTransfer || currentChain === 'ton')
            && (isMultichainAccount || currentChain === TONCOIN.chain)
            && !addressesToBeIgnored.includes(`${currentChain}:${address}`)
          ) {
            uniqueAddresses.add(key);
            acc.push({
              name: account.title || shortenAddress(address)!,
              address,
              chain: currentChain as ApiChain,
              isHardware: account.type === 'hardware',
            });
          }
        });

        return acc;
      }, [] as (SavedAddress & { isHardware?: boolean })[]);

    return otherAccounts.filter(
      (item) => doesSavedAddressFitSearch(item, currentAddress),
    ).map(({
      address, name, chain: addressChain, isHardware,
    }) => (
      <AddressBookItem
        key={`address-${address}-${addressChain}`}
        address={address}
        name={name}
        chain={isMultichainAccount ? addressChain : undefined}
        isHardware={isHardware}
        onClick={onAddressSelect}
      />
    ));
  }, [otherAccountIds, savedAddresses, accounts, isNftTransfer, isMultichainAccount, currentAddress, onAddressSelect]);

  const shouldRender = Boolean(renderedOtherAccounts?.length || renderedSavedAddresses?.length);

  if (!shouldRender) {
    return undefined;
  }

  return (
    <Menu
      positionX="right"
      type="suggestion"
      noBackdrop
      bubbleClassName={styles.savedAddressBubble}
      isOpen={isOpen}
      onClose={onClose}
    >
      {renderedSavedAddresses}
      {renderedOtherAccounts}
    </Menu>
  );
}

export default memo(withGlobal<OwnProps>((global): StateProps => {
  const accountState = selectCurrentAccountState(global);

  return {
    savedAddresses: accountState?.savedAddresses,
    isMultichainAccount: selectIsMultichainAccount(global, global.currentAccountId!),
    accounts: selectNetworkAccounts(global),
  };
})(AddressBook));

function doesSavedAddressFitSearch(savedAddress: SavedAddress, search: string) {
  const searchQuery = search.toLowerCase();
  const { address, name } = savedAddress;

  return (
    address.toLowerCase().startsWith(searchQuery)
    || address.toLowerCase().endsWith(searchQuery)
    || name.toLowerCase().split(/\s+/).some((part) => part.startsWith(searchQuery))
  );
}
