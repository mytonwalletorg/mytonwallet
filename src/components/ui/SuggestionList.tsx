import React, { memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import styles from './SuggestionList.module.scss';

type OwnProps = {
  position?: 'top' | 'bottom';
  suggestions: string[];
  activeIndex?: number;
  isInModal?: boolean;
  onSelect: (suggest: string) => void;
};

function SuggestionList({
  position = 'bottom',
  suggestions,
  activeIndex,
  isInModal,
  onSelect,
}: OwnProps) {
  const handleClick = (e: React.MouseEvent) => {
    const suggest = (e.target as HTMLLIElement).innerText.trim();
    onSelect(suggest);
  };

  return suggestions.length ? (
    <ul className={buildClassName(styles.suggestions, styles[position], isInModal && styles.embedded)}>
      {suggestions.map((suggestion, index) => {
        return (
          <li
            key={suggestion}
            role="button"
            tabIndex={0}
            className={buildClassName(styles.suggestion, index === activeIndex && styles.active)}
            onMouseDown={handleClick}
          >
            {suggestion}
          </li>
        );
      })}
    </ul>
  ) : (
    <div className={styles.suggestions}>
      <li className={styles.suggestion}>No suggestions, you&apos;re on your own!</li>
    </div>
  );
}

export default memo(SuggestionList);
