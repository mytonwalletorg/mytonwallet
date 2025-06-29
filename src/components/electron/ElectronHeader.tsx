import type { TeactNode } from '../../lib/teact/teact';
import React, { memo, useRef } from '../../lib/teact/teact';

import { APP_NAME } from '../../config';
import { IS_WINDOWS } from '../../util/windowEnvironment';

import useElectronDrag from '../../hooks/useElectronDrag';
import useLastCallback from '../../hooks/useLastCallback';

import UpdateApp from './UpdateApp';

import styles from './ElectronHeader.module.scss';

type Props = {
  children?: TeactNode;
  withTitle?: boolean;
};

function ElectronHeader({ children, withTitle }: Props) {
  const containerRef = useRef<HTMLDivElement>();
  useElectronDrag(containerRef);

  const handleMinimize = useLastCallback(() => {
    window.electron?.minimize();
  });

  const handleMaximize = useLastCallback(async () => {
    if (await window.electron?.getIsMaximized()) {
      window.electron?.unmaximize();
    } else {
      window.electron?.maximize();
    }
  });

  const handleClose = useLastCallback(() => {
    window.electron?.close();
  });

  const handleDoubleClick = useLastCallback(() => {
    void window.electron?.handleDoubleClick();
  });

  if (IS_WINDOWS) {
    return (
      <div ref={containerRef} className={styles.container} onDoubleClick={handleDoubleClick}>
        <div className={styles.wrapper}>
          {Boolean(children) && <div className={styles.buttons}>{children}</div>}

          {withTitle && <div className={styles.applicationName}>{APP_NAME}</div>}
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
        {withTitle && <div className={styles.applicationName}>{APP_NAME}</div>}

        <div className={styles.buttons}>
          <UpdateApp />

          {children}
        </div>
      </div>
    </div>
  );
}

export default memo(ElectronHeader);
