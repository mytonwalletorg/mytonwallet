import React, { memo } from '../../lib/teact/teact';

import type { AgentAnswerFeedbackV2 } from '../../api/agentV2/protocol/types';

import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';

import styles from './AgentAnswerFeedback.module.scss';

interface OwnProps {
  feedback?: AgentAnswerFeedbackV2;
  /** An unrated answer shows the buttons only while the pointer is over it */
  isShownOnHover?: boolean;
  onChange: (feedback?: AgentAnswerFeedbackV2) => void;
}

const OPTIONS: { value: AgentAnswerFeedbackV2; label: string; icon: string; selectedIcon: string }[] = [
  { value: 'like', label: 'Like', icon: 'icon-thumb-up', selectedIcon: 'icon-thumb-up-filled' },
  { value: 'dislike', label: 'Dislike', icon: 'icon-thumb-down', selectedIcon: 'icon-thumb-down-filled' },
];

function AgentAnswerFeedback({ feedback, isShownOnHover = false, onChange }: OwnProps) {
  const lang = useLang();

  return (
    <div className={buildClassName(styles.root, isShownOnHover && !feedback && styles.shownOnHover)}>
      {OPTIONS.map(({ value, label, icon, selectedIcon }) => {
        const isSelected = feedback === value;

        return (
          <button
            key={value}
            type="button"
            className={buildClassName(styles.button, isSelected && styles.selected)}
            aria-label={lang(label)}
            aria-pressed={isSelected}
            title={lang(label)}
            onClick={() => onChange(isSelected ? undefined : value)}
          >
            <i className={isSelected ? selectedIcon : icon} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}

export default memo(AgentAnswerFeedback);
