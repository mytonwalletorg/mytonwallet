import React, { memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import useMediaTransition from '../../hooks/useMediaTransition';
import useFlag from '../../hooks/useFlag';

interface OwnProps {
  url: string;
  alt?: string;
  className?: string;
  imageClassName?: string;
}

const loadedUrls = new Set();

function Image({
  url,
  alt,
  className,
  imageClassName,
}: OwnProps) {
  const [isLoaded, markIsLoaded] = useFlag(loadedUrls.has(url));

  const handleLoad = () => {
    markIsLoaded();
    loadedUrls.add(url);
  };
  const transitionClassNames = useMediaTransition(isLoaded);

  return (
    <div className={buildClassName(transitionClassNames, className)}>
      <img
        src={url}
        alt={alt}
        className={imageClassName}
        referrerPolicy="same-origin"
        onLoad={!isLoaded ? handleLoad : undefined}
      />
    </div>
  );
}

export default memo(Image);
