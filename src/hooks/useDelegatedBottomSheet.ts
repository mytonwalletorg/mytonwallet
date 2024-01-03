import type { HTMLInputTypeAttribute } from 'react';
import type { SafeAreaInsets } from 'capacitor-plugin-safe-area';
import { SafeArea } from 'capacitor-plugin-safe-area';
import type { BottomSheetKeys } from 'native-bottom-sheet';
import { BottomSheet } from 'native-bottom-sheet';
import { useEffect, useLayoutEffect, useState } from '../lib/teact/teact';
import { forceOnHeavyAnimationOnce } from '../lib/teact/teactn';
import { getActions, setGlobal } from '../global';

import type { ActionPayloads, GlobalState } from '../global/types';

import cssColorToHex from '../util/cssColorToHex';
import { setStatusBarStyle } from '../util/switchTheme';
import { IS_DELEGATED_BOTTOM_SHEET } from '../util/windowEnvironment';
import { useDeviceScreen } from './useDeviceScreen';
import useEffectWithPrevDeps from './useEffectWithPrevDeps';

const BLUR_TIMEOUT = 50;

const controlledByMain = new Map<BottomSheetKeys, NoneToVoidFunction>();

const textInputTypes: Set<HTMLInputTypeAttribute> = new Set([
  'color', 'date', 'datetime-local', 'email', 'month', 'number',
  'password', 'search', 'tel', 'text', 'time', 'url', 'week',
]);

let safeAreaCache: SafeAreaInsets['insets'] | undefined;
const safeArePromise = SafeArea.getSafeAreaInsets().then(({ insets }) => {
  safeAreaCache = insets;
  return safeAreaCache;
});

let currentKey: BottomSheetKeys | undefined;

if (IS_DELEGATED_BOTTOM_SHEET) {
  BottomSheet.addListener('delegate', ({ key, globalJson }: { key: BottomSheetKeys; globalJson: string }) => {
    currentKey = key;
    controlledByMain.get(key)?.();

    setGlobal(
      JSON.parse(globalJson) as GlobalState,
      { forceOutdated: true, forceSyncOnIOs: true },
    );
  });

  BottomSheet.addListener('move', () => {
    window.dispatchEvent(new Event('viewportmove'));
  });

  BottomSheet.addListener(
    'callActionInNative',
    <K extends keyof ActionPayloads>({ name, optionsJson }: { name: string; optionsJson: string }) => {
      const action = getActions()[name as K];
      action((JSON.parse(optionsJson) || undefined) as ActionPayloads[K]);
    },
  );
}

export function useDelegatedBottomSheet(
  key: BottomSheetKeys | undefined,
  isOpen: boolean | undefined,
  onClose: AnyToVoidFunction,
  dialogRef: React.RefObject<HTMLDivElement>,
  forceFullNative = false,
  noResetHeightOnBlur = false,
) {
  useEffectWithPrevDeps(([prevIsOpen]) => {
    if (!IS_DELEGATED_BOTTOM_SHEET || !key || key !== currentKey) return;

    if (isOpen) {
      const dialogEl = dialogRef.current!;

      BottomSheet.openSelf({
        key,
        height: String(dialogEl.offsetHeight),
        backgroundColor: cssColorToHex(getComputedStyle(dialogEl).backgroundColor),
      }).then(() => {
        forceOnHeavyAnimationOnce();
        onClose();
      });
    } else if (prevIsOpen) {
      BottomSheet.closeSelf({ key });
      setStatusBarStyle();
    }
  }, [dialogRef, isOpen, key, onClose]);

  const isDelegatedAndOpen = IS_DELEGATED_BOTTOM_SHEET && key && isOpen;

  const { screenHeight } = useDeviceScreen();
  const [safeArea, setSafeArea] = useState(safeAreaCache);
  safeArePromise.then(setSafeArea);
  // We use Safe Area plugin instead of CSS `env()` function as it does not depend on modal position
  const maxHeight = screenHeight - (safeArea?.top || 0);

  useLayoutEffect(() => {
    if (!isDelegatedAndOpen) return;

    dialogRef.current!.style[forceFullNative ? 'maxHeight' : 'height'] = '';
    dialogRef.current!.style[forceFullNative ? 'height' : 'maxHeight'] = `${maxHeight}px`;
  }, [dialogRef, forceFullNative, isDelegatedAndOpen, maxHeight]);

  useEffectWithPrevDeps(([prevForceFullNative]) => {
    if (!isDelegatedAndOpen) return;

    // Skip initial opening
    if (forceFullNative !== undefined && prevForceFullNative === undefined) return;

    BottomSheet.setSelfSize({ size: forceFullNative ? 'full' : 'half' });
  }, [forceFullNative, isDelegatedAndOpen]);

  useLayoutEffect(() => {
    if (!isDelegatedAndOpen) return undefined;

    const dialogEl = dialogRef.current!;
    let blurTimeout: number | undefined;

    function onFocus(e: FocusEvent) {
      if (!isInput(e.target)) {
        return;
      }

      if (blurTimeout) {
        clearTimeout(blurTimeout);
        blurTimeout = undefined;
        return;
      }

      preventScrollOnFocus(dialogEl);

      BottomSheet.setSelfSize({ size: 'full' });
    }

    function onBlur(e: FocusEvent) {
      if (!isInput(e.target) || noResetHeightOnBlur) {
        return;
      }

      blurTimeout = window.setTimeout(() => {
        blurTimeout = undefined;
        BottomSheet.setSelfSize({ size: 'half' });
      }, BLUR_TIMEOUT);
    }

    document.addEventListener('focusin', onFocus);
    document.addEventListener('focusout', onBlur);

    return () => {
      document.removeEventListener('focusout', onBlur);
      document.removeEventListener('focusin', onFocus);
    };
  }, [dialogRef, isDelegatedAndOpen, noResetHeightOnBlur]);
}

export function useOpenFromMainBottomSheet(
  key: BottomSheetKeys,
  open: NoneToVoidFunction,
) {
  useEffect(() => {
    if (!IS_DELEGATED_BOTTOM_SHEET) return undefined;

    controlledByMain.set(key, open);

    if (currentKey === key) {
      open();
    }

    return () => {
      if (controlledByMain.get(key) === open) {
        controlledByMain.delete(key);
      }
    };
  }, [key, open]);
}

export function callActionInMain<K extends keyof ActionPayloads>(name: K, options?: ActionPayloads[K]) {
  BottomSheet.callActionInMain({
    name,
    // eslint-disable-next-line no-null/no-null
    optionsJson: JSON.stringify(options ?? null),
  });
}

export function callActionInNative<K extends keyof ActionPayloads>(name: K, options?: ActionPayloads[K]) {
  BottomSheet.callActionInNative({
    name,
    // eslint-disable-next-line no-null/no-null
    optionsJson: JSON.stringify(options ?? null),
  });
}

export function openInMain(key: BottomSheetKeys) {
  BottomSheet.openInMain({ key });
}

function isInput(el?: EventTarget | null) {
  if (!el || !(el instanceof HTMLElement)) return false;

  return (el.tagName === 'INPUT' && textInputTypes.has((el as HTMLInputElement).type))
    || el.tagName === 'TEXTAREA'
    || (el.tagName === 'DIV' && el.isContentEditable);
}

function preventScrollOnFocus(el: HTMLDivElement) {
  el.style.opacity = '0';
  setTimeout(() => {
    el.style.opacity = '1';
  });

  document.documentElement.scrollTop = 0;
}
