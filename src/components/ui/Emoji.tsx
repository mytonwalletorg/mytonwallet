import React, { memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import useFlag from '../../hooks/useFlag';
import useLastCallback from '../../hooks/useLastCallback';
import useMediaTransition from '../../hooks/useMediaTransition';

import styles from './Emoji.module.scss';

export type EmojiIcon = '🥷' | '🦄' | '⚠️';

interface OwnProps {
  from: EmojiIcon;
}

const PATH_BY_EMOJI = {
  '🥷': '1f977',
  '🦄': '1f984',
  '⚠️': '26a0',
};

const loadedImages = new Set();

function Emoji({ from }: OwnProps) {
  const key = from in PATH_BY_EMOJI ? PATH_BY_EMOJI[from as keyof typeof PATH_BY_EMOJI] : from;
  const src = `./emoji/${key}.png`;
  const [isLoaded, markLoaded] = useFlag(loadedImages.has(src));
  const ref = useMediaTransition<HTMLImageElement>(isLoaded);

  const handleLoad = useLastCallback(() => {
    markLoaded();
    loadedImages.add(src);
  });

  return (
    <img
      ref={ref}
      src={src}
      alt={from}
      className={buildClassName(styles.root, styles[`key-${key}`])}
      onLoad={handleLoad}
    />
  );
}

export default memo(Emoji);
