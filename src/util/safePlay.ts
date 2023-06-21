import { logDebugError } from './logs';

const safePlay = (mediaEl: HTMLMediaElement) => {
  mediaEl.play().catch((err) => {
    logDebugError('safePlay', err);
  });
};

export default safePlay;
