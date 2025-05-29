import { useEffect, useState } from '../lib/teact/teact';

import type { IAnchorPosition } from '../global/types';

interface Layout {
  withPortal?: boolean;
}

const MENU_POSITION_VISUAL_COMFORT_SPACE_PX = 16;
const MENU_POSITION_BOTTOM_MARGIN = 12;
const EMPTY_RECT = {
  width: 0, left: 0, height: 0, top: 0,
};

export default function useMenuPositionDeprecated(
  anchor: IAnchorPosition | undefined,
  getTriggerElement: () => HTMLElement | null,
  getRootElement: () => HTMLElement | null,
  getMenuElement: () => HTMLElement | null,
  getLayout?: () => Layout,
) {
  const [positionX, setPositionX] = useState<'right' | 'left'>('right');
  const [positionY, setPositionY] = useState<'top' | 'bottom'>('bottom');
  const [transformOriginX, setTransformOriginX] = useState<number>();
  const [transformOriginY, setTransformOriginY] = useState<number>();
  const [withScroll, setWithScroll] = useState(false);
  const [style, setStyle] = useState('');
  const [menuStyle, setMenuStyle] = useState('opacity: 0;');

  useEffect(() => {
    const triggerEl = getTriggerElement();
    if (!anchor || !triggerEl) {
      return;
    }

    let { x, y } = anchor;
    const anchorX = x;
    const anchorY = y;

    const menuEl = getMenuElement();
    const rootEl = getRootElement();

    const {
      withPortal = false,
    } = getLayout?.() || {};

    const marginTop = menuEl ? parseInt(getComputedStyle(menuEl).marginTop, 10) : undefined;
    const { offsetWidth: menuElWidth, offsetHeight: menuElHeight } = menuEl || { offsetWidth: 0, offsetHeight: 0 };
    const menuRect = menuEl ? {
      width: menuElWidth,
      height: menuElHeight + marginTop!,
    } : EMPTY_RECT;

    const rootRect = rootEl ? rootEl.getBoundingClientRect() : EMPTY_RECT;

    let horizontalPosition: 'left' | 'right';
    let verticalPosition: 'top' | 'bottom';
    if (x - menuRect.width - rootRect.left > 0) {
      horizontalPosition = 'right';
      x -= 3;
    } else {
      horizontalPosition = 'left';
      x = 16;
    }
    setPositionX(horizontalPosition);

    if (y + menuRect.height < rootRect.height + rootRect.top) {
      verticalPosition = 'top';
    } else {
      verticalPosition = 'bottom';

      if (y - menuRect.height < rootRect.top) {
        y = rootRect.top + rootRect.height;
      }
    }

    setPositionY(verticalPosition);

    const triggerRect = triggerEl.getBoundingClientRect();

    const addedYForPortalPositioning = (withPortal ? triggerRect.top : 0);
    const addedXForPortalPositioning = (withPortal ? triggerRect.left : 0);

    const leftWithPossibleNegative = Math.min(
      x - triggerRect.left,
      rootRect.width - menuRect.width - MENU_POSITION_VISUAL_COMFORT_SPACE_PX,
    );
    const left = (horizontalPosition === 'left'
      ? (withPortal
        ? Math.max(MENU_POSITION_VISUAL_COMFORT_SPACE_PX, leftWithPossibleNegative)
        : leftWithPossibleNegative)
      : (x - triggerRect.left)) + addedXForPortalPositioning;
    const top = y - triggerRect.top + addedYForPortalPositioning;

    const menuMaxHeight = rootRect.height - MENU_POSITION_BOTTOM_MARGIN - (marginTop || 0);

    setWithScroll(menuMaxHeight < menuRect.height);
    setMenuStyle(`max-height: ${menuMaxHeight}px;`);
    setStyle(`left: ${left}px; top: ${top}px`);
    const offsetX = (anchorX + addedXForPortalPositioning - triggerRect.left) - left;
    const offsetY = (anchorY + addedYForPortalPositioning - triggerRect.top) - top - (marginTop || 0);
    setTransformOriginX(horizontalPosition === 'left' ? offsetX : menuRect.width + offsetX);
    setTransformOriginY(verticalPosition === 'bottom' ? menuRect.height + offsetY : offsetY);
  }, [
    anchor, getMenuElement, getRootElement, getTriggerElement, getLayout,
  ]);

  return {
    positionX,
    positionY,
    transformOriginX,
    transformOriginY,
    style,
    menuStyle,
    withScroll,
  };
}
