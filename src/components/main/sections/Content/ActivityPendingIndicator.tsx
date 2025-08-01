import React, { memo } from '../../../../lib/teact/teact';

import type { AppTheme } from '../../../../global/types';

import { ANIMATED_STICKER_TINY_ICON_PX } from '../../../../config';
import { ANIMATED_STICKERS_PATHS } from '../../../ui/helpers/animatedAssets';

import useShowTransition from '../../../../hooks/useShowTransition';

import AnimatedIconWithPreview from '../../../ui/AnimatedIconWithPreview';

import styles from './Activity.module.scss';

const iconNamePrefix = 'iconClock';

export type Color = keyof typeof ANIMATED_STICKERS_PATHS.light.preview extends `${typeof iconNamePrefix}${infer C}`
  ? C : never;

interface OwnProps {
  isActive?: boolean;
  color?: Color;
  appTheme: AppTheme;
}

function ActivityPendingIndicator({ isActive, color = 'Gray', appTheme }: OwnProps) {
  const { shouldRender, ref } = useShowTransition({
    isOpen: isActive,
    withShouldRender: true,
  });

  if (!shouldRender) {
    return undefined;
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  const iconName = `${iconNamePrefix}${color}` as `${typeof iconNamePrefix}${Color}`;

  return (
    <div ref={ref} className={styles.iconWaiting}>
      <AnimatedIconWithPreview
        play
        size={ANIMATED_STICKER_TINY_ICON_PX}
        nonInteractive
        noLoop={false}
        forceOnHeavyAnimation
        tgsUrl={ANIMATED_STICKERS_PATHS[appTheme][iconName]}
        previewUrl={ANIMATED_STICKERS_PATHS[appTheme].preview[iconName]}
      />
    </div>
  );
}

export default memo(ActivityPendingIndicator);
