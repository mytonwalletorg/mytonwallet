import type { TeactNode } from '../../lib/teact/teact';
import React, { memo, useMemo } from '../../lib/teact/teact';

import type { UserToken } from '../../global/types';
import type { DropdownItem } from '../ui/Dropdown';

import { toDecimal } from '../../util/decimals';
import getChainNetworkIcon from '../../util/swap/getChainNetworkIcon';
import { ASSET_LOGO_PATHS } from '../ui/helpers/assetLogos';

import useLang from '../../hooks/useLang';

import AmountFieldMaxButton from '../ui/AmountFieldMaxButton';
import Dropdown from '../ui/Dropdown';
import RichNumberInput from '../ui/RichNumberInput';

import styles from './Transfer.module.scss';

interface OwnProps {
  amount?: bigint;
  decimals: number;
  maxAmount?: bigint;
  token: UserToken | undefined;
  allTokens: UserToken[] | undefined;
  tokenSlug: string;
  isStatic?: boolean;
  hasAmountError: boolean;
  isMultichainAccount: boolean;
  isSensitiveDataHidden?: true;
  shouldRenderCurrency: boolean;
  currencyValue: TeactNode;
  bottomRightElement: TeactNode;
  onChange: (value?: string) => void;
  onTokenChange: (slug: string) => void;
  onMaxClick: () => void;
  onPressEnter: (e: React.KeyboardEvent<HTMLDivElement>) => void;
}

function AmountInputSection({
  amount,
  decimals,
  maxAmount,
  token,
  allTokens,
  tokenSlug,
  isStatic,
  hasAmountError,
  isMultichainAccount,
  isSensitiveDataHidden,
  shouldRenderCurrency,
  currencyValue,
  bottomRightElement,
  onChange,
  onTokenChange,
  onMaxClick,
  onPressEnter,
}: OwnProps) {
  const lang = useLang();

  const dropDownItems = useMemo(() => {
    if (!allTokens) {
      return [];
    }

    return allTokens.reduce<DropdownItem[]>((acc, currentToken) => {
      if (
        currentToken.type !== 'lp_token'
        || (currentToken.amount > 0 && !currentToken.isDisabled)
        || currentToken.slug === tokenSlug
      ) {
        acc.push({
          value: currentToken.slug,
          icon: ASSET_LOGO_PATHS[currentToken.symbol.toLowerCase() as keyof typeof ASSET_LOGO_PATHS]
            || currentToken.image,
          overlayIcon: isMultichainAccount ? getChainNetworkIcon(currentToken.chain) : undefined,
          name: currentToken.symbol,
        });
      }

      return acc;
    }, []);
  }, [isMultichainAccount, tokenSlug, allTokens]);

  function renderBalance() {
    return (
      <AmountFieldMaxButton
        maxAmount={maxAmount}
        token={token}
        isLoading={maxAmount === undefined}
        isSensitiveDataHidden={isSensitiveDataHidden}
        onAmountClick={onMaxClick}
      />
    );
  }

  function renderTokens() {
    return (
      <Dropdown
        items={dropDownItems}
        selectedValue={tokenSlug}
        className={styles.tokenDropdown}
        itemClassName={styles.tokenDropdownItem}
        onChange={onTokenChange}
      />
    );
  }

  return (
    <>
      {renderBalance()}
      <RichNumberInput
        key="amount"
        id="amount"
        hasError={hasAmountError}
        value={amount === undefined ? undefined : toDecimal(amount, decimals)}
        labelText={lang('Amount')}
        onChange={onChange}
        onPressEnter={onPressEnter}
        decimals={decimals}
        className={styles.amountInput}
        inputClassName={isStatic ? styles.inputRichStatic : undefined}
      >
        {renderTokens()}
      </RichNumberInput>

      <div className={styles.amountBottomWrapper}>
        <div className={styles.amountBottom}>
          {shouldRenderCurrency && currencyValue}
          {bottomRightElement}
        </div>
      </div>
    </>
  );
}

export default memo(AmountInputSection);
