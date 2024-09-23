import type { Wallet, WalletInfoRemote } from '@tonconnect/sdk';
import React, {
  memo,
  useCallback,
  useEffect, useLayoutEffect, useState,
} from '../../lib/teact/teact';

import type { JettonMetadata } from '../../api/chains/ton/types';
import type { Giveaway } from '../utils/giveaway';

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

import Loading from '../../components/ui/Loading';
import Transition from '../../components/ui/Transition';
import CaptchaPage from '../pages/CaptchaPage';
import CompleteTaskPage from '../pages/CompleteTaskPage';
import ConnectPage from '../pages/ConnectPage';
import GiveawayInfoPage from '../pages/GiveawayInfoPage';

import styles from './App.module.scss';

interface OwnProps {
  mtwWalletInfo: WalletInfoRemote;
}

export type JettonMetadataInfo = JettonMetadata | { isTon: boolean };

const FETCH_REPEAT_MS = 3000;

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
  const [renderKey, setRenderKey] = useState(0);

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
    setRenderKey((prevKey) => prevKey + 1);
  }, [participantStatus, giveaway, wallet, tokenAddressData]);

  const handleConnectClick = useCallback(
    () => handleTonConnectButtonClick(mtwWalletInfo),
    [mtwWalletInfo],
  );

  function renderPage() {
    if (!getGiveawayId()) {
      return <div>QueryParams has no giveawayId</div>;
    }

    if (!giveaway) {
      return <div className={styles.loading}><Loading /></div>;
    }

    if (!wallet) {
      return (
        <ConnectPage
          giveaway={giveaway}
          onConnectClick={handleConnectClick}
        />
      );
    }

    if (giveaway.status === GiveawayStatus.Active && participantStatus === ParticipantStatus.NotFound) {
      return (
        <CaptchaPage
          wallet={wallet}
          setParticipantStatus={setParticipantStatus}
          setGiveaway={setGiveaway}
        />
      );
    }

    if ((isGiveawayWithTask(giveaway) && participantStatus === ParticipantStatus.AwaitingTask)) {
      return (
        <CompleteTaskPage
          giveaway={giveaway}
          wallet={wallet}
          loadParticipantStatus={loadParticipantStatus}
        />
      );
    }

    if (participantStatus) {
      return (
        <GiveawayInfoPage
          giveaway={giveaway}
          wallet={wallet}
          participantStatus={participantStatus}
          jettonMetadata={tokenAddressData}
        />
      );
    }

    return <div className={styles.loading}><Loading /></div>;
  }

  return (
    <div className={styles.app}>
      <Transition
        name={isPortrait ? (IS_ANDROID ? 'slideFadeAndroid' : IS_IOS ? 'slideLayers' : 'slideFade') : 'semiFade'}
        activeKey={renderKey}
        slideClassName={buildClassName(styles.appSlide, 'custom-scroll')}
      >
        {renderPage()}
      </Transition>
    </div>
  );
}

export default memo(App);
