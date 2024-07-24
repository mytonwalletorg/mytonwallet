import React, { memo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import { selectCurrentAccountState } from '../../../global/selectors';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Button from '../../ui/Button';
import Modal from '../../ui/Modal';

import modalStyles from '../../ui/Modal.module.scss';

interface StateProps {
  isOpen?: boolean;
  nftAddress?: string;
  nftName?: string;
}

function UnhideNftModal({
  isOpen,
  nftAddress,
  nftName,
}: StateProps) {
  const { addNftsToWhitelist, closeUnhideNftModal } = getActions();

  const lang = useLang();

  const handleUnhide = useLastCallback(() => {
    addNftsToWhitelist({ addresses: [nftAddress!] });
    closeUnhideNftModal();
  });

  return (
    <Modal
      isOpen={isOpen}
      isCompact
      onClose={closeUnhideNftModal}
      title={lang('Unhide NFT')}
    >
      <p className={modalStyles.text}>
        {lang('$unhide_nft_warning', { name: <b>{nftName}</b> })}
      </p>
      <div className={modalStyles.buttons}>
        <Button onClick={closeUnhideNftModal} className={modalStyles.button}>{lang('Cancel')}</Button>
        <Button isDestructive onClick={handleUnhide} className={modalStyles.button}>
          {lang('Unhide')}
        </Button>
      </div>
    </Modal>
  );
}

export default memo(withGlobal((global): StateProps => {
  const {
    isUnhideNftModalOpen,
    selectedNftToUnhide,
  } = selectCurrentAccountState(global) ?? {};

  return {
    isOpen: isUnhideNftModalOpen,
    nftAddress: selectedNftToUnhide?.address,
    nftName: selectedNftToUnhide?.name,
  };
})(UnhideNftModal));
