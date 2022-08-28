import React, { memo } from '../../lib/teact/teact';

import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';
import buildClassName from '../../util/buildClassName';
import useFlag from '../../hooks/useFlag';
import useTimeout from '../../hooks/useTimeout';
import useMediaTransition from '../../hooks/useMediaTransition';

import AnimatedIcon from '../ui/AnimatedIcon';

import styles from './Auth.module.scss';

interface OwnProps {
  isActive?: boolean;
}

const START_DELAY = 700;
const INTERVAL = 1000;

const AuthCreatingWallet = ({ isActive }: OwnProps) => {
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
      <AnimatedIcon
        play={isActive}
        tgsUrl={ANIMATED_STICKERS_PATHS.hello}
        nonInteractive
        noLoop={false}
      />
      <div className={styles.title}>Creating Wallet...</div>

      <div className={buildClassName(styles.counter)}>
        <p className={styles.counterTitle}>On the count of three...</p>
        <strong className={buildClassName(styles.counterDigit, oneClassNames)}>1</strong>
        <strong className={buildClassName(styles.counterDigit, twoClassNames)}>2</strong>
        <strong className={buildClassName(styles.counterDigit, threeClassNames)}>3</strong>
      </div>
    </div>
  );
};

export default memo(AuthCreatingWallet);
