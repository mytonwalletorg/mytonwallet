import { pause } from './schedulers';

import Deferred from './Deferred';

const deferreds = new Set<Deferred>();

let isFocused = true;

export function pauseOrFocus(ms: number, msWhenNotFocused = ms) {
  const deferred = new Deferred();

  deferreds.add(deferred);

  deferred.promise.then(() => {
    deferreds.delete(deferred);
  });

  pause(isFocused ? ms : msWhenNotFocused).then(deferred.resolve);

  return deferred.promise;
}

export function setIsAppFocused(_isFocused: boolean) {
  isFocused = _isFocused;

  if (_isFocused) {
    deferreds.forEach((d) => d.resolve());
  }
}
