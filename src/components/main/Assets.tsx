import React, { memo } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import { UserToken } from '../../global/types';

import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';
import { ANIMATED_STICKER_SMALL_SIZE_PX } from '../../config';
import { selectAllTokens } from '../../global/selectors';

import AnimatedIcon from '../ui/AnimatedIcon';
import Token from './Token';
import Loading from '../ui/Loading';

import styles from './Assets.module.scss';

type OwnProps = {
  isActive?: boolean;
  onTokenClick: (slug: string) => void;
};

interface StateProps {
  tokens?: UserToken[];
  isNewWallet: boolean;
}

function Assets({
  isActive,
  tokens,
  isNewWallet,
  onTokenClick,
}: OwnProps & StateProps) {
  return (
    <div>
      {!tokens && <div className={styles.emptyList}><Loading /></div>}
      {isNewWallet && renderNewWalletGreetings(isActive)}
      {tokens && tokens.map((token) => (
        <Token key={token.slug} token={token} onClick={onTokenClick} />
      ))}
    </div>
  );
}

export default memo(withGlobal<OwnProps>((global): StateProps => {
  const tokens = selectAllTokens(global);

  return {
    tokens,
    isNewWallet: tokens?.length === 0 || (tokens?.length === 1 && tokens[0].amount === 0),
  };
})(Assets));

function renderNewWalletGreetings(isActive?: boolean) {
  return (
    <div className={styles.greetings}>
      <AnimatedIcon
        play={isActive}
        tgsUrl={ANIMATED_STICKERS_PATHS.hello}
        nonInteractive
        noLoop={false}
        size={ANIMATED_STICKER_SMALL_SIZE_PX}
      />

      <div className={styles.greetingsText}>
        <p className={styles.greetingsHeader}>You have just created a&nbsp;new wallet</p>
        <p className={styles.greetingsDescription}>
          You can now transfer your tokens from another wallet or exchange.
        </p>
      </div>
    </div>
  );
}
