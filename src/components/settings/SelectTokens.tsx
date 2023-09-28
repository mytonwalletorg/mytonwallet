import React, {
  memo, useEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { UserToken } from '../../global/types';

import buildClassName from '../../util/buildClassName';
import captureEscKeyListener from '../../util/captureEscKeyListener';
import { formatCurrencyForBigValue, formatInteger } from '../../util/formatNumber';
import { getIsAddressValid } from '../../util/getIsAddressValid';
import { REM } from '../../util/windowEnvironment';
import { ASSET_LOGO_PATHS } from '../ui/helpers/assetLogos';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useScrolledState from '../../hooks/useScrolledState';
import useShowTransition from '../../hooks/useShowTransition';

import Portal from '../ui/Portal';
import Transition from '../ui/Transition';

import styles from './Settings.module.scss';

interface OwnProps {
  isOpen: boolean;
  type?: 'price' | 'balance';
  shouldFilter?: boolean;
  tokens?: UserToken[];
  position?: {
    top: number;
    right: number;
    left: number;
    width: number;
  };
  offset?: {
    top: number;
    left: number;
    right: number;
    bottom: number;
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

const DEFAULT_OFFSET = {
  top: 0.25 * REM,
  right: 0.5 * REM,
  bottom: REM,
  left: 0,
};

function SelectTokens({
  token,
  type = 'price',
  shouldFilter = false,
  tokens,
  isOpen,
  isLoading,
  position,
  offset = DEFAULT_OFFSET,
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
      const isTop = window.innerHeight > top + componentHeight;
      const verticalStyle = isTop
        ? `top: ${top + offset.top}px;`
        : `top: calc(100% - ${componentHeight + offset.bottom}px);`;

      setStyle(`${verticalStyle} left: ${(right - componentWidth) - offset.right}px;`);
    }
  }, [position, offset]);

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

  const filteredTokenList = useMemo(() => tokens?.filter((t) => !t.isDisabled).filter(
    ({ symbol, keywords }) => {
      const isSymbol = symbol.toLowerCase().includes(searchValue.toLowerCase());
      const isKeyword = keywords?.find((key) => key.toLowerCase().includes(searchValue.toLowerCase()));
      return isSymbol || isKeyword;
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

  const popularTokenList = useMemo(() => filteredTokenList.map((t) => {
    const image = t?.image ?? ASSET_LOGO_PATHS[t?.symbol.toLowerCase() as keyof typeof ASSET_LOGO_PATHS];
    const isAvailable = !shouldFilter;
    const value = isAvailable
      ? type === 'price'
        ? formatCurrencyForBigValue(t.price)
        : formatInteger(t.amount)
      : lang('Unavailable');
    const handleClick = isAvailable ? () => handleTokenClick(t) : undefined;
    return (
      <div className={styles.addTokenItem} key={t.slug} onClick={handleClick}>
        <LazyImage symbol={t.symbol} image={image} isAvailable={isAvailable} />
        <div className={styles.addTokenText}>
          <span className={buildClassName(
            styles.addTokenSymbol,
            !isAvailable && styles.addTokenSymbol_disabled,
          )}
          >{t.symbol}
          </span>
          <span className={buildClassName(
            styles.addTokenPrice,
            !isAvailable && styles.addTokenPrice_disabled,
          )}
          >{value}
          </span>
        </div>
      </div>
    );
  }), [filteredTokenList, handleTokenClick, type, lang, shouldFilter]);

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
              <i className={buildClassName('icon-ton', styles.emptyIcon)} aria-hidden />
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

function LazyImage({ symbol, image, isAvailable }: { symbol: string; image: string; isAvailable?: boolean }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isImageVisible, setIsImageVisible] = useState(true);
  const [firstLetter] = symbol;

  return (
    <>
      {isImageVisible && (
        <img
          loading="lazy"
          src={image}
          alt={symbol}
          className={buildClassName(
            styles.addTokenIcon,
            !isAvailable && styles.addTokenIcon_disabled,
          )}
          onLoad={() => setIsLoading(false)}
          onError={() => setIsImageVisible(false)}
        />
      )}
      {isLoading && (
        <div className={buildClassName(
          styles.addTokenIcon,
          styles.addTokenIcon_symbol,
          !isAvailable && styles.addTokenIcon_disabled,
        )}
        >
          <span className={styles.addTokenIconLetter}>{firstLetter}</span>
        </div>
      )}
    </>
  );
}

export default memo(withGlobal((global): StateProps => {
  const { isLoading, token } = global.settings.importToken ?? {};

  return {
    isLoading,
    token,
  };
})(SelectTokens));
