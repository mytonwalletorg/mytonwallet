import React, { memo, useMemo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiToken, ApiVestingInfo } from '../../api/types';
import type { UserToken } from '../../global/types';

import {
  CLAIM_AMOUNT,
  TON_SYMBOL,
  TONCOIN_SLUG,
} from '../../config';
import renderText from '../../global/helpers/renderText';
import {
  selectAccount,
  selectCurrentAccountState,
  selectCurrentAccountTokens,
  selectMycoin,
} from '../../global/selectors';
import { toBig } from '../../util/decimals';
import { formatCurrency } from '../../util/formatNumber';
import { shortenAddress } from '../../util/shortenAddress';
import { calcVestingAmountByStatus } from '../main/helpers/calcVestingAmountByStatus';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Modal from '../ui/Modal';
import PasswordForm from '../ui/PasswordForm';

import styles from './VestingModal.module.scss';

interface StateProps {
  isOpen?: boolean;
  tokens?: UserToken[];
  vesting?: ApiVestingInfo[];
  isLoading?: boolean;
  address?: string;
  error?: string;
  mycoin?: ApiToken;
}
function VestingPasswordModal({
  isOpen, vesting, tokens, isLoading, address, error, mycoin,
}: StateProps) {
  const { submitClaimingVesting, cancelClaimingVesting, clearVestingError } = getActions();

  const lang = useLang();
  const {
    amount: balance,
  } = useMemo(() => tokens?.find(({ slug }) => slug === TONCOIN_SLUG), [tokens]) || {};
  const claimAmount = toBig(CLAIM_AMOUNT);
  const hasAmountError = !balance || balance < CLAIM_AMOUNT;

  const currentlyReadyToUnfreezeAmount = useMemo(() => {
    if (!vesting) return '0';

    return calcVestingAmountByStatus(vesting, ['ready']);
  }, [vesting]);

  const handleSubmit = useLastCallback((password: string) => {
    if (hasAmountError) return;
    submitClaimingVesting({ password });
  });

  if (!mycoin) {
    return undefined;
  }

  function renderInfo() {
    return (
      <>
        <div className={styles.operationInfo}>
          <img src={mycoin!.image} alt="" className={styles.tokenIcon} />
          <span className={styles.operationInfoText}>
            {lang('%amount% to %address%', {
              amount: (
                <span className={styles.bold}>
                  {formatCurrency(currentlyReadyToUnfreezeAmount, mycoin!.symbol, mycoin!.decimals)}
                </span>
              ),
              address: <span className={styles.bold}>{shortenAddress(address!)}</span>,
            })}
          </span>
        </div>
        <div className={styles.operationInfoFee}>
          {renderText(lang('$fee_value_bold', { fee: formatCurrency(claimAmount, TON_SYMBOL) }))}
        </div>
      </>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      title={lang('Confirm Unfreezing')}
      hasCloseButton
      forceFullNative
      nativeBottomSheetKey="vesting-confirm"
      contentClassName={styles.passwordModalDialog}
      onClose={cancelClaimingVesting}
    >
      <PasswordForm
        isActive={Boolean(isOpen)}
        placeholder={lang('Enter your password')}
        withCloseButton
        error={hasAmountError ? lang('Insufficient Balance for Fee.') : error}
        submitLabel={lang('Confirm')}
        isLoading={isLoading}
        onUpdate={clearVestingError}
        onSubmit={handleSubmit}
        onCancel={cancelClaimingVesting}
      >
        {renderInfo()}
      </PasswordForm>
    </Modal>
  );
}

export default memo(withGlobal((global): StateProps => {
  const { address } = selectAccount(global, global.currentAccountId!) || {};
  const accountState = selectCurrentAccountState(global);

  const {
    isConfirmRequested: isOpen,
    info: vesting,
    isLoading,
    error,
  } = accountState?.vesting || {};
  const tokens = selectCurrentAccountTokens(global);

  return {
    isOpen,
    vesting,
    tokens,
    isLoading,
    error,
    address,
    mycoin: selectMycoin(global),
  };
})(VestingPasswordModal));
