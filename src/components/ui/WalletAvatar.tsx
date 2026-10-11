import React, { memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import buildStyle from '../../util/buildStyle';
import { getAvatarGradientColors } from './helpers/getAvatarGradientColor';
import { getAvatarInitials } from './helpers/getAvatarInitials';

import styles from './WalletAvatar.module.scss';

type OwnProps = {
  title?: string;
  accountId?: string;
  className?: string;
};

const WalletAvatar = ({ title, accountId, className }: OwnProps) => {
  const [startColor, endColor] = getAvatarGradientColors(accountId ?? title ?? '');

  return (
    <div
      className={buildClassName(styles.avatar, className, 'rounded-font')}
      style={buildStyle(`--start-color: ${startColor}; --end-color: ${endColor}`)}
    >
      {getAvatarInitials(title)}
    </div>
  );
};

export default memo(WalletAvatar);
