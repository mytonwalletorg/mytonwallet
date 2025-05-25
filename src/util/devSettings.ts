/*
To activate dev setting, enter `devSettings.simulateLongUnstaking = true;` in the browser console,
either in the main frame or in the worker (different commands for different frames).
*/

declare const self: (WorkerGlobalScope | Window) & {
  devSettings: {
    simulateLongUnstaking?: boolean;
  };
};

export function getDevSettings() {
  return self.devSettings ?? {};
}

self.devSettings = {};
