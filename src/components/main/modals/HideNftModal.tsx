import React, { memo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Button from '../../ui/Button';
import Modal from '../../ui/Modal';

import modalStyles from '../../ui/Modal.module.scss';

interface OwnProps {
  isOpen?: boolean;
  selectedNftsToHide?: {
    addresses: string[];
    isCollection: boolean;
  };
}

function HideNftModal({
  isOpen,
  selectedNftsToHide,
}: OwnProps) {
  const {
    addNftsToBlacklist,
    closeNftCollection,
    closeHideNftModal,
  } = getActions();

  const lang = useLang();

  const handleHide = useLastCallback(() => {
    addNftsToBlacklist({
      addresses: selectedNftsToHide!.addresses,
    });
    if (selectedNftsToHide?.isCollection) closeNftCollection();
    closeHideNftModal();
  });

  return (
    <Modal
      isOpen={isOpen}
      isCompact
      onClose={closeHideNftModal}
      title={lang('Hide NFTs')}
    >
      <p className={modalStyles.text}>
        {
          selectedNftsToHide?.isCollection
            ? lang(
              'Are you sure you want to hide this NFT collection containing %number% NFTs?',
              { number: selectedNftsToHide?.addresses.length },
            )
            : lang(
              'Are you sure you want to hide these %number% NFTs?',
              { number: selectedNftsToHide?.addresses.length },
            )
        }
      </p>
      <div className={modalStyles.buttons}>
        <Button onClick={closeHideNftModal} className={modalStyles.button}>{lang('Cancel')}</Button>
        <Button isDestructive onClick={handleHide} className={modalStyles.button}>
          {lang('Hide')}
        </Button>
      </div>
    </Modal>
  );
}

export default memo(HideNftModal);
