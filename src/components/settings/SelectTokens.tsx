import React, {
  memo, useEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';

import type { UserToken } from '../../global/types';

import { getActions, withGlobal } from '../../global';
import buildClassName from '../../util/buildClassName';
import captureEscKeyListener from '../../util/captureEscKeyListener';
import { formatCurrencyForBigValue } from '../../util/formatNumber';
import { getIsAddressValid } from '../../util/getIsAddressValid';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useScrolledState from '../../hooks/useScrolledState';
import useShowTransition from '../../hooks/useShowTransition';

import Portal from '../ui/Portal';
import Transition from '../ui/Transition';

import styles from './Settings.module.scss';

interface OwnProps {
  isOpen: boolean;
  tokens?: UserToken[];
  position?: {
    top: number;
    right: number;
    left: number;
    width: number;
  };
  onClose: NoneToVoidFunction;
  onSelect: (token: UserToken) => void;
}

interface StateProps {
  token?: UserToken;
  isLoading?: boolean;
}

enum SearchState {
  Popular,
  Loading,
  Token,
  Empty,
}

const SLIDE_ANIMATION_DURATION_MS = 250;

const OFFSET_TOP = 4;
const OFFSET_RIGHT = 8;
const OFFSET_BOTTOM = 16;

function SelectTokens({
  token,
  tokens,
  isOpen,
  isLoading,
  position,
  onClose,
  onSelect,
}: OwnProps & StateProps) {
  const {
    importToken,
    resetImportToken,
  } = getActions();
  const lang = useLang();

  const { shouldRender, transitionClassNames } = useShowTransition(isOpen);
  const [searchValue, setSearchValue] = useState('');
  const [style, setStyle] = useState<string | undefined>();
  const [renderingKey, setRenderingKey] = useState(SearchState.Popular);

  // eslint-disable-next-line no-null/no-null
  const elementRef = useRef<HTMLDivElement | null>(null);
  const isImportingRef = useRef(false);

  const {
    handleScroll: handleContentScroll,
    isAtBeginning: isContentNotScrolled,
  } = useScrolledState();

  useEffect(() => {
    if (!elementRef.current) return;

    if (position) {
      const {
        top, right,
      } = position;

      const { width: componentWidth, height: componentHeight } = elementRef.current.getBoundingClientRect();
      const isTop = window.innerHeight > top + componentWidth;
      const verticalStyle = isTop
        ? `top: ${top + OFFSET_TOP}px;`
        : `top: calc(100% - ${componentHeight + OFFSET_BOTTOM}px);`;

      setStyle(`${verticalStyle} left: ${(right - componentWidth) - OFFSET_RIGHT}px;`);
    }
  }, [position]);

  useEffect(
    () => (shouldRender ? captureEscKeyListener(onClose) : undefined),
    [onClose, shouldRender],
  );

  useEffect(() => {
    setSearchValue('');
    resetImportToken();
  }, [shouldRender]);

  useEffect(() => {
    if (getIsAddressValid(searchValue)) {
      isImportingRef.current = true;
      importToken({ address: searchValue });
    } else {
      resetImportToken();
    }
  }, [importToken, searchValue]);

  const filteredTokenList = useMemo(() => tokens?.filter(
    ({ name, symbol, keywords }) => {
      const isName = name.toLowerCase().includes(searchValue.toLowerCase());
      const isSymbol = symbol.toLowerCase().includes(searchValue.toLowerCase());
      const isKeyword = keywords?.find((key) => key.toLowerCase().includes(searchValue.toLowerCase()));
      return isName || isSymbol || isKeyword;
    },
  ) ?? [], [tokens, searchValue]);

  useEffect(() => {
    const isImporting = isLoading || isImportingRef.current;

    if (isImporting && getIsAddressValid(searchValue)) {
      isImportingRef.current = false;
      setRenderingKey(SearchState.Loading);
    } else if (token && getIsAddressValid(searchValue)) {
      setRenderingKey(SearchState.Token);
    } else if (filteredTokenList.length === 0) {
      setRenderingKey(SearchState.Empty);
    } else {
      setRenderingKey(SearchState.Popular);
    }
  }, [token, isLoading, filteredTokenList, searchValue]);

  const handleTokenClick = useLastCallback((selectedToken: UserToken) => {
    onClose();
    setTimeout(() => {
      onSelect(selectedToken);
    }, SLIDE_ANIMATION_DURATION_MS);
  });

  const popularTokenList = useMemo(() => filteredTokenList.map((t) => (
    <div className={styles.addTokenItem} key={t.slug} onClick={() => handleTokenClick(t)}>
      <img src={t.image} alt={t.symbol} className={styles.addTokenIcon} />
      <div className={styles.addTokenText}>
        <span className={styles.addTokenSymbol}>{t.symbol}</span>
        <span className={styles.addTokenPrice}>{formatCurrencyForBigValue(t.price)}</span>
      </div>
    </div>
  )), [filteredTokenList, handleTokenClick]);

  // eslint-disable-next-line consistent-return
  function renderContent(isActive: boolean, isFrom: boolean, currentKey: number) {
    const { image, symbol } = token ?? {};

    let content;

    switch (currentKey) {
      case SearchState.Popular:
        content = popularTokenList;
        break;
      case SearchState.Loading:
        content = (
          <div className={styles.addTokenItem}>
            <div className={buildClassName(styles.addTokenIcon, styles.addTokenIcon_loading)} />
            <div className={styles.addTokenText}>
              <span className={buildClassName(styles.addTokenSymbol, styles.addTokenSymbol_loading)} />
              <span className={buildClassName(styles.addTokenPrice, styles.addTokenPrice_loading)} />
            </div>
          </div>
        );
        break;
      case SearchState.Token:
        content = (
          <div className={styles.addTokenItem} onClick={() => handleTokenClick(token!)}>
            <img src={image} alt={symbol} className={styles.addTokenIcon} />
            <div className={styles.addTokenText}>
              <span className={styles.addTokenSymbol}>{symbol}</span>
              <span className={styles.addTokenPrice}>{formatCurrencyForBigValue(0)}</span>
            </div>
          </div>
        );
        break;
      case SearchState.Empty:
        content = (
          <div className={styles.addTokenItem}>
            <div className={buildClassName(styles.addTokenIcon, styles.addTokenIcon_empty)}>
              <i className={buildClassName('icon-ton', styles.emptyIcon)} />
            </div>
            <div className={styles.addTokenText}>
              <span className={buildClassName(styles.addTokenSymbol, styles.addTokenSymbol_gray)}>
                {lang('Token Not Found')}
              </span>
              <span className={buildClassName(styles.addTokenPrice, styles.addTokenPrice_gray)}>
                {lang('Try another keyword or address.')}
              </span>
            </div>
          </div>
        );
        break;
    }

    const isSingle = currentKey !== SearchState.Popular || popularTokenList.length === 1;

    return (
      <div className={styles.addTokenContentWrapper}>
        <div
          className={buildClassName(
            styles.addTokenContent,
            isSingle && styles.addTokenContent_single,
            'custom-scroll',
          )}
          onScroll={handleContentScroll}
        >
          {content}
        </div>
      </div>
    );
  }

  const fullClassName = buildClassName(
    styles.addTokenDialog,
    transitionClassNames,
  );

  return shouldRender && (
    <Portal>
      <div
        ref={elementRef}
        className={fullClassName}
        style={style}
      >
        <div className={styles.backdrop} onClick={onClose} />
        <div className={styles.addTokenBlock}>
          <div className={buildClassName(
            styles.addTokenSearch,
            !isContentNotScrolled && styles.addTokenSearch_bordered,
          )}
          >
            <div className={styles.addTokenInputWrapper}>
              <i className={buildClassName(styles.icon, 'icon-search')} aria-hidden />
              <input
                placeholder={lang('Name or Address...')}
                className={styles.addTokenInput}
                onChange={(e) => setSearchValue(e.target.value)}
                value={searchValue}
              />
            </div>
          </div>
          <Transition
            name="fade"
            activeKey={renderingKey}
            className={styles.addTokenTransition}
          >
            {renderContent}
          </Transition>
        </div>
      </div>
    </Portal>
  );
}

export default memo(withGlobal((global): StateProps => {
  const { isLoading, token } = global.settings.importToken ?? {};

  return {
    isLoading,
    token,
  };
})(SelectTokens));
