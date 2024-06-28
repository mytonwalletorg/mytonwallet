import type { RefObject } from 'react';
import React, {
  memo, useEffect, useRef, useState,
} from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ApiBaseCurrency } from '../../api/types';
import { SettingsState, type UserToken } from '../../global/types';

import { TONCOIN_SLUG } from '../../config';
import { bigintMultiplyToNumber } from '../../util/bigint';
import buildClassName from '../../util/buildClassName';
import { toDecimal } from '../../util/decimals';
import { formatCurrency, getShortCurrencySymbol } from '../../util/formatNumber';
import { isBetween } from '../../util/math';
import { ASSET_LOGO_PATHS } from '../ui/helpers/assetLogos';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import DeleteTokenModal from '../main/modals/DeleteTokenModal';
import AnimatedCounter from '../ui/AnimatedCounter';
import Draggable from '../ui/Draggable';
import Switcher from '../ui/Switcher';

import styles from './Settings.module.scss';

interface SortState {
  orderedTokenSlugs?: string[];
  dragOrderTokenSlugs?: string[];
  draggedIndex?: number;
}

interface OwnProps {
  parentContainer: RefObject<HTMLDivElement>;
  tokens?: UserToken[];
  orderedSlugs?: string[];
  isSortByValueEnabled?: boolean;
  baseCurrency?: ApiBaseCurrency;
}

const TOKEN_HEIGHT_PX = 64;
const TOP_OFFSET = 48;

