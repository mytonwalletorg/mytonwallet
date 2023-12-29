import { PluginListenerHandle } from '@capacitor/core';

export type BottomSheetKeys =
  'initial'
  | 'receive'
  | 'invoice'
  | 'transfer'
  | 'swap'
  | 'stake'
  | 'unstake'
  | 'staking-info'
  | 'transaction-info'
  | 'swap-activity'
  | 'backup'
  | 'add-account'
  | 'settings'
  | 'qr-scanner'
  | 'dapp-connect'
  | 'dapp-transaction'
  | 'disclaimer'
  | 'backup-warning';

export interface BottomSheetPlugin {
  prepare(): Promise<void>;

  applyScrollPatch(): Promise<void>;

  clearScrollPatch(): Promise<void>;

  delegate(options: { key: BottomSheetKeys, globalJson: string }): Promise<void>;

  release(options: { key: BottomSheetKeys | '*' }): Promise<void>;

  openSelf(options: { key: BottomSheetKeys, height: string, backgroundColor: string }): Promise<void>;

  closeSelf(options: { key: BottomSheetKeys }): Promise<void>;

  setSelfSize(options: { size: 'half' | 'full' }): Promise<void>;

  callActionInMain(options: { name: string, optionsJson: string }): Promise<void>;

  callActionInNative(options: { name: string, optionsJson: string }): Promise<void>;

  openInMain(options: { key: BottomSheetKeys }): Promise<void>;

  addListener(
    eventName: 'delegate',
    handler: (options: { key: BottomSheetKeys, globalJson: string }) => void,
  ): Promise<PluginListenerHandle> & PluginListenerHandle;

  addListener(
    eventName: 'move',
    handler: () => void,
  ): Promise<PluginListenerHandle> & PluginListenerHandle;

  addListener(
    eventName: 'callActionInMain',
    handler: (options: { name: string, optionsJson: string }) => void,
  ): Promise<PluginListenerHandle> & PluginListenerHandle;

  addListener(
    eventName: 'callActionInNative',
    handler: (options: { name: string, optionsJson: string }) => void,
  ): Promise<PluginListenerHandle> & PluginListenerHandle;

  addListener(
    eventName: 'openInMain',
    handler: (options: { key: BottomSheetKeys }) => void,
  ): Promise<PluginListenerHandle> & PluginListenerHandle;
}
