import React, { memo, useCallback, useEffect } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type { OwnProps as AnimatedIconProps } from './AnimatedIcon';

import { ANIMATION_LEVEL_MIN } from '../../config';
import buildClassName from '../../util/buildClassName';
import buildStyle from '../../util/buildStyle';
import useMediaTransition from '../../hooks/useMediaTransition';
import useFlag from '../../hooks/useFlag';

import AnimatedIcon from './AnimatedIcon';

import styles from './AnimatedIconWithPreview.module.scss';

type OwnProps =
  Partial<AnimatedIconProps>
  & { previewUrl?: string; thumbDataUri?: string; noPreviewTransition?: boolean };

interface StateProps {
  noAnimation?: boolean;
}

const loadedPreviewUrls = new Set();

function AnimatedIconWithPreview(props: OwnProps & StateProps) {
  const {
    previewUrl, thumbDataUri, className, noAnimation, ...otherProps
  } = props;

  const [isPreviewLoaded, markPreviewLoaded] = useFlag(Boolean(thumbDataUri) || loadedPreviewUrls.has(previewUrl));
  const transitionClassNames = useMediaTransition(isPreviewLoaded);
  const [isAnimationReady, markAnimationReady, markAnimationNotReady] = useFlag(false);

  useEffect(() => {
    if (noAnimation) {
      markAnimationNotReady();
    }
  }, [markAnimationNotReady, noAnimation]);

  const handlePreviewLoad = useCallback(() => {
    markPreviewLoaded();
    loadedPreviewUrls.add(previewUrl);
  }, [markPreviewLoaded, previewUrl]);

  const { size } = props;

  return (
    <div
      className={buildClassName(className, styles.root, transitionClassNames)}
      style={buildStyle(size !== undefined && `width: ${size}px; height: ${size}px;`)}
    >
      {thumbDataUri && !previewUrl && !isAnimationReady && (
        // eslint-disable-next-line jsx-a11y/alt-text
        <img src={thumbDataUri} className={styles.preview} />
      )}
      {previewUrl && !isAnimationReady && (
        // eslint-disable-next-line jsx-a11y/alt-text
        <img
          src={previewUrl}
          className={styles.preview}
          onLoad={handlePreviewLoad}
        />
      )}
      {/* eslint-disable-next-line react/jsx-props-no-spreading */}
      {!noAnimation && <AnimatedIcon {...otherProps} onLoad={markAnimationReady} noTransition />}
    </div>
  );
}

export default memo(withGlobal<OwnProps>((global): StateProps => {
  return {
    noAnimation: global.settings.animationLevel === ANIMATION_LEVEL_MIN,
  };
})(AnimatedIconWithPreview));
