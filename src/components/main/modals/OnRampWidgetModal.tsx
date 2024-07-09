import React, {
  memo, useEffect, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiCountryCode } from '../../../api/types';

import { selectAccount } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';

import useLang from '../../../hooks/useLang';

import Loading from '../../ui/Loading';
import Modal from '../../ui/Modal';

import styles from './OnRampWidgetModal.module.scss';

interface StateProps {
  isOpen?: boolean;
  address?: string;
  countryCode?: ApiCountryCode;
}

const INITIAL_AMOUNT_USD = 50;
const ANIMATION_TIMEOUT = 200;

function OnRampWidgetModal({ isOpen, address, countryCode }: StateProps) {
  const {
    closeOnRampWidgetModal,
  } = getActions();

  const lang = useLang();
  const animationTimeoutRef = useRef<number>();
  const [isAnimationInProgress, setIsAnimationInProgress] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const withExtraHeight = countryCode === 'RU';

  const iframeUrl = getIframeUrl(countryCode).replace('{address}', address ?? '');

  useEffect(() => {
    if (!isOpen) {
      setIsAnimationInProgress(true);
      setIsLoading(true);
    }

    return () => window.clearTimeout(animationTimeoutRef.current);
  }, [isOpen]);

  const onIframeLoaded = () => {
    setIsLoading(false);

    animationTimeoutRef.current = window.setTimeout(() => {
      setIsAnimationInProgress(false);
    }, ANIMATION_TIMEOUT);
  };

  return (
    <Modal
      hasCloseButton
      isOpen={isOpen}
      title={lang('Buy with Card')}
      dialogClassName={buildClassName(styles.modalDialog, withExtraHeight && styles.modalDialogExtraHeight)}
      forceFullNative={withExtraHeight}
      nativeBottomSheetKey="onramp-widget"
      onClose={closeOnRampWidgetModal}
    >
      <div className={styles.content}>
        <div className={buildClassName(
          styles.loaderContainer,
          !isLoading && styles.fadeOut,
          !isAnimationInProgress && styles.inactive,
        )}
        >
          <Loading />
        </div>
        <iframe
          title="On Ramp Widget"
          onLoad={onIframeLoaded}
          className={!isLoading && styles.fadeIn}
          width="100%"
          height="100%"
          frameBorder="none"
          src={iframeUrl}
        >
          {lang('Cannot load widget')}
        </iframe>
      </div>
    </Modal>
  );
}

export default memo(withGlobal((global): StateProps => {
  const { address } = selectAccount(global, global.currentAccountId!) || {};
  const { countryCode } = global.restrictions;

  return {
    isOpen: global.isOnRampWidgetModalOpen,
    address,
    countryCode,
  };
})(OnRampWidgetModal));

function getIframeUrl(counryCode?: ApiCountryCode) {
  return counryCode === 'RU'
    ? 'https://dreamwalkers.io/ru/mytonwallet/?wallet={address}&give=CARDRUB&take=TON&type=buy'
    // eslint-disable-next-line max-len
    : `https://widget.changelly.com?from=usd%2Ceur&to=ton&amount=${INITIAL_AMOUNT_USD}&address={address}&fromDefault=usd&toDefault=ton&merchant_id=DdrqYH0dBHq6kGlj&payment_id=&v=3&color=5f41ff&headerId=1&logo=hide&buyButtonTextId=1`;
}
