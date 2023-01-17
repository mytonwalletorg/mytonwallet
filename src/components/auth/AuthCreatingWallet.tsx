import React, { memo } from '../../lib/teact/teact';

import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';
import buildClassName from '../../util/buildClassName';
import useLang from '../../hooks/useLang';
import useFlag from '../../hooks/useFlag';
import useTimeout from '../../hooks/useTimeout';
import useMediaTransition from '../../hooks/useMediaTransition';

import AnimatedIconWithPreview from '../ui/AnimatedIconWithPreview';

import styles from './Auth.module.scss';

interface OwnProps {
  isActive?: boolean;
}

const START_DELAY = 700;
const INTERVAL = 1000;

const AuthCreatingWallet = ({ isActive }: OwnProps) => {
  const lang = useLang();
  const [one, markOne] = useFlag();
  const [two, markTwo] = useFlag();
  const [three, markThree] = useFlag();

  useTimeout(markOne, isActive ? START_DELAY : undefined);
  useTimeout(markTwo, isActive ? START_DELAY + INTERVAL : undefined);
  useTimeout(markThree, isActive ? START_DELAY + INTERVAL * 2 : undefined);

  const oneClassNames = useMediaTransition(one);
  const twoClassNames = useMediaTransition(two);
  const threeClassNames = useMediaTransition(three);

  return (
    <div className={buildClassName(styles.container, 'custom-scroll')}>
      <AnimatedIconWithPreview
        play={isActive}
        tgsUrl={ANIMATED_STICKERS_PATHS.hello}
        previewUrl={ANIMATED_STICKERS_PATHS.helloPreview}
        nonInteractive
        noLoop={false}
      />
      <div className={styles.title}>{lang('Creating Wallet...')}</div>

      <div className={buildClassName(styles.counter)}>
        <p className={styles.counterTitle}>{lang('On the count of three...')}</p>
        <b className={buildClassName(styles.counterDigit, oneClassNames)}>1</b>
        <b className={buildClassName(styles.counterDigit, twoClassNames)}>2</b>
        <b className={buildClassName(styles.counterDigit, threeClassNames)}>3</b>
      </div>
    </div>
  );
};

export default memo(AuthCreatingWallet);
