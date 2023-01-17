import React, { memo, useCallback } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import useFlag from '../../hooks/useFlag';
import useMediaTransition from '../../hooks/useMediaTransition';

import styles from './Emoji.module.scss';

interface OwnProps {
  from: '🥷' | '🦄' | 'telegram' | 'github';
}

const PATH_BY_EMOJI = {
  '🥷': '1f977',
  '🦄': '1f984',
};

const loadedImages = new Set();

function Emoji({ from }: OwnProps) {
  const key = from in PATH_BY_EMOJI ? PATH_BY_EMOJI[from as keyof typeof PATH_BY_EMOJI] : from;
  const src = `./emoji/${key}.png`;
  const [isLoaded, markLoaded] = useFlag(loadedImages.has(src));
  const transitionClassNames = useMediaTransition(isLoaded);

  const handleLoad = useCallback(() => {
    markLoaded();
    loadedImages.add(src);
  }, [markLoaded, src]);

  return (
    <img
      src={src}
      alt={from}
      className={buildClassName(styles.root, styles[`key-${key}`], transitionClassNames)}
      onLoad={handleLoad}
    />
  );
}

export default memo(Emoji);
