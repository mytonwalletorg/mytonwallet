import React, { memo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import {
  selectCurrentAccount,
  selectCurrentAccountId,
  selectHasMultipleAccounts,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import resolveSlideTransitionName from '../../util/resolveSlideTransitionName';
import { IS_IOS_APP } from '../../util/windowEnvironment';

import useAccountSwitcherScreen, { AccountSwitcherScreen } from '../../hooks/useAccountSwitcherScreen';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import AccountSwitcherPill from '../common/AccountSwitcherPill';
import AccountSwitcherSlide from '../common/AccountSwitcherSlide';
import Modal from '../ui/Modal';
import ModalHeader from '../ui/ModalHeader';
import Transition from '../ui/Transition';
import Content from './Content';

import modalStyles from '../ui/Modal.module.scss';
import styles from './ReceiveModal.module.scss';

type StateProps = {
  isOpen?: boolean;
  currentAccountId?: string;
  accountTitle?: string;
  hasMultipleAccounts?: boolean;
};

function ReceiveModal({
  isOpen,
  currentAccountId,
  accountTitle,
  hasMultipleAccounts,
}: StateProps) {
  const { closeReceiveModal, switchAccount } = getActions();

  const lang = useLang();
  const {
    renderingKey, nextKey, updateNextKey, openSelector, closeSelector,
  } = useAccountSwitcherScreen(isOpen, currentAccountId);

  const modalTitle = lang('Fund');

  const handleSelectAccount = useLastCallback((accountId: string) => {
    switchAccount({ accountId });
  });

  function renderContent(isActive: boolean, isFrom: boolean, currentKey: AccountSwitcherScreen) {
    switch (currentKey) {
      case AccountSwitcherScreen.Main:
        return (
          <>
            <div className={styles.headerWithSwitcher}>
              <ModalHeader
                title={modalTitle}
                className={styles.receiveHeader}
                onClose={closeReceiveModal}
              />
              {hasMultipleAccounts && currentAccountId && (
                <AccountSwitcherPill
                  accountId={currentAccountId}
                  title={accountTitle}
                  className={styles.accountPill}
                  onClick={openSelector}
                />
              )}
            </div>
            <Content
              isOpen={isOpen && isActive}
              onClose={closeReceiveModal}
            />
          </>
        );
      case AccountSwitcherScreen.Selector:
        return (
          <AccountSwitcherSlide
            isActive={isActive}
            onAccountSelect={handleSelectAccount}
            onBack={closeSelector}
            onClose={closeReceiveModal}
          />
        );
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      dialogClassName={IS_IOS_APP ? styles.iosModalDialog : styles.modalDialog}
      onClose={closeReceiveModal}
      onCloseAnimationEnd={updateNextKey}
    >
      <Transition
        name={resolveSlideTransitionName()}
        className={buildClassName(modalStyles.transition, modalStyles.transition_stableScroll, 'custom-scroll')}
        slideClassName={modalStyles.transitionSlide}
        activeKey={renderingKey}
        nextKey={nextKey}
        onStop={updateNextKey}
      >
        {renderContent}
      </Transition>
    </Modal>
  );
}

export default memo(withGlobal((global): StateProps => {
  return {
    isOpen: global.isReceiveModalOpen,
    currentAccountId: selectCurrentAccountId(global),
    accountTitle: selectCurrentAccount(global)?.title,
    hasMultipleAccounts: selectHasMultipleAccounts(global),
  };
})(ReceiveModal));
