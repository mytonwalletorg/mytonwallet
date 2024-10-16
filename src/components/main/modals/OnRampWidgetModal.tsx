import React, {
  memo, useEffect, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiCountryCode } from '../../../api/types';
import type { Theme } from '../../../global/types';

import { selectAccount } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { callApi } from '../../../api';

import useAppTheme from '../../../hooks/useAppTheme';
import useLang from '../../../hooks/useLang';

import Loading from '../../ui/Loading';
import Modal from '../../ui/Modal';

import styles from './OnRampWidgetModal.module.scss';

interface StateProps {
  isOpen?: boolean;
  address?: string;
  countryCode?: ApiCountryCode;
  theme: Theme;
}

const ANIMATION_TIMEOUT = 200;

function OnRampWidgetModal({
  isOpen, address, countryCode, theme,
}: StateProps) {
  const {
    closeOnRampWidgetModal,
    showError,
  } = getActions();

  const lang = useLang();
  const animationTimeoutRef = useRef<number>();
  const [isAnimationInProgress, setIsAnimationInProgress] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [iframeSrc, setIframeSrc] = useState('');
  const appTheme = useAppTheme(theme);

  useEffect(() => {
    if (!isOpen) {
      setIsAnimationInProgress(true);
      setIsLoading(true);
      setIframeSrc('');
    }

    return () => window.clearTimeout(animationTimeoutRef.current);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    if (countryCode === 'RU') {
      setIframeSrc(`https://dreamwalkers.io/ru/mytonwallet/?wallet=${address}&give=CARDRUB&take=TON&type=buy`);
      return;
    }

    (async () => {
      const response = await callApi('getMoonpayOnrampUrl', address!, appTheme);

      if (response && 'error' in response) {
        showError({ error: response.error });
      } else {
        setIframeSrc(response?.url || '');
      }
    })();
  }, [address, appTheme, countryCode, isOpen]);

  const onIframeLoaded = () => {
    setIsLoading(false);

    animationTimeoutRef.current = window.setTimeout(() => {
      setIsAnimationInProgress(false);
    }, ANIMATION_TIMEOUT);
  };

  function renderContent() {
    if (!iframeSrc) return undefined;

    return (
      <iframe
        title="On Ramp Widget"
        onLoad={onIframeLoaded}
        className={buildClassName(styles.iframe, !isLoading && styles.fadeIn)}
        width="100%"
        height="100%"
        frameBorder="none"
        allow="autoplay; camera; microphone; payment"
        src={iframeSrc}
      >
        {lang('Cannot load widget')}
      </iframe>
    );
  }

  return (
    <Modal
      hasCloseButton
      isOpen={isOpen}
      title={lang('Buy with Card')}
      dialogClassName={styles.modalDialog}
      forceFullNative
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
        {renderContent()}
      </div>
    </Modal>
  );
}

export default memo(withGlobal((global): StateProps => {
  const { addressByChain } = selectAccount(global, global.currentAccountId!) || {};
  const { countryCode } = global.restrictions;

  return {
    isOpen: global.isOnRampWidgetModalOpen,
    address: addressByChain?.ton,
    countryCode,
    theme: global.settings.theme,
  };
})(OnRampWidgetModal));
