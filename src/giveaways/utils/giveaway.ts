import type { Wallet } from '@tonconnect/sdk';
import { useCallback } from '../../lib/teact/teact';

import { GIVEAWAYS_API_URL } from '../config';
import { logDebugError } from '../../util/logs';
import { tonConnect } from './tonConnect';

import useLastCallback from '../../hooks/useLastCallback';

const TIMESTAMP_SECOND = 1000;

export enum GiveawayType {
  Instant = 'instant',
  Lottery = 'lottery',
}

export enum GiveawayStatus {
  Pending = 'pending',
  Active = 'active',
  Finished = 'finished',
}

export interface Giveaway {
  id: number;
  status: GiveawayStatus;
  participantCount: number;
  type: GiveawayType;
  endsAt?: string;
  tokenAddress?: string;
  amount: number;
  receiverCount: number;
  taskUrl?: string;
}

export type SetGiveaway = (giveaway: Giveaway) => void;

export enum ParticipantStatus {
  AwaitingTask = 'awaitingTask',
  AwaitingLottery = 'awaitingLottery',
  AwaitingPayment = 'awaitingPayment',
  Paid = 'paid',
  Lost = 'lost',
  PaymentFailed = 'paymentFailed',
  NotFound = 'notFound',
}

export type SetParticipantStatus = (participantStatus: ParticipantStatus) => void;

export type GiveawayWithTask = Giveaway & { taskUrl: string };

interface FetchJettonMetadataRes {
  name: string;
  symbol: string;
  minterAddress: string;
  slug: string;
  image: string;
  decimals: number;
  isPopular: boolean;
  color: string;
}

export type JettonMetadataInfo = FetchJettonMetadataRes | { isTon: boolean };

export function isGiveawayWithTask(giveaway: Giveaway): giveaway is GiveawayWithTask {
  return Boolean(giveaway.taskUrl);
}

export async function fetchGiveaway(giveawayId: string) {
  const res = await fetch(`${GIVEAWAYS_API_URL}/giveaways/${giveawayId}`);
  return res.json();
}

async function fetchJettonMetadata(tokenAddress: string): Promise<FetchJettonMetadataRes> {
  const res = await fetch(`${GIVEAWAYS_API_URL}/jetton/${tokenAddress}`);
  return res.json();
}

export function useLoadGiveaway(
  setGiveaway: (giveaway: Giveaway) => void,
  setTokenAddressData: (jetton: JettonMetadataInfo) => void,
) {
  return useLastCallback(() => {
    const giveawayId = getGiveawayId();
    if (!giveawayId) return;

    void fetchGiveaway(giveawayId).then((giveawayRes) => {
      setGiveaway(giveawayRes);

      if (!giveawayRes.tokenAddress) {
        setTokenAddressData({ isTon: true });
        return;
      }

      void fetchJettonMetadata(
        giveawayRes.tokenAddress,
      ).then((jettonMetadata) => {
        setTokenAddressData(jettonMetadata);
      });
    });
  });
}

export async function fetchParticipantStatus(giveawayId: string, participantAddress: string) {
  let participantStatus;
  try {
    const res = await fetch(
      `${GIVEAWAYS_API_URL}/giveaways/${giveawayId}/checkPaticipant/${participantAddress}`,
    );
    const response = await res.json();
    if (response.ok) {
      participantStatus = response.participant.status;
    } else {
      participantStatus = ParticipantStatus.NotFound;
    }
  } catch (err: any) {
    logDebugError('giveaway', err);

    participantStatus = ParticipantStatus.NotFound;
  }

  return participantStatus;
}

export function useLoadParticipantStatus(
  wallet: Wallet | undefined,
  setParticipantStatus: (participantStatus: ParticipantStatus) => void,
) {
  return useCallback(() => {
    if (!wallet) return;

    const participantAddress = wallet.account.address;
    const giveawayId = getGiveawayId();
    if (giveawayId) {
      void fetchParticipantStatus(
        giveawayId, participantAddress,
      )
        .then((resParticipantStatus) => setParticipantStatus(resParticipantStatus));
    }
  }, [setParticipantStatus, wallet]);
}

export async function checkinGiveaway(
  captchaToken: string,
  wallet: Wallet,
  setParticipantStatus: SetParticipantStatus,
  setGiveaway: SetGiveaway,
) {
  const giveawayId = getGiveawayId();

  if (!(wallet.connectItems?.tonProof && 'proof' in wallet.connectItems.tonProof && giveawayId)) {
    if (tonConnect.connected) {
      void tonConnect.disconnect();
    }

    return;
  }

  const checkinRes = await fetch(
    `${GIVEAWAYS_API_URL}/giveaways/${giveawayId}/checkin`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        receiverAddress: wallet.account.address,
        tonProof: wallet.connectItems.tonProof.proof,
        stateInit: wallet.account.walletStateInit,
        captchaToken,
      }),
    },
  );
  const { giveaway, participant } = await checkinRes.json();
  setGiveaway(giveaway);
  setParticipantStatus(participant.status);
}

export function getGiveawayId() {
  return new URLSearchParams(window.location.search).get('giveawayId');
}

export function isGiveawayExpired(endsAt: string) {
  return new Date(endsAt) <= new Date(Date.now() + TIMESTAMP_SECOND * 10);
}
