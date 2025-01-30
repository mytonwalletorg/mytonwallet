import React, { memo, useMemo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiSiteCategory } from '../../api/types';

import buildClassName from '../../util/buildClassName';

import { useDeviceScreen } from '../../hooks/useDeviceScreen';
import useLang from '../../hooks/useLang';

import Button from '../ui/Button';

import styles from './CategoryHeader.module.scss';

interface OwnProps {
  id: number;
  withNotch?: boolean;
}

interface StateProps {
  categories?: ApiSiteCategory[];
}

function CategoryHeader({ id, withNotch, categories }: OwnProps & StateProps) {
  const { closeSiteCategory } = getActions();

  const lang = useLang();
  const { isPortrait } = useDeviceScreen();

  const category = useMemo(() => {
    return (categories || [])?.find((item) => id === item.id);
  }, [categories, id]);

  return (
    <div className={buildClassName(
      styles.root,
      isPortrait && 'with-notch-on-scroll',
      withNotch && 'is-scrolled',
    )}
    >
      <Button className={styles.backButton} isSimple isText onClick={closeSiteCategory}>
        <i className={buildClassName(styles.backIcon, 'icon-chevron-left')} aria-hidden />
        <span>{lang('Back')}</span>
      </Button>

      <h3 className={styles.title}>
        {lang(category?.name || '')}
      </h3>
    </div>
  );
}

export default memo(withGlobal<OwnProps>((global): StateProps => {
  return {
    categories: global.exploreData?.categories,
  };
})(CategoryHeader));
