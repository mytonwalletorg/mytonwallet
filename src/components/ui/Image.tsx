import React, { memo, useRef } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import { preloadedImageUrls } from '../../util/preloadImage';

import useFlag from '../../hooks/useFlag';
import { useIntersectionObserver, useOnIntersect } from '../../hooks/useIntersectionObserver';
import useMediaTransition from '../../hooks/useMediaTransition';

interface OwnProps {
  url: string;
  alt?: string;
  loading?: 'lazy' | 'eager';
  className?: string;
  imageClassName?: string;
  onIntersect?: VoidFunction;
}

const INTERSECTION_THROTTLE = 200;

function ImageComponent({
  url,
  alt,
  loading,
  className,
  imageClassName,
  onIntersect,
}: OwnProps) {
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLImageElement>(null);
  const [isLoaded, markIsLoaded] = useFlag(preloadedImageUrls.has(url));

  const { observe } = useIntersectionObserver({
    rootRef: containerRef,
    throttleMs: INTERSECTION_THROTTLE,
    isDisabled: !onIntersect,
  });

  useOnIntersect(ref, observe, (entry) => {
    if (onIntersect && entry.isIntersecting) {
      onIntersect();
    }
  });

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
        referrerPolicy="same-origin"
        onLoad={!isLoaded ? handleLoad : undefined}
      />
    </div>
  );
}

export default memo(ImageComponent);
