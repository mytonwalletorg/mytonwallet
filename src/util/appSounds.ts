import { debounce } from './schedulers';
import safePlay from './safePlay';

const DEBOUNCE_MS = 1000;
const sound = new Audio('./incoming-transaction.mp3');

// Workaround: this function is called once on the first user interaction.
// After that, it will be possible to play the notification on iOS without problems.
// https://rosswintle.uk/2019/01/skirting-the-ios-safari-audio-auto-play-policy-for-ui-sound-effects/
export function initializeSoundsForSafari() {
  // This is a tiny MP3 file that is silent - retrieved from https://bigsoundbank.com and then modified
  // eslint-disable-next-line max-len
  sound.src = 'data:audio/mpeg;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAA1N3aXRjaCBQbHVzIMKpIE5DSCBTb2Z0d2FyZQBUSVQyAAAABgAAAzIyMzUAVFNTRQAAAA8AAANMYXZmNTcuODMuMTAwAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsRbAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMSkAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';
  sound.muted = true;
  sound.volume = 0.0001;
  sound.play()
    .then(() => {
      sound.pause();
      sound.volume = 1;
      sound.currentTime = 0;
      sound.muted = false;

      requestAnimationFrame(() => {
        sound.src = './incoming-transaction.mp3';
      });
    });
}

export const playIncomingTransactionSound = debounce(() => {
  safePlay(sound);
}, DEBOUNCE_MS, true, false);
