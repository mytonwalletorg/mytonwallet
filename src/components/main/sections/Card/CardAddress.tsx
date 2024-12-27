import React, { memo, type TeactNode, useMemo } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiChain } from '../../../../api/types';
import type { Account } from '../../../../global/types';

import { selectAccount } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { copyTextToClipboard } from '../../../../util/clipboard';
import { openUrl } from '../../../../util/openUrl';
import { shortenAddress } from '../../../../util/shortenAddress';
import getChainNetworkIcon from '../../../../util/swap/getChainNetworkIcon';
import { getExplorerAddressUrl, getExplorerName } from '../../../../util/url';

import useFlag from '../../../../hooks/useFlag';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import Menu from '../../../ui/Menu';

import menuStyles from '../../../ui/Dropdown.module.scss';
import styles from './Card.module.scss';

interface StateProps {
  addressByChain?: Account['addressByChain'];
  isTestnet?: boolean;
  isHardwareAccount?: boolean;
  withTextGradient?: boolean;
}

function CardAddress({
  addressByChain, isTestnet, isHardwareAccount, withTextGradient,
}: StateProps) {
  const { showNotification } = getActions();

  const lang = useLang();
  const [isMenuOpen, openMenu, closeMenu] = useFlag(false);
  const chains = useMemo(() => Object.keys(addressByChain || {}) as ApiChain[], [addressByChain]);
  const explorerTitle = useMemo(() => {
    return chains.length !== 1
      ? undefined
      : (lang('View address on %ton_explorer_name%', {
        ton_explorer_name: getExplorerName(chains[0]),
      }) as TeactNode[]
      ).join('');
  }, [chains, lang]);
  const chainDropdownItems = useMemo(() => {
    if (chains.length < 2) return undefined;

    return chains.map((key) => ({
      value: addressByChain![key],
      name: shortenAddress(addressByChain![key])!,
      icon: getChainNetworkIcon(key),
      fontIcon: 'copy',
      chain: key,
      label: (lang('View address on %ton_explorer_name%', {
        ton_explorer_name: getExplorerName(key),
      }) as TeactNode[]
      ).join(''),
    }));
  }, [addressByChain, chains, lang]);

  const handleCopyAddress = useLastCallback((address: string) => {
    showNotification({ message: lang('Address was copied!') as string, icon: 'icon-copy' });
    void copyTextToClipboard(address);
  });

  const handleItemClick = useLastCallback((e: React.MouseEvent, address: string) => {
    handleCopyAddress(address);
    closeMenu();
  });

  const handleExplorerClick = useLastCallback((e: React.MouseEvent, chain: ApiChain, address: string) => {
    openUrl(getExplorerAddressUrl(chain, address, isTestnet)!);
    closeMenu();
  });

  function renderAddressMenu() {
    return (
      <Menu
        isOpen={isMenuOpen}
        type="dropdown"
        onClose={closeMenu}
      >
        {chainDropdownItems!.map((item, index) => {
          const fullButtonClassName = buildClassName(
            menuStyles.button,
            index > 0 && menuStyles.separator,
            styles.menuItem,
          );

          return (
            <div key={item.value} className={fullButtonClassName}>
              <img src={item.icon} alt="" className={buildClassName('icon', menuStyles.itemIcon, styles.menuIcon)} />
              <span
                className={buildClassName(menuStyles.itemName, styles.menuItemName)}
                tabIndex={0}
                role="button"
                onClick={(e) => handleItemClick(e, item.value)}
              >
                {item.name}
                <i
                  className={buildClassName(`icon icon-${item.fontIcon}`, menuStyles.fontIcon, styles.menuFontIcon)}
                  aria-hidden
                />
              </span>
              <i
                tabIndex={0}
                role="button"
                className={buildClassName(menuStyles.close, 'icon icon-tonexplorer-small', styles.menuExplorerIcon)}
                aria-label={item.label}
                onClick={(e) => handleExplorerClick(e, item.chain, item.value)}
              />
            </div>
          );
        })}
      </Menu>
    );
  }

  if (chainDropdownItems) {
    return (
      <div className={styles.addressContainer}>
        <button
          type="button"
          className={buildClassName(styles.address, withTextGradient && 'gradientText')}
          onClick={() => openMenu()}
        >
          <span className={buildClassName(styles.itemName, 'itemName')}>
            {lang('Multichain')}
          </span>
          <i className={buildClassName(styles.icon, 'icon-caret-down')} aria-hidden />
        </button>
        {renderAddressMenu()}
      </div>
    );
  }

  const chain = chains[0];
  if (!chain) return undefined;

  return (
    <div className={styles.addressContainer}>
      {isHardwareAccount && <i className={buildClassName(styles.icon, 'icon-ledger')} aria-hidden />}
      <button
        type="button"
        className={buildClassName(styles.address, withTextGradient && 'gradientText')}
        aria-label={lang('Copy wallet address')}
        onClick={() => handleCopyAddress(addressByChain![chain])}
      >
        {shortenAddress(addressByChain![chain])}
        <i className={buildClassName(styles.icon, 'icon-copy')} aria-hidden />
      </button>
      <a
        href={getExplorerAddressUrl(chain, addressByChain![chain], isTestnet)}
        className={styles.explorerButton}
        title={explorerTitle}
        aria-label={explorerTitle}
        target="_blank"
        rel="noreferrer noopener"
      >
        <i className={buildClassName(styles.icon, 'icon-tonexplorer-small')} aria-hidden />
      </a>
    </div>
  );
}

export default memo(withGlobal((global): StateProps => {
  const { addressByChain, isHardware } = selectAccount(global, global.currentAccountId!) || {};

  return {
    addressByChain,
    isTestnet: global.settings.isTestnet,
    isHardwareAccount: isHardware,
  };
})(CardAddress));
