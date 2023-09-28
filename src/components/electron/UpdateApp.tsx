import React, {
  memo, useEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';

import { ElectronEvent } from '../../electron/types';

import { requestMutation } from '../../lib/fasterdom/fasterdom';
import buildClassName from '../../util/buildClassName';
import getBoundingClientRectsAsync from '../../util/getBoundingClientReactAsync';

import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useShowTransition from '../../hooks/useShowTransition';

import styles from './UpdateApp.module.scss';

const PROGRESS_OFFSET = 28.5; // Minimum progress in % when progressbar starts to explicitly grow

// Fake progress is shown between Update click and actual download progress received
const FAKE_PROGRESS_STEP = 1;
const FAKE_PROGRESS_TIMEOUT_MS = 1000;
const FAKE_PROGRESS_MAX = 20;

function UpdateApp() {
  const lang = useLang();

  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [isUpdateDownloaded, setIsUpdateDownloaded] = useState(false);
  const [isDisabled, disable, enable] = useFlag(false);

  const [progress, setProgress] = useState(0);
  const [fakeProgress, setFakeProgress] = useState(0);

  const progressStep = useMemo(() => (100 - fakeProgress) / 100, [fakeProgress]);
  const progressWidth = useMemo(() => PROGRESS_OFFSET + fakeProgress + progress * progressStep,
    [progress, progressStep, fakeProgress]);

  const timer = useRef<number | undefined>();
  const isCanceled = useRef<boolean>(false);

  const reset = useLastCallback(() => {
    clearInterval(timer.current);
    setIsUpdateAvailable(true);
    setIsUpdateDownloaded(false);
    setFakeProgress(0);
    setProgress(0);
  });

  useEffect(() => {
    const removeUpdateErrorListener = window.electron?.on(ElectronEvent.UPDATE_ERROR, () => {
      setIsUpdateAvailable(false);
    });
    const removeUpdateAvailableListener = window.electron?.on(ElectronEvent.UPDATE_AVAILABLE, () => {
      setIsUpdateAvailable(true);
    });
    const removeUpdateProgressListener = window.electron?.on(ElectronEvent.UPDATE_DOWNLOAD_PROGRESS, async (p: any) => {
      if (isCanceled.current) {
        await window.electron?.cancelUpdate();
        enable();
        return;
      }

      clearInterval(timer.current);
      setProgress(p.percent);
    });

    const removeUpdateDownloadedListener = window.electron?.on(ElectronEvent.UPDATE_DOWNLOADED, () => {
      setProgress(100);

      setTimeout(() => {
        setFakeProgress(0);
        setProgress(0);
        setIsUpdateDownloaded(true);
      }, 2000);
    });

    return () => {
      removeUpdateErrorListener?.();
      removeUpdateAvailableListener?.();
      removeUpdateProgressListener?.();
      removeUpdateDownloadedListener?.();
    };
  }, [reset, enable]);

  const handleClick = useLastCallback(async () => {
    isCanceled.current = false;

    if (isDisabled || progress) {
      return;
    }

    if (isUpdateDownloaded) {
      disable();
      await window.electron?.installUpdate();
      return;
    }

    if (isUpdateAvailable) {
      window.electron?.downloadUpdate();

      timer.current = window.setInterval(() => {
        setFakeProgress((fp) => {
          if (fp >= FAKE_PROGRESS_MAX) {
            clearInterval(timer.current);
            return fp;
          }

          return fp + FAKE_PROGRESS_STEP;
        });
      }, FAKE_PROGRESS_TIMEOUT_MS);
    }
  });

  const handleCancel = useLastCallback(async (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    disable();

    if (progress) {
      await window.electron?.cancelUpdate();
      enable();
    } else {
      isCanceled.current = true;
    }

    reset();
  });

  const { transitionClassNames, shouldRender } = useShowTransition(isUpdateDownloaded);

  const hasProgress = useMemo(() => !!(fakeProgress || progress) && !isDisabled, [progress, fakeProgress, isDisabled]);
  const isProgressShown = useMemo(() => !isUpdateDownloaded && hasProgress, [isUpdateDownloaded, hasProgress]);

  const isCancelShown = useMemo(() => isProgressShown && progressWidth <= 100, [isProgressShown, progressWidth]);
  const {
    transitionClassNames: cancelTransitionClassNames, shouldRender: shouldRenderCancel,
  } = useShowTransition(isCancelShown);

  // TODO: Return back "Restart" button after animation fix
  const text = isUpdateDownloaded ? lang('Update MyTonWallet') : lang('Update');
  const { transitionClassNames: textTransitionClassNames } = useShowTransition(!hasProgress);

  const icon = useMemo(() => (isUpdateDownloaded
    ? <i className={buildClassName('icon-update', styles.icon)} />
    : hasProgress ? undefined : <i className={buildClassName('icon-download', styles.icon)} />),
  [hasProgress, isUpdateDownloaded]);

  const { containerRef, renderedFakeText } = useContainerAnimation(text);

  if (!shouldRender) {
    return null; // eslint-disable-line no-null/no-null
  }

  return (
    <div
      className={buildClassName(
        styles.container,
        transitionClassNames,
        isProgressShown && styles.withProgress,
        isDisabled && styles.disabled,
        (isUpdateDownloaded || progress === 100) && styles.success,
      )}
      ref={containerRef}
      onClick={handleClick}
    >
      <div className={buildClassName(styles.wrapper, isProgressShown && styles.withProgress)}>
        <div
          className={buildClassName(styles.progressBar, !hasProgress && styles.withText)}
          style={`width: ${progressWidth}%`}
        >
          {icon}
        </div>
      </div>

      {renderedFakeText}

      <div className={buildClassName(styles.text, textTransitionClassNames)}>
        {text}
      </div>

      {shouldRenderCancel && (
        <div className={buildClassName(styles.close, cancelTransitionClassNames)}>
          <i className="icon-close" onClick={handleCancel} />
        </div>
      )}
    </div>
  );
}

function useContainerAnimation(text?: string) {
  const lang = useLang();

  const containerRef = useRef<HTMLDivElement>(null); // eslint-disable-line no-null/no-null
  const textRef = useRef<HTMLDivElement>(null); // eslint-disable-line no-null/no-null
  const lastWidthRef = useRef<number>();

  const calculateWidth = useLastCallback(() => {
    if (!textRef.current) {
      return;
    }

    getBoundingClientRectsAsync(textRef.current).then((rect) => {
      if (lastWidthRef.current !== rect.width) {
        requestMutation(() => {
          // Text width + icon width (19) + paddings (8 * 2)
          containerRef.current!.style.maxWidth = `${rect.width + 19 + 16}px`;
          lastWidthRef.current = rect.width;
        });
      }
    });
  });

  useEffect(() => {
    calculateWidth();
  }, [calculateWidth, lang, text]);

  const renderedFakeText = useMemo(() => (
    <div ref={textRef} className={buildClassName(styles.text, styles.fake)}>{text}</div>
  ), [text]);

  return { containerRef, renderedFakeText };
}

export default memo(UpdateApp);
