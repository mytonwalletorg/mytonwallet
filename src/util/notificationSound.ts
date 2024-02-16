import { NativeAudio } from '@capgo/native-audio';

import { IS_CAPACITOR, IS_EXTENSION } from '../config';
import { logDebug, logDebugError } from './logs';
import { debounce } from './schedulers';
import { IS_DELEGATED_BOTTOM_SHEET, IS_ELECTRON } from './windowEnvironment';

import incomingTransactionSound from '../assets/incoming-transaction.mp3';

const DEBOUNCE_MS = 1000;
// This is a tiny MP3 file that is silent - retrieved from https://bigsoundbank.com and then modified
// eslint-disable-next-line max-len
const silenceBase64 = 'SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAA1N3aXRjaCBQbHVzIMKpIE5DSCBTb2Z0d2FyZQBUSVQyAAAABgAAAzIyMzUAVFNTRQAAAA8AAANMYXZmNTcuODMuMTAwAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsRbAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMSkAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';

const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
const audioContext = new AudioContextConstructor();
let audioBuffer: AudioBuffer | undefined;
let isSoundInitialized = IS_ELECTRON || IS_CAPACITOR || IS_EXTENSION;

// Workaround: this function is called once on the first user interaction.
// After that, it will be possible to play the notification without problems.
// https://rosswintle.uk/2019/01/skirting-the-ios-safari-audio-auto-play-policy-for-ui-sound-effects/
// https://developer.chrome.com/blog/autoplay?hl=ru#webaudio
export function initializeSounds() {
  const raw = window.atob(silenceBase64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));

  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }

  audioContext.decodeAudioData(bytes.buffer, (silenceAudioBuffer) => {
    const gainNode = audioContext.createGain();

    const audioSource = audioContext.createBufferSource();
    gainNode.gain.value = 0.001;
    audioSource.buffer = silenceAudioBuffer;
    audioSource.connect(gainNode);

    audioSource.connect(audioContext.destination);
    audioSource.start();

    audioSource.onended = () => {
      isSoundInitialized = true;

      gainNode.gain.value = 1;
    };
  });
}

function loadSound() {
  if (IS_CAPACITOR) {
    NativeAudio.preload({
      assetId: 'incomingTransactionSound',
      assetPath: 'public/incoming-transaction.mp3',
      audioChannelNum: 1,
      isUrl: false,
    }).catch((err : any) => {
      logDebugError('appSounds:loadSound', err);
    });
  } else {
    fetch(incomingTransactionSound)
      .then((response) => response.arrayBuffer())
      .then((arrayBuffer) => audioContext.decodeAudioData(arrayBuffer))
      .then((decodedAudioBuffer) => {
        audioBuffer = decodedAudioBuffer;
      })
      .catch((err: any) => {
        logDebugError('appSounds:loadSound', err);
      });
  }
}

loadSound();

export const playIncomingTransactionSound = debounce(() => {
  if (IS_DELEGATED_BOTTOM_SHEET) return;

  if (IS_CAPACITOR) {
    NativeAudio
      .play({
        assetId: 'incomingTransactionSound',
      })
      .catch((err: any) => {
        logDebugError('appSounds:playIncomingTransactionSound', err);
      });
    return;
  }

  if (!isSoundInitialized) {
    logDebug('appSounds:playIncomingTransactionSound', 'sound is not initialized');
    return;
  }

  if (!audioBuffer) {
    logDebug('playIncomingTransactionSound', 'audioBuffer is not loaded');
    return;
  }

  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);
  source.start(0);
}, DEBOUNCE_MS, true, false);
