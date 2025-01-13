import React, {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiBaseCurrency } from '../../api/types';
import {
  type AssetPairs, SettingsState, type UserSwapToken, type UserToken,
} from '../../global/types';

import {
  ANIMATED_STICKER_MIDDLE_SIZE_PX, TON_USDT_SLUG, TRC20_USDT_MAINNET_SLUG, TRC20_USDT_TESTNET_SLUG,
} from '../../config';
import {
  selectAvailableUserForSwapTokens,
  selectIsMultichainAccount,
  selectPopularTokens,
  selectSwapTokens,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { toDecimal } from '../../util/decimals';
import { formatCurrency, getShortCurrencySymbol } from '../../util/formatNumber';
import { isValidAddressOrDomain } from '../../util/isValidAddressOrDomain';
import { disableSwipeToClose, enableSwipeToClose } from '../../util/modalSwipeManager';
import getChainNetworkName from '../../util/swap/getChainNetworkName';
import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';

import useFocusAfterAnimation from '../../hooks/useFocusAfterAnimation';
import useHistoryBack from '../../hooks/useHistoryBack';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useScrolledState from '../../hooks/useScrolledState';
import useSyncEffect from '../../hooks/useSyncEffect';

import AnimatedIconWithPreview from '../ui/AnimatedIconWithPreview';
import ModalHeader from '../ui/ModalHeader';
import Transition from '../ui/Transition';
import TokenIcon from './TokenIcon';

import styles from './TokenSelector.module.scss';

type Token = UserToken | UserSwapToken;

type TokenSortFactors = {
  tickerExactMatch: number;
  tickerMatchLength: number;
  nameMatchLength: number;
  specialOrder: number;
};

interface StateProps {
  token?: Token;
  userTokens?: Token[];
  popularTokens?: Token[];
  swapTokens?: UserSwapToken[];
  tokenInSlug?: string;
  pairsBySlug?: Record<string, AssetPairs>;
  baseCurrency?: ApiBaseCurrency;
  isLoading?: boolean;
  isMultichain: boolean;
}

interface OwnProps {
  isActive?: boolean;
  shouldFilter?: boolean;
  isInsideSettings?: boolean;
  onClose: NoneToVoidFunction;
  onBack: NoneToVoidFunction;
  shouldHideMyTokens?: boolean;
  shouldHideNotSupportedTokens?: boolean;
}

enum SearchState {
  Initial,
  Search,
  Loading,
  Token,
  Empty,
}

const EMPTY_ARRAY: Token[] = [];

function TokenSelector({
  token,
  userTokens,
  swapTokens,
  popularTokens: popularTokensProp,
  shouldFilter,
  isInsideSettings,
  baseCurrency,
  tokenInSlug,
  pairsBySlug,
  isActive,
  isLoading,
  onBack,
  onClose,
  shouldHideMyTokens,
  shouldHideNotSupportedTokens,
  isMultichain,
}: OwnProps & StateProps) {
  const {
    importToken,
    resetImportToken,
    openSettingsWithState,
    setSwapTokenIn,
    setSwapTokenOut,
    addToken,
    addSwapToken,
  } = getActions();
  const lang = useLang();

  const shortBaseSymbol = getShortCurrencySymbol(baseCurrency);

  // eslint-disable-next-line no-null/no-null
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line no-null/no-null
  const searchInputRef = useRef<HTMLInputElement>(null);

  useHistoryBack({
    isActive,
    onBack,
  });

  useEffect(() => {
    if (!isActive) return undefined;

    disableSwipeToClose();

    return enableSwipeToClose;
  }, [isActive]);

  useFocusAfterAnimation(searchInputRef, !isActive);

  const {
    handleScroll: handleContentScroll,
  } = useScrolledState();

  const [searchValue, setSearchValue] = useState('');
  const [isResetButtonVisible, setIsResetButtonVisible] = useState(false);
  const [renderingKey, setRenderingKey] = useState(SearchState.Initial);
  const [searchTokenList, setSearchTokenList] = useState<Token[]>([]);

  // It is necessary to use useCallback instead of useLastCallback here
  const filterTokens = useCallback((tokens: Token[]) => {
    return filterAndSortTokens(tokens, isMultichain, tokenInSlug, pairsBySlug);
  }, [pairsBySlug, tokenInSlug, isMultichain]);

  const allUnimportedTonTokens = useMemo(() => {
    return (swapTokens ?? EMPTY_ARRAY).filter(
      (popularToken) => 'chain' in popularToken && popularToken.chain === 'ton',
    );
  }, [swapTokens]);

  const popularTokens = useMemo(() => {
    if (shouldHideNotSupportedTokens) {
      return popularTokensProp?.filter(
        (popularToken) => 'chain' in popularToken && popularToken.chain === 'ton',
      );
    }

    return popularTokensProp;
  }, [popularTokensProp, shouldHideNotSupportedTokens]);

  const { userTokensWithFilter, popularTokensWithFilter, swapTokensWithFilter } = useMemo(() => {
    const currentUserTokens = userTokens ?? EMPTY_ARRAY;
    const currentSwapTokens = swapTokens ?? EMPTY_ARRAY;
    const currentPopularTokens = popularTokens ?? EMPTY_ARRAY;
    if (!shouldFilter) {
      return {
        userTokensWithFilter: currentUserTokens,
        popularTokensWithFilter: currentPopularTokens,
        swapTokensWithFilter: currentSwapTokens,
      };
    }

    const filteredPopularTokens = filterTokens(currentPopularTokens);
    const filteredUserTokens = filterTokens(currentUserTokens);
    const filteredSwapTokens = filterTokens(currentSwapTokens);

    return {
      userTokensWithFilter: filteredUserTokens,
      popularTokensWithFilter: filteredPopularTokens,
      swapTokensWithFilter: filteredSwapTokens,
    };
  }, [filterTokens, popularTokens, shouldFilter, swapTokens, userTokens]);

  const filteredTokenList = useMemo(() => {
    const tokensToFilter = isInsideSettings ? allUnimportedTonTokens : swapTokensWithFilter;
    const untrimmedSearchValue = searchValue.toLowerCase();
    const lowerCaseSearchValue = untrimmedSearchValue.trim();

    if (untrimmedSearchValue.length && !lowerCaseSearchValue.length) {
      return [];
    }

    const filteredTokens = tokensToFilter.filter(({
      name, symbol, keywords, isDisabled,
    }) => {
      if (isDisabled) {
        return false;
      }

      const isName = name.toLowerCase().includes(lowerCaseSearchValue);
      const isSymbol = symbol.toLowerCase().includes(lowerCaseSearchValue);
      const isKeyword = keywords?.some((key) => key.toLowerCase().includes(lowerCaseSearchValue));

      return isName || isSymbol || isKeyword;
    }) ?? [];

    const sortFactors = filteredTokens.reduce((acc, searchResultToken) => {
      const factors = {
        tickerExactMatch: 0,
        tickerMatchLength: 0,
        nameMatchLength: 0,
        specialOrder: 0, // The higher the value, the higher the position
      };

      const tokenSymbol = searchResultToken.symbol.toLowerCase();
      const tokenName = searchResultToken.name.toLowerCase();

      if (tokenSymbol === lowerCaseSearchValue) {
        factors.tickerExactMatch = 1;
      }

      if (tokenSymbol.includes(lowerCaseSearchValue)) {
        factors.tickerMatchLength = lowerCaseSearchValue.length;
      }

      if (tokenName.includes(lowerCaseSearchValue)) {
        factors.nameMatchLength = lowerCaseSearchValue.length;
      }

      if (searchResultToken.slug === TON_USDT_SLUG) {
        factors.specialOrder = 2;
      }

      if (searchResultToken.slug === TRC20_USDT_MAINNET_SLUG || searchResultToken.slug === TRC20_USDT_TESTNET_SLUG) {
        factors.specialOrder = 1;
      }

      acc[searchResultToken.slug] = factors;

      return acc;
    }, {} as Record<string, TokenSortFactors>);

    return filteredTokens.sort((a, b) => {
      const factorA = sortFactors[a.slug];
      const factorB = sortFactors[b.slug];
      const comparisonResult = compareTokens(factorA, factorB);
      if (comparisonResult !== 0) return comparisonResult;

      return Number(b.amount - a.amount);
    });
  }, [allUnimportedTonTokens, isInsideSettings, searchValue, swapTokensWithFilter]);

  const resetSearch = () => {
    setSearchValue('');
  };

  useSyncEffect(() => {
    setIsResetButtonVisible(Boolean(searchValue.length));

    const isValidAddress = isValidAddressOrDomain(searchValue, 'ton');
    let newRenderingKey = SearchState.Initial;

    if (isLoading && isValidAddress) {
      newRenderingKey = SearchState.Loading;
    } else if (token && isValidAddress) {
      newRenderingKey = SearchState.Token;
    } else if (searchValue.length && filteredTokenList.length !== 0) {
      newRenderingKey = SearchState.Search;
    } else if (filteredTokenList.length === 0) {
      newRenderingKey = SearchState.Empty;
    }

    setRenderingKey(newRenderingKey);

    if (newRenderingKey !== SearchState.Initial) {
      setSearchTokenList(filteredTokenList);
    }
  }, [searchTokenList.length, isLoading, searchValue, token, filteredTokenList]);

  useEffect(() => {
    if (isValidAddressOrDomain(searchValue, 'ton')) {
      importToken({ address: searchValue, isSwap: true });
      setRenderingKey(SearchState.Loading);
    } else {
      resetImportToken();
    }
  }, [searchValue]);

  useLayoutEffect(() => {
    if (!isActive || !scrollContainerRef.current) return;

    scrollContainerRef.current.scrollTop = 0;
  }, [isActive]);

  const handleTokenClick = useLastCallback((selectedToken: Token) => {
    searchInputRef.current?.blur();

    if (isInsideSettings) {
      addToken({ token: selectedToken as UserToken });
    } else {
      addSwapToken({ token: selectedToken as UserSwapToken });
      const setToken = shouldFilter ? setSwapTokenOut : setSwapTokenIn;
      setToken({ tokenSlug: selectedToken.slug });
    }

    resetSearch();

    onBack();
  });

  const handleOpenSettings = useLastCallback(() => {
    onClose();
    openSettingsWithState({ state: SettingsState.Assets });
  });

  function renderSearch() {
    return (
      <div className={styles.tokenSelectInputWrapper}>
        <i className={buildClassName(styles.tokenSelectSearchIcon, 'icon-search')} aria-hidden />
        <input
          ref={searchInputRef}
          name="token-search-modal"
          className={styles.tokenSelectInput}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder={lang('Name or Address...')}
          value={searchValue}
        />
        <Transition
          name="fade"
          activeKey={isResetButtonVisible ? 0 : 1}
          className={styles.tokenSelectSearchResetWrapper}
        >
          {isResetButtonVisible && (
            <button
              type="button"
              className={styles.tokenSelectSearchReset}
              aria-label={lang('Clear')}
              onClick={resetSearch}
            >
              <i className={buildClassName(styles.tokenSelectSearchResetIcon, 'icon-close')} aria-hidden />
            </button>
          )}
        </Transition>
      </div>
    );
  }

  function renderToken(currentToken: Token) {
    const blockchain = 'chain' in currentToken ? currentToken.chain : 'ton';

    const isAvailable = !shouldFilter || currentToken.canSwap;
    const descriptionText = isAvailable
      ? getChainNetworkName(blockchain)
      : lang('Unavailable');
    const handleClick = isAvailable ? () => handleTokenClick(currentToken) : undefined;

    const tokenPrice = currentToken.price === 0
      ? lang('No Price')
      : formatCurrency(currentToken.price, shortBaseSymbol, undefined, true);

    return (
      <div
        key={currentToken.slug}
        className={buildClassName(
          styles.tokenContainer,
          !isAvailable && styles.tokenContainerDisabled,
        )}
        onClick={handleClick}
      >
        <div className={styles.tokenLogoContainer}>
          <TokenIcon
            token={currentToken}
            withChainIcon
            className={buildClassName(styles.tokenLogo, !isAvailable && styles.tokenLogoDisabled)}
          />

          <div className={styles.nameContainer}>
            <span className={buildClassName(styles.tokenName, !isAvailable && styles.tokenTextDisabled)}>
              {currentToken.name}
            </span>
            <span
              className={buildClassName(
                styles.tokenNetwork,
                !isAvailable && styles.tokenTextDisabled,
              )}
            >
              {descriptionText}
            </span>
          </div>
        </div>
        <div className={styles.tokenPriceContainer}>
          <span className={buildClassName(
            styles.tokenAmount,
            !isAvailable && styles.tokenTextDisabled,
          )}
          >
            {formatCurrency(toDecimal(currentToken.amount, currentToken?.decimals), currentToken.symbol)}
          </span>
          <span className={buildClassName(
            styles.tokenValue,
            !isAvailable && styles.tokenTextDisabled,
          )}
          >
            {tokenPrice}
          </span>
        </div>
      </div>
    );
  }

  function renderTokenGroup(tokens: Token[], title: string, shouldShowSettings?: boolean) {
    return (
      <div className={styles.tokenGroupContainer}>
        <div className={styles.tokenGroupHeader}>
          <span className={styles.tokenGroupTitle}>{title}</span>
          {shouldShowSettings && (
            <span
              className={styles.tokenGroupAdditionalTitle}
              onClick={handleOpenSettings}
            >
              {lang('Settings')}
            </span>
          )}
        </div>
        {tokens.map(renderToken)}
      </div>
    );
  }

  function renderAllTokens(tokens: Token[]) {
    return (
      <div className={styles.tokenGroupContainer}>
        {tokens.map(renderToken)}
      </div>
    );
  }

  function renderTokenSkeleton() {
    return (
      <div className={buildClassName(styles.tokenContainer, styles.tokenContainerDisabled)}>
        <div className={styles.tokenLogoContainer}>
          <div className={styles.logoContainer}>
            <div className={styles.tokenLogoSkeleton} />
            <div className={styles.tokenNetworkLogoSkeleton} />
          </div>
          <div className={styles.nameContainer}>
            <span className={styles.tokenNameSkeleton} />
            <span className={styles.tokenValueSkeleton} />
          </div>
        </div>
        <div className={styles.tokenPriceContainer}>
          <span className={buildClassName(styles.tokenNameSkeleton, styles.rotateSkeleton)} />
          <span className={styles.tokenValueSkeleton} />
        </div>
      </div>
    );
  }

  function renderNotFound(shouldPlay: boolean) {
    return (
      <div className={styles.tokenNotFound}>
        <AnimatedIconWithPreview
          play={shouldPlay}
          tgsUrl={ANIMATED_STICKERS_PATHS.noData}
          previewUrl={ANIMATED_STICKERS_PATHS.noDataPreview}
          size={ANIMATED_STICKER_MIDDLE_SIZE_PX}
          noLoop={false}
          nonInteractive
        />
        <span className={styles.tokenNotFoundTitle}>{lang('Not Found')}</span>
        <span className={styles.tokenNotFoundDesc}>{lang('Try another keyword or address.')}</span>
      </div>
    );
  }

  function renderSearchResults(tokenToImport?: Token) {
    if (tokenToImport) {
      return (
        <div className={styles.tokenGroupContainer}>
          {renderToken(tokenToImport)}
        </div>
      );
    }

    return (
      <>
        {renderTokenSkeleton()}
        {renderTokenSkeleton()}
        {renderTokenSkeleton()}
        {renderTokenSkeleton()}
        {renderTokenSkeleton()}
      </>
    );
  }

  function renderTokenGroups() {
    return (
      <>
        {!shouldHideMyTokens && renderTokenGroup(userTokensWithFilter, lang('MY'), true)}
        {renderTokenGroup(popularTokensWithFilter, lang('POPULAR'))}
      </>
    );
  }

  // eslint-disable-next-line consistent-return
  function renderContent(isContentActive: boolean, isFrom: boolean, currentKey: number) {
    switch (currentKey) {
      case SearchState.Initial:
        return renderTokenGroups();
      case SearchState.Loading:
        return renderSearchResults();
      case SearchState.Search:
        return renderAllTokens(searchTokenList);
      case SearchState.Token:
        return renderSearchResults(token);
      case SearchState.Empty:
        return renderNotFound(isContentActive);
    }
  }

  return (
    <>
      <ModalHeader title={lang('Select Token')} onBackButtonClick={onBack} onClose={onClose} />
      {renderSearch()}

      <div
        className={buildClassName(
          styles.tokenSelectContent,
          'custom-scroll',
        )}
        onScroll={handleContentScroll}
        ref={scrollContainerRef}
      >
        <Transition
          name="fade"
          activeKey={renderingKey}
        >
          {renderContent}
        </Transition>
      </div>
    </>
  );
}

export default memo(withGlobal<OwnProps>((global): StateProps => {
  const { baseCurrency } = global.settings;
  const { isLoading, token } = global.settings.importToken ?? {};
  const { pairs: pairsBySlug, tokenInSlug } = global.currentSwap ?? {};
  const userTokens = selectAvailableUserForSwapTokens(global);
  const popularTokens = selectPopularTokens(global);
  const swapTokens = selectSwapTokens(global);
  const isMultichain = selectIsMultichainAccount(global, global.currentAccountId!);

  return {
    baseCurrency,
    isLoading,
    token,
    pairsBySlug: pairsBySlug?.bySlug,
    tokenInSlug,
    userTokens,
    popularTokens,
    swapTokens,
    isMultichain,
  };
})(TokenSelector));

function filterAndSortTokens(
  tokens: Token[],
  isMultichain: boolean,
  tokenInSlug?: string,
  pairsBySlug?: Record<string, AssetPairs>,
) {
  if (!tokens.length || !tokenInSlug) return [];

  return tokens.map((token) => {
    const pair = pairsBySlug?.[tokenInSlug]?.[token.slug];
    const canSwap = Boolean(isMultichain ? pair : (pair && !pair.isMultichain));
    return { ...token, canSwap };
  }).sort((a, b) => Number(b.canSwap) - Number(a.canSwap));
}

function compareTokens(a: TokenSortFactors, b: TokenSortFactors) {
  if (a.specialOrder !== b.specialOrder) {
    return b.specialOrder - a.specialOrder;
  }
  if (a.tickerExactMatch !== b.tickerExactMatch) {
    return b.tickerExactMatch - a.tickerExactMatch;
  }
  if (a.tickerMatchLength !== b.tickerMatchLength) {
    return b.tickerMatchLength - a.tickerMatchLength;
  }
  return b.nameMatchLength - a.nameMatchLength;
}