function SettingsTokens({
  parentContainer,
  tokens,
  orderedSlugs,
  isSortByValueEnabled,
  baseCurrency,
}: OwnProps) {
  const {
    openSettingsWithState,
    sortTokens,
    toggleExceptionToken,
  } = getActions();
  const lang = useLang();
  const shortBaseSymbol = getShortCurrencySymbol(baseCurrency);

  // eslint-disable-next-line no-null/no-null
  const tokensRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const sortableContainerRef = useRef<HTMLDivElement>(null);

  const [tokenToDelete, setTokenToDelete] = useState<UserToken | undefined>();
  const [state, setState] = useState<SortState>({
    orderedTokenSlugs: orderedSlugs,
    dragOrderTokenSlugs: orderedSlugs,
    draggedIndex: undefined,
  });

  useEffect(() => {
    if (!arraysAreEqual(orderedSlugs, state.orderedTokenSlugs)) {
      setState({
        orderedTokenSlugs: orderedSlugs,
        dragOrderTokenSlugs: orderedSlugs,
        draggedIndex: undefined,
      });
    }
  }, [orderedSlugs, state.orderedTokenSlugs]);

  const handleOpenAddTokenPage = useLastCallback(() => {
    openSettingsWithState({ state: SettingsState.SelectTokenList });
  });

  const handleDrag = useLastCallback((translation: { x: number; y: number }, id: string | number) => {
    const delta = Math.round(translation.y / TOKEN_HEIGHT_PX);
    const index = state.orderedTokenSlugs?.indexOf(id as string) ?? 0;
    const dragOrderTokens = state.orderedTokenSlugs?.filter((tokenSlug) => tokenSlug !== id);

    if (!dragOrderTokens || !isBetween(index + delta, 0, orderedSlugs?.length ?? 0)) {
      return;
    }

    dragOrderTokens.splice(index + delta, 0, id as string);
    setState((current) => ({
      ...current,
      draggedIndex: index,
      dragOrderTokenSlugs: dragOrderTokens,
    }));
  });

  const handleDragEnd = useLastCallback(() => {
    setState((current) => {
      sortTokens({
        orderedSlugs: current.dragOrderTokenSlugs!,
      });

      return {
        ...current,
        orderedTokenSlugs: current.dragOrderTokenSlugs,
        draggedIndex: undefined,
      };
    });
  });

  const handleExceptionToken = useLastCallback((slug: string, e: React.MouseEvent | React.TouchEvent) => {
    if (slug === TONCOIN_SLUG) return;

    e.preventDefault();
    e.stopPropagation();
    toggleExceptionToken({ slug });
  });

  const handleDeleteToken = useLastCallback((token: UserToken, e: React.MouseEvent<HTMLSpanElement>) => {
    e.stopPropagation();
    setTokenToDelete(token);
  });

  function renderToken(token: UserToken, index: number) {
    const {
      symbol, image, name, amount, price, slug, isDisabled,
    } = token;

    const isToncoin = slug === TONCOIN_SLUG;
    const logoPath = image || ASSET_LOGO_PATHS[symbol.toLowerCase() as keyof typeof ASSET_LOGO_PATHS];
    const totalAmount = bigintMultiplyToNumber(amount, price);
    const isDragged = state.draggedIndex === index;

    const draggedTop = isSortByValueEnabled ? getOffsetByIndex(index) : getOffsetBySlug(slug, state.orderedTokenSlugs);
    const top = isSortByValueEnabled ? getOffsetByIndex(index) : getOffsetBySlug(slug, state.dragOrderTokenSlugs);

    const style = `top: ${isDragged ? draggedTop : top}px;`;
    const knobStyle = 'left: 1rem;';

    const isDeleteButtonVisible = amount === 0n && !isToncoin;

    const isDragDisabled = isSortByValueEnabled || tokens!.length <= 1;

    return (
      <Draggable
        key={slug}
        id={slug}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        style={style}
        knobStyle={knobStyle}
        isDisabled={isDragDisabled}
        className={buildClassName(styles.item, styles.item_token, !isSortByValueEnabled && styles.draggable)}
        offset={{ top: TOP_OFFSET }}
        parentRef={tokensRef}
        scrollRef={parentContainer}
        // eslint-disable-next-line react/jsx-no-bind
        onClick={(e) => handleExceptionToken(slug, e)}
      >
        <img
          src={logoPath}
          alt={symbol}
          className={styles.tokenIcon}
        />
        <div className={styles.tokenInfo}>
          <div className={styles.tokenTitle}>
            {name}
          </div>
          <div className={styles.tokenDescription}>
            <AnimatedCounter text={formatCurrency(toDecimal(totalAmount, token.decimals, true), shortBaseSymbol)} />
            <i className={styles.dot} aria-hidden />
            <AnimatedCounter text={formatCurrency(toDecimal(amount, token.decimals), symbol)} />
            {isDeleteButtonVisible && (
              <>
                <i className={styles.dot} aria-hidden />
                <span className={styles.deleteText} onClick={(e) => handleDeleteToken(token, e)}>
                  {lang('Delete')}
                </span>
              </>
            )}
          </div>
        </div>
        {!isToncoin && (
          <Switcher
            className={styles.menuSwitcher}
            checked={!isDisabled}
          />
        )}
      </Draggable>
    );
  }

  return (
    <>
      <p className={styles.blockTitle}>{lang('My Tokens')}</p>
      <div className={styles.contentRelative} ref={sortableContainerRef}>
        <div
          className={buildClassName(styles.settingsBlock, styles.sortableContainer)}
          style={`height: ${(tokens?.length ?? 0) * TOKEN_HEIGHT_PX + TOP_OFFSET}px`}
          ref={tokensRef}
        >
          <div className={buildClassName(styles.item, styles.item_small)} onClick={handleOpenAddTokenPage}>
            {lang('Add Token')}
            <i className={buildClassName(styles.iconChevronRight, 'icon-chevron-right')} aria-hidden />
          </div>

          {tokens?.map(renderToken)}
        </div>
      </div>

      <DeleteTokenModal token={tokenToDelete} />
    </>
  );
}

function arraysAreEqual<T>(arr1: T[] = [], arr2: T[] = []) {
  return arr1.length === arr2.length && arr1.every((value, index) => value === arr2[index]);
}

function getOffsetBySlug(slug: string, list: string[] = []) {
  const realIndex = list.indexOf(slug);
  const index = realIndex === -1 ? list.length : realIndex;
  return getOffsetByIndex(index);
}

function getOffsetByIndex(index: number) {
  return index * TOKEN_HEIGHT_PX + TOP_OFFSET;
}

export default memo(SettingsTokens);
