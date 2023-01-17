import type { AnimationLevel } from '../global/types';

import { ANIMATION_LEVEL_MAX, ANIMATION_LEVEL_MED, ANIMATION_LEVEL_MIN } from '../config';

const ANIMATION_LEVEL_OPTIONS = [
  ANIMATION_LEVEL_MIN,
  ANIMATION_LEVEL_MED,
  ANIMATION_LEVEL_MAX,
];

export default function switchAnimationLevel(level: AnimationLevel) {
  const levelClassName = `animation-level-${level}`;
  if (document.documentElement.classList.contains(levelClassName)) {
    return;
  }

  ANIMATION_LEVEL_OPTIONS.forEach((currentLevel) => {
    document.documentElement.classList.toggle(`animation-level-${currentLevel}`, currentLevel === level);
  });
}
