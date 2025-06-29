import React, { memo } from '../../lib/teact/teact';

import useUniqueId from '../../hooks/useUniqueId';

import styles from './ClockIcon.module.scss';

interface OwnProps {
  className?: string;
  noAnimation?: boolean;
}

function ClockIcon({ className, noAnimation }: OwnProps) {
  const svgMaskId = `transparentMask-${useUniqueId()}`;

  return (
    <svg width="1em" height="1em" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" className={className}>
      <mask id={svgMaskId}>
        <rect width="32" height="32" fill="black" />
        <circle cx="16" cy="16" r="16" fill="white" />
        <path
          d="M17.375 8.87438C17.375 8.11563 16.7594 7.5 16 7.5C15.2406 7.5 14.625 8.11563 14.625
              8.87438V16.0006C14.625 16.76 15.2406 17.375 16 17.375C16.7594 17.375 17.375 16.76 17.375 16.0006V8.87438Z"
          fill="black"
        >
          {!noAnimation && (
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 16 16"
              to="360 16 16"
              dur="2s"
              repeatCount="indefinite"
            />
          )}
        </path>
        <path
          d="M17.375 11.985C17.375 11.2337 16.7594 10.625 16 10.625C15.2406 10.625 14.625 11.2337 14.625
              11.985V16.015C14.625 16.7662 15.2406 17.375 16 17.375C16.7594 17.375 17.375 16.7662 17.375 16.015V11.985Z"
          fill="black"
        >
          {!noAnimation && (
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 16 16"
              to="360 16 16"
              dur="12s"
              repeatCount="indefinite"
            />
          )}
        </path>
      </mask>

      <rect
        className={styles.icon}
        width="32"
        height="32"
        mask={`url(#${svgMaskId})`}
      />
    </svg>
  );
}

export default memo(ClockIcon);
