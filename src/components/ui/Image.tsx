import React, { memo, useRef } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import { preloadedImageUrls } from '../../util/preloadImage';

import useFlag from '../../hooks/useFlag';
import useMediaTransition from '../../hooks/useMediaTransition';

interface OwnProps {
  url: string;
  alt?: string;
  loading?: 'lazy' | 'eager';
  className?: string;
  imageClassName?: string;
}

function ImageComponent({
  url,
  alt,
  loading,
  className,
  imageClassName,
}: OwnProps) {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLImageElement>(null);
  const [isLoaded, markIsLoaded] = useFlag(preloadedImageUrls.has(url));

  const handleLoad = () => {
    markIsLoaded();
    preloadedImageUrls.add(url);
  };

  const transitionClassNames = useMediaTransition(isLoaded);

  return (
    <div className={buildClassName(transitionClassNames, className)}>
      <img
        ref={ref}
        src={url}
        alt={alt}
        loading={loading}
        className={imageClassName}
        draggable={false}
        referrerPolicy="same-origin"
        onLoad={!isLoaded ? handleLoad : undefined}
      />
    </div>
  );
}

export default memo(ImageComponent);
