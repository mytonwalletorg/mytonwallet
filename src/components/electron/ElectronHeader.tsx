import React, { memo, useCallback, useRef } from '../../lib/teact/teact';

import { IS_WINDOWS } from '../../util/windowEnvironment';

import useElectronDrag from '../../hooks/useElectronDrag';

import UpdateApp from './UpdateApp';

import styles from './ElectronHeader.module.scss';

type Props = {
  children?: React.ReactNode;
  withTitle?: boolean;
};

function ElectronHeader({ children, withTitle }: Props) {
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  useElectronDrag(containerRef);

  const handleMinimize = useCallback(() => {
    window.electron?.minimize();
  }, []);

  const handleMaximize = useCallback(async () => {
    if (await window.electron?.getIsMaximized()) {
      window.electron?.unmaximize();
    } else {
      window.electron?.maximize();
    }
  }, []);

  const handleClose = useCallback(() => {
    window.electron?.close();
  }, []);

  const handleDoubleClick = useCallback(() => {
    window.electron?.handleDoubleClick();
  }, []);

  if (IS_WINDOWS) {
    return (
      <div ref={containerRef} className={styles.container} onDoubleClick={handleDoubleClick}>
        <div className={styles.wrapper}>
          {Boolean(children) && <div className={styles.buttons}>{children}</div>}

          {withTitle && <div className={styles.applicationName}>MyTonWallet</div>}
        </div>

        <div className={styles.windowsButtons}>
          <UpdateApp />

          <div className={styles.windowsButton} onClick={handleMinimize}>
            <i className="icon-windows-minimize" />
          </div>

          <div className={styles.windowsButton} onClick={handleMaximize}>
            <i className="icon-windows-maximize" />
          </div>

          <div className={styles.windowsButton} onClick={handleClose}>
            <i className="icon-windows-close" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={styles.container} onDoubleClick={handleDoubleClick}>
      <div className={styles.wrapper}>
        {withTitle && <div className={styles.applicationName}>MyTonWallet</div>}

        <div className={styles.buttons}>
          <UpdateApp />

          {children}
        </div>
      </div>
    </div>
  );
}

export default memo(ElectronHeader);
