import React, { memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import Button from './Button';

import modalStyles from './Modal.module.scss';

type OwnProps = {
  title: string;
  onClose: NoneToVoidFunction;
};

function ModalHeader({ title, onClose }: OwnProps) {
  return (
    <div className={buildClassName(modalStyles.header, modalStyles.header_transition)}>
      <div className={modalStyles.title}>{title}</div>
      <Button
        isRound
        className={modalStyles.closeButton}
        ariaLabel="Close"
        onClick={onClose}
      >
        <i className={buildClassName(modalStyles.closeIcon, 'icon-close')} aria-hidden />
      </Button>
    </div>
  );
}

export default memo(ModalHeader);
