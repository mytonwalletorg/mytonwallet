import React, { memo, useRef } from '../../lib/teact/teact';

import { preloadedImageUrls } from '../../util/preloadImage';

import useFlag from '../../hooks/useFlag';
import useMediaTransition from '../../hooks/useMediaTransition';

interface OwnProps {
  url: string;
  alt?: string;
  loading?: 'lazy' | 'eager';
  className?: string;
  imageClassName?: string;
  children?: TeactJsx;
}

function ImageComponent({
  url,
  alt,
  loading,
  className,
  imageClassName,
  children,
}: OwnProps) {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLImageElement>(null);
  const [isLoaded, markIsLoaded] = useFlag(preloadedImageUrls.has(url));

  const handleLoad = () => {
    markIsLoaded();
    preloadedImageUrls.add(url);
  };

  const divRef = useMediaTransition(isLoaded);

  return (
    <div ref={divRef} className={className}>
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
      {children}
    </div>
  );
}

export default memo(ImageComponent);
