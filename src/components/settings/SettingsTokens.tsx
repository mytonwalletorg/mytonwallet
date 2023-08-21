import React, {
  memo, useEffect, useRef, useState,
} from '../../lib/teact/teact';

import type { UserToken } from '../../global/types';

import { DEFAULT_PRICE_CURRENCY, TON_TOKEN_SLUG } from '../../config';
import { getActions } from '../../global';
import buildClassName from '../../util/buildClassName';
import { formatCurrency } from '../../util/formatNumber';
import { isBetween } from '../../util/math';
import { ASSET_LOGO_PATHS } from '../ui/helpers/assetLogos';

import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import DeleteTokenModal from '../main/modals/DeleteTokenModal';
import AnimatedCounter from '../ui/AnimatedCounter';
import Draggable from '../ui/Draggable';
import Switcher from '../ui/Switcher';
import SelectTokens from './SelectTokens';

import styles from './Settings.module.scss';

interface SortState {
  orderedTokenSlugs?: string[];
  dragOrderTokenSlugs?: string[];
  draggedIndex?: number;
}

interface Position {
  top: number;
  right: number;
}

interface OwnProps {
  tokens?: UserToken[];
  popularTokens?: UserToken[];
  orderedSlugs?: string[];
  isSortByValueEnabled?: boolean;
}

const TOKEN_HEIGHT_PX = 64;
const TOP_OFFSET = 48;

function SettingsTokens({
  tokens, popularTokens, orderedSlugs, isSortByValueEnabled,
}: OwnProps) {
  const {
    sortTokens,
    toggleDisabledToken,
    addToken,
  } = getActions();
  const lang = useLang();

  // eslint-disable-next-line no-null/no-null
  const tokensRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const sortableContainerRef = useRef<HTMLDivElement>(null);

  const [isAddTokenModalOpen, openAddTokenModal, closeAddTokenModal] = useFlag();
  const [tokenToDelete, setTokenToDelete] = useState<UserToken | undefined>();
  const [state, setState] = useState<SortState>({
    orderedTokenSlugs: orderedSlugs,
    dragOrderTokenSlugs: orderedSlugs,
    draggedIndex: undefined,
  });
  const [sortableContainerPosition, setSortableContainerPosition] = useState<Position | undefined>();

  useEffect(() => {
    if (!arraysAreEqual(orderedSlugs, state.orderedTokenSlugs)) {
      setState({
        orderedTokenSlugs: orderedSlugs,
        dragOrderTokenSlugs: orderedSlugs,
        draggedIndex: undefined,
      });
    }
  }, [orderedSlugs, state.orderedTokenSlugs]);

  const handleOpenAddTokenModal = useLastCallback(() => {
    if (sortableContainerRef.current) {
      const { top, right } = sortableContainerRef.current.getBoundingClientRect();
      setSortableContainerPosition({
        top, right,
      });
    }

    openAddTokenModal();
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

  const handleDisabledToken = useLastCallback((slug: string) => {
    if (slug === TON_TOKEN_SLUG) return;

    toggleDisabledToken({ slug });
  });

  const handleDeleteToken = useLastCallback((token: UserToken, e: React.MouseEvent<HTMLSpanElement>) => {
    e.stopPropagation();
    setTokenToDelete(token);
  });

  const handleTokenSelect = useLastCallback((token: UserToken) => {
    addToken({ token });
  });

  function renderToken(token: UserToken, index: number) {
    const {
      symbol, image, name, amount, price, slug, isDisabled,
    } = token;

    const isTON = slug === TON_TOKEN_SLUG;
    const logoPath = image || ASSET_LOGO_PATHS[symbol.toLowerCase() as keyof typeof ASSET_LOGO_PATHS];
    const totalAmount = amount * price;
    const isDragged = state.draggedIndex === index;

    const draggedTop = getOrderIndex(slug, state.orderedTokenSlugs);
    const top = getOrderIndex(slug, state.dragOrderTokenSlugs);

    const style = `top: ${isDragged ? draggedTop : top}px;`;
    const knobStyle = 'left: 1rem;';

    const isDeleteButtonVisible = amount === 0 && !isTON;

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
        className={buildClassName(styles.item, styles.item_token)}
        offset={{ top: TOP_OFFSET }}
        parentRef={tokensRef}
        // eslint-disable-next-line react/jsx-no-bind
        onClick={() => handleDisabledToken(slug)}
      >
        <img src={logoPath} alt={symbol} className={styles.tokenIcon} />
        <div className={styles.tokenInfo}>
          <div className={styles.tokenTitle}>
            {name}
          </div>
          <div className={styles.tokenDescription}>
            <AnimatedCounter text={formatCurrency(totalAmount, DEFAULT_PRICE_CURRENCY)} />
            <i className={styles.dot} aria-hidden />
            <AnimatedCounter text={formatCurrency(amount, symbol)} />
            {isDeleteButtonVisible && (
              <>
                <i className={styles.dot} aria-hidden />
                <span className={styles.deleteText} onClick={(e) => handleDeleteToken(token, e)}>Delete</span>
              </>
            )}
          </div>
        </div>
        {!isTON && (
          <Switcher
            className={styles.menuSwitcher}
            label={lang('Investor View')}
            checked={!isDisabled}
            // eslint-disable-next-line react/jsx-no-bind
            onCheck={() => handleDisabledToken(slug)}
          />
        )}
      </Draggable>
    );
  }

  return (
    <>
      <p className={styles.blockTitle}>{lang('Your Tokens')}</p>
      <div className={styles.contentRelative} ref={sortableContainerRef}>
        <div
          className={buildClassName(styles.settingsBlock, styles.sortableContainer)}
          style={`height: ${(tokens?.length ?? 0) * TOKEN_HEIGHT_PX + TOP_OFFSET}px`}
          ref={tokensRef}
        >
          <div className={buildClassName(styles.item, styles.item_small)} onClick={handleOpenAddTokenModal}>
            {lang('Add Token')}
            <i className={buildClassName(styles.iconChevronRight, 'icon-chevron-down')} aria-hidden />
          </div>

          {tokens?.map(renderToken)}
        </div>

        <SelectTokens
          position={sortableContainerPosition}
          isOpen={isAddTokenModalOpen}
          onClose={closeAddTokenModal}
          tokens={popularTokens}
          onSelect={handleTokenSelect}
        />
      </div>

      <DeleteTokenModal token={tokenToDelete} />
    </>
  );
}

function arraysAreEqual<T>(arr1: T[] = [], arr2: T[] = []) {
  return arr1.length === arr2.length && arr1.every((value, index) => value === arr2[index]);
}

function getOrderIndex(slug: string, list: string[] = []) {
  const realIndex = list.indexOf(slug);
  const index = realIndex === -1 ? list.length : realIndex;
  return index * TOKEN_HEIGHT_PX + TOP_OFFSET;
}

export default memo(SettingsTokens);
