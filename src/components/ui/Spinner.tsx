import React, { memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';

import styles from './Spinner.module.scss';

type OwnProps = {
  color?: 'white';
  className?: string;
};

function Spinner({ color, className }: OwnProps) {
  const lang = useLang();

  const fullClassName = buildClassName(
    styles.spinner,
    color && styles[color],
    className,
  );

  return (
    <div className={fullClassName} aria-label={lang('Loading...')}>
      <i className={buildClassName(styles.inner, 'icon-spinner')} aria-hidden />
    </div>
  );
}

export default memo(Spinner);
