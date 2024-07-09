import React, { memo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Button from '../../ui/Button';
import Modal from '../../ui/Modal';

import modalStyles from '../../ui/Modal.module.scss';

interface OwnProps {
  isOpen?: boolean;
  nftAddress?: string;
  nftName?: string;
  onClose: NoneToVoidFunction;
}

function UnhideNftModal({
  isOpen,
  nftAddress,
  nftName,
  onClose,
}: OwnProps) {
  const { addNftsToWhitelist } = getActions();

  const lang = useLang();

  const handleUnhide = useLastCallback(() => {
    addNftsToWhitelist({ addresses: [nftAddress!] });
    onClose();
  });

  return (
    <Modal
      isOpen={isOpen}
      isCompact
      onClose={onClose}
      title={lang('Unhide NFT')}
    >
      <p className={modalStyles.text}>
        {lang('$unhide_nft_warning', { name: <b>{nftName}</b> })}
      </p>
      <div className={modalStyles.buttons}>
        <Button onClick={onClose} className={modalStyles.button}>{lang('Cancel')}</Button>
        <Button isDestructive onClick={handleUnhide} className={modalStyles.button}>
          {lang('Unhide')}
        </Button>
      </div>
    </Modal>
  );
}

export default memo(UnhideNftModal);
