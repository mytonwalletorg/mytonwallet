import type { Wallet, WalletInfoRemote } from '@tonconnect/sdk';
import React, {
  memo, useCallback, useEffect, useLayoutEffect, useState,
} from '../../lib/teact/teact';

import type { Giveaway, GiveawayWithTask, JettonMetadataInfo } from '../utils/giveaway';

import buildClassName from '../../util/buildClassName';
import { resolveRender } from '../../util/renderPromise';
import { IS_ANDROID, IS_IOS } from '../../util/windowEnvironment';
import {
  getGiveawayId,
  GiveawayStatus,
  isGiveawayWithTask,
  ParticipantStatus,
  useLoadGiveaway,
  useLoadParticipantStatus,
} from '../utils/giveaway';
import { handleTonConnectButtonClick, useLoadWallet } from '../utils/tonConnect';

import { useDeviceScreen } from '../../hooks/useDeviceScreen';
import useEffectOnce from '../../hooks/useEffectOnce';
import useInterval from '../../hooks/useInterval';

import Spinner from '../../components/ui/Spinner';
import Transition from '../../components/ui/Transition';
import CaptchaPage from '../pages/CaptchaPage';
import CompleteTaskPage from '../pages/CompleteTaskPage';
import ConnectPage from '../pages/ConnectPage';
import GiveawayInfoPage from '../pages/GiveawayInfoPage';

import styles from './App.module.scss';

interface OwnProps {
  mtwWalletInfo: WalletInfoRemote;
}

const FETCH_REPEAT_MS = 3000;

enum PageKey {
  NoGiveaway,
  Loading,
  Connect,
  Captcha,
  CompleteTask,
  GiveawayInfo,
}

function App({ mtwWalletInfo }: OwnProps) {
  useLayoutEffect(() => {
    document.documentElement.classList.add('is-rendered');
    resolveRender();
  }, []);

  const { isPortrait } = useDeviceScreen();

  const [giveaway, setGiveaway] = useState<Giveaway>();
  const [participantStatus, setParticipantStatus] = useState<ParticipantStatus>();
  const [wallet, setWallet] = useState<Wallet>();
  const [tokenAddressData, setTokenAddressData] = useState<JettonMetadataInfo>();
  const [renderKey, setRenderKey] = useState<PageKey>(PageKey.Loading);

  const loadGiveaway = useLoadGiveaway(setGiveaway, setTokenAddressData);
  const loadWallet = useLoadWallet(setWallet);

  useEffectOnce(() => {
    loadGiveaway();
    loadWallet();
  });

  const loadParticipantStatus = useLoadParticipantStatus(wallet, setParticipantStatus);

  useEffect(() => {
    loadParticipantStatus();
  }, [loadParticipantStatus, wallet]);
  useInterval(loadParticipantStatus, FETCH_REPEAT_MS);

  useEffect(() => {
    if (!getGiveawayId()) {
      setRenderKey(PageKey.NoGiveaway);
    } else if (!giveaway) {
      setRenderKey(PageKey.Loading);
    } else if (!wallet) {
      setRenderKey(PageKey.Connect);
    } else if (giveaway.status === GiveawayStatus.Active && participantStatus === ParticipantStatus.NotFound) {
      setRenderKey(PageKey.Captcha);
    } else if (isGiveawayWithTask(giveaway) && participantStatus === ParticipantStatus.AwaitingTask) {
      setRenderKey(PageKey.CompleteTask);
    } else if (participantStatus) {
      setRenderKey(PageKey.GiveawayInfo);
    }
  }, [participantStatus, giveaway, wallet]);

  const handleConnectClick = useCallback(
    () => handleTonConnectButtonClick(mtwWalletInfo),
    [mtwWalletInfo],
  );

  function renderPage() {
    switch (renderKey) {
      case PageKey.NoGiveaway:
        return <div>QueryParams has no giveawayId</div>;

      case PageKey.Loading:
        return <div className={styles.loading}><Spinner /></div>;

      case PageKey.Connect:
        return (
          <ConnectPage
            giveaway={giveaway!}
            wallet={wallet}
            onConnectClick={handleConnectClick}
          />
        );

      case PageKey.Captcha:
        return (
          <CaptchaPage
            wallet={wallet!}
            setParticipantStatus={setParticipantStatus}
            setGiveaway={setGiveaway}
            isGiveawayFinished={giveaway?.status === GiveawayStatus.Finished}
          />
        );

      case PageKey.CompleteTask:
        return (
          <CompleteTaskPage
            giveaway={giveaway as GiveawayWithTask}
            wallet={wallet!}
            loadParticipantStatus={loadParticipantStatus}
          />
        );

      case PageKey.GiveawayInfo:
        return (
          <GiveawayInfoPage
            giveaway={giveaway!}
            wallet={wallet!}
            participantStatus={participantStatus!}
            jettonMetadata={tokenAddressData}
          />
        );

      default:
        return <div className={styles.loading}><Spinner /></div>;
    }
  }

  return (
    <div className={styles.app}>
      <Transition
        name={isPortrait ? (IS_ANDROID ? 'slideFadeAndroid' : IS_IOS ? 'slideLayers' : 'slideFade') : 'fade'}
        activeKey={renderKey}
        slideClassName={buildClassName(styles.appSlide, 'custom-scroll')}
      >
        {renderPage}
      </Transition>
    </div>
  );
}

export default memo(App);
