import type { ElementRef } from '../../lib/teact/teact';
import React, { memo, useRef } from '../../lib/teact/teact';

import type { ApiChain } from '../../api/types';

import buildClassName from '../../util/buildClassName';
import buildStyle from '../../util/buildStyle';
import { getChainTitle } from '../../util/chain';
import { animateShift } from '../../util/layoutChangeAnimation';
import getChainNetworkIcon from '../../util/swap/getChainNetworkIcon';
import { REM } from '../../util/windowEnvironment';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useLayoutEffectWithPrevDeps from '../../hooks/useLayoutEffectWithPrevDeps';

import Draggable from '../ui/Draggable';
import Switcher from '../ui/Switcher';

import styles from './Settings.module.scss';

interface OwnProps {
  chain: ApiChain;
  isVisible: boolean;
  isDraggable: boolean;
  isSwitcherDisabled: boolean;
  top: number;
  parentRef: ElementRef<HTMLDivElement>;
  scrollRef: ElementRef<HTMLDivElement>;
  onDrag: (translation: { x: number; y: number }, id: string | number) => void;
  onDragEnd: NoneToVoidFunction;
  onToggle: (chain: ApiChain) => void;
}

const MOVE_DURATION = 200;
// Must match the `padding-inline-start` difference of `.chainItem` in a draggable row
const KNOB_SPACE_PX = 2 * REM;

function ChainRow({
  chain,
  isVisible,
  isDraggable,
  isSwitcherDisabled,
  top,
  parentRef,
  scrollRef,
  onDrag,
  onDragEnd,
  onToggle,
}: OwnProps) {
  const lang = useLang();
  const itemRef = useRef<HTMLDivElement>();
  const iconRef = useRef<HTMLImageElement>();
  const titleRef = useRef<HTMLSpanElement>();

  const title = getChainTitle(chain);

  useLayoutEffectWithPrevDeps(([prevTop]) => {
    if (prevTop === undefined) return;

    // The item's parent is the row element `Draggable` positions, so the separator moves with the row
    animateShift(itemRef.current!.parentElement!, 0, prevTop - top, MOVE_DURATION);
  }, [top]);

  useLayoutEffectWithPrevDeps(([wasDraggable]) => {
    if (wasDraggable === undefined || wasDraggable === isDraggable) return;

    const offset = (isDraggable ? -KNOB_SPACE_PX : KNOB_SPACE_PX) * (lang.isRtl ? -1 : 1);
    animateShift(iconRef.current!, offset, 0, MOVE_DURATION);
    animateShift(titleRef.current!, offset, 0, MOVE_DURATION);
  }, [isDraggable, lang.isRtl]);

  const handleClick = useLastCallback(() => {
    onToggle(chain);
  });

  return (
    <Draggable
      id={chain}
      isDisabled={!isDraggable}
      isKnobDisabled={!isVisible}
      parentRef={parentRef}
      scrollRef={scrollRef}
      className={buildClassName(styles.chainRow, isDraggable && styles.chainRow_draggable)}
      style={buildStyle(`top: ${top}px`)}
      onClick={handleClick}
      onDrag={onDrag}
      onDragEnd={onDragEnd}
    >
      <div
        ref={itemRef}
        className={buildClassName(styles.item, styles.chainItem, !isDraggable && styles.chainItem_automatic)}
      >
        <img ref={iconRef} src={getChainNetworkIcon(chain)} alt="" className={styles.chainIcon} />
        <span ref={titleRef} className={styles.itemTitle}>{title}</span>
        <Switcher
          className={styles.menuSwitcher}
          label={title}
          checked={isVisible}
          isDisabled={isSwitcherDisabled}
        />
      </div>
    </Draggable>
  );
}

export default memo(ChainRow);
