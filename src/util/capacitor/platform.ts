export type CapacitorPlatform = 'ios' | 'android';

let platform: CapacitorPlatform | undefined;

export function setCapacitorPlatform(newPlatform: CapacitorPlatform) {
  platform = newPlatform;
}

export function getCapacitorPlatform() {
  return platform;
}
