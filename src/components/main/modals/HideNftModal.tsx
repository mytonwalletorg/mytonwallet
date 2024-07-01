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
  onClose: NoneToVoidFunction;
}

function HideNftModal({ isOpen, nftAddress, onClose }: OwnProps) {
  const { hideNft } = getActions();

  const lang = useLang();

  const handleHideNft = useLastCallback(() => {
    hideNft({ nftAddress: nftAddress! });
    onClose();
  });

  return (
    <Modal
      isOpen={isOpen}
      isCompact
      onClose={onClose}
      title={lang('Hide NFT')}
    >
      <p className={modalStyles.text}>
        {lang('Are you sure you want to hide this NFT? This action cannot be undone.')}
      </p>
      <div className={modalStyles.buttons}>
        <Button onClick={onClose} className={modalStyles.button}>{lang('Cancel')}</Button>
        <Button isDestructive onClick={handleHideNft} className={modalStyles.button}>
          {lang('Hide')}
        </Button>
      </div>
    </Modal>
  );
}

export default memo(HideNftModal);
