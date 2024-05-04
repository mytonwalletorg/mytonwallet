import React, { memo } from '../../../lib/teact/teact';

import renderText from '../../../global/helpers/renderText';
import buildClassName from '../../../util/buildClassName';

import useLang from '../../../hooks/useLang';

import Button from '../../ui/Button';
import Modal from '../../ui/Modal';

import modalStyles from '../../ui/Modal.module.scss';

interface OwnProps {
  isOpen?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

function BurnNftConfirm({
  isOpen,
  onConfirm,
  onClose,
}: OwnProps) {
  const lang = useLang();

  return (
    <Modal
      isOpen={isOpen}
      isCompact
      title={lang('Burn NFT')}
      onClose={onClose}
    >
      <p className={buildClassName(modalStyles.text, modalStyles.text_noExtraMargin)}>
        {renderText(lang('Are you sure you want to burn this NFT? It will be lost forever.'))}
      </p>
      <div className={modalStyles.buttons}>
        <Button className={modalStyles.button} onClick={onClose}>
          {lang('Cancel')}
        </Button>
        <Button isDestructive onClick={onConfirm} className={modalStyles.button}>
          {lang('Burn NFT')}
        </Button>
      </div>
    </Modal>
  );
}

export default memo(BurnNftConfirm);
