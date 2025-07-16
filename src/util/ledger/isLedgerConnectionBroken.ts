const BROKEN_CONNECTION_ERRORS = new Set(['DisconnectedDeviceDuringOperation', 'TransportRaceCondition']);

export function isLedgerConnectionBroken(error: string) {
  return BROKEN_CONNECTION_ERRORS.has(error);
}
