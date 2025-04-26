const CHECK_INTERVAL = 5000;

export function setReliableTimeout(callback: NoneToVoidFunction, delay: number): NoneToVoidFunction {
  if (delay <= 0) {
    callback();
    return () => {};
  }

  const startTime = Date.now();
  let intervalId: number | undefined;
  let isCleared = false;

  const clear = () => {
    if (isCleared) return;
    isCleared = true;
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = undefined;
    }
  };

  intervalId = window.setInterval(() => {
    if (isCleared) return;
    if (Date.now() - startTime >= delay) {
      clear();
      callback();
    }
  }, CHECK_INTERVAL);

  return clear;
}
