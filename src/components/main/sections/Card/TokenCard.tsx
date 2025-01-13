import type { TeactNode } from '../../../../lib/teact/teact';
import React, { memo, useMemo, useState } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiBaseCurrency, ApiStakingState } from '../../../../api/types';
import type { PriceHistoryPeriods, TokenPeriod, UserToken } from '../../../../global/types';

import { DEFAULT_PRICE_CURRENCY, HISTORY_PERIODS, TONCOIN } from '../../../../config';
import { selectAccountStakingStates, selectCurrentAccountState } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { vibrate } from '../../../../util/capacitor';
import { formatShortDay, SECOND } from '../../../../util/dateFormat';
import { toBig, toDecimal } from '../../../../util/decimals';
import { formatCurrency, getShortCurrencySymbol } from '../../../../util/formatNumber';
import { round } from '../../../../util/round';
import { getExplorerName, getExplorerTokenUrl } from '../../../../util/url';
import { IS_IOS } from '../../../../util/windowEnvironment';
import { ASSET_LOGO_PATHS } from '../../../ui/helpers/assetLogos';
import { calculateTokenCardColor } from '../../helpers/cardColors';

import useFlag from '../../../../hooks/useFlag';
import useForceUpdate from '../../../../hooks/useForceUpdate';
import useInterval from '../../../../hooks/useInterval';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import useSyncEffect from '../../../../hooks/useSyncEffect';
import useTimeout from '../../../../hooks/useTimeout';

import TokenPriceChart from '../../../common/TokenPriceChart';
import Button from '../../../ui/Button';
import Spinner from '../../../ui/Spinner';
import Transition from '../../../ui/Transition';
import ChartHistorySwitcher from './ChartHistorySwitcher';
import CurrencySwitcher from './CurrencySwitcher';

import styles from './Card.module.scss';

import tonUrl from '../../../../assets/coins/ton.svg';

interface OwnProps {
  token: UserToken;
  classNames: string;
  isUpdating?: boolean;
  onYieldClick: (stakingId?: string) => void;
  onClose: NoneToVoidFunction;
}

interface StateProps {
  period?: TokenPeriod;
  baseCurrency?: ApiBaseCurrency;
  historyPeriods?: PriceHistoryPeriods;
  tokenAddress?: string;
  isTestnet?: boolean;
  stakingStates?: ApiStakingState[];
}

const OFFLINE_TIMEOUT = 120000; // 2 minutes

const CHART_DIMENSIONS = { width: 300, height: 64 };
const INTERVAL = 5 * SECOND;

const DEFAULT_PERIOD = HISTORY_PERIODS[0];

function TokenCard({
  isTestnet,
  token,
  classNames,
  period = DEFAULT_PERIOD,
  isUpdating,
  onYieldClick,
  onClose,
  baseCurrency,
  historyPeriods,
  tokenAddress,
  stakingStates,
}: OwnProps & StateProps) {
  const { loadPriceHistory } = getActions();
  const lang = useLang();
  const forceUpdate = useForceUpdate();
  const [isCurrencyMenuOpen, openCurrencyMenu, closeCurrencyMenu] = useFlag(false);
  const [isHistoryMenuOpen, openHistoryMenu, closeHistoryMenu] = useFlag(false);

  const shouldUseDefaultCurrency = baseCurrency === undefined || baseCurrency === token.symbol;
  const chartCurrency = shouldUseDefaultCurrency ? DEFAULT_PRICE_CURRENCY : baseCurrency;

  const currencySymbol = getShortCurrencySymbol(chartCurrency);

  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState(-1);

  useSyncEffect(([prevHistoryIndex]) => {
    if (!IS_IOS) return;

    if (prevHistoryIndex !== undefined) {
      vibrate();
    }
  }, [selectedHistoryIndex]);

  const {
    slug, symbol, amount, image, name, price: lastPrice, decimals,
  } = token;

  const { annualYield, yieldType, id: stakingId } = useMemo(() => {
    return stakingStates?.reduce((bestState, state) => {
      if (state.tokenSlug === slug && (!bestState || state.balance > bestState.balance)) {
        return state;
      }
      return bestState;
    }, undefined as ApiStakingState | undefined);
  }, [stakingStates, slug]) ?? {};

  const logoPath = slug === TONCOIN.slug
    ? tonUrl
    : image || ASSET_LOGO_PATHS[symbol.toLowerCase() as keyof typeof ASSET_LOGO_PATHS];

  const refreshHistory = useLastCallback((newPeriod?: TokenPeriod) => {
    loadPriceHistory({ slug, period: newPeriod ?? period });
  });

  const handleCurrencyChange = useLastCallback((currency: ApiBaseCurrency) => {
    loadPriceHistory({ slug, period, currency });
  });

  useInterval(refreshHistory, INTERVAL);

  const history = historyPeriods?.[period];

  const tokenLastUpdatedAt = history?.length ? history[history.length - 1][0] * 1000 : undefined;
  const tokenLastHistoryPrice = history?.length ? history[history.length - 1][1] : lastPrice;
  const selectedHistoryPoint = history?.[selectedHistoryIndex];
  const price = selectedHistoryPoint?.[1]
    ?? (shouldUseDefaultCurrency ? tokenLastHistoryPrice : undefined)
    ?? lastPrice;
  const isLoading = !tokenLastUpdatedAt || (Date.now() - tokenLastUpdatedAt > OFFLINE_TIMEOUT);
  const dateStr = selectedHistoryPoint
    ? formatShortDay(lang.code!, selectedHistoryPoint[0] * 1000, true, true)
    : (isLoading && tokenLastUpdatedAt ? formatShortDay(lang.code!, tokenLastUpdatedAt, true, false) : lang('Now'));

  useTimeout(forceUpdate, isLoading ? undefined : OFFLINE_TIMEOUT, [tokenLastUpdatedAt]);

  const initialPrice = useMemo(() => {
    return history?.find(([, value]) => Boolean(value))?.[1];
  }, [history]);

  const change = (initialPrice && price) ? price - initialPrice : 0;

  const value = toBig(amount, decimals).mul(price).toString();
  const changePrefix = change === undefined ? change : change > 0 ? '↑' : change < 0 ? '↓' : 0;

  const changeValue = change ? Math.abs(round(change, 4)) : 0;
  const changePercent = change ? Math.abs(round((change / initialPrice!) * 100, 2)) : 0;

  const withChange = Boolean(change !== undefined);
  const historyStartDay = history?.length ? new Date(history![0][0] * 1000) : undefined;
  const withExplorerButton = Boolean(token.cmcSlug || tokenAddress);
  const shouldHideChartPeriodSwitcher = !history?.length && token.priceUsd === 0;

  const color = useMemo(() => calculateTokenCardColor(token), [token]);

  function renderExplorerLink() {
    const url = getExplorerTokenUrl(token.chain, token.cmcSlug, tokenAddress, isTestnet);
    if (!url) return undefined;

    const title = (lang(
      'Open on %ton_explorer_name%',
      { ton_explorer_name: getExplorerName(token.chain) },
    ) as TeactNode[]).join('');

    return (
      <>
        {' · '}
        <a
          href={url}
          title={title}
          aria-label={title}
          target="_blank"
          rel="noreferrer"
          className={styles.tokenExplorerButton}
        >
          <i className="icon-tonexplorer-small" aria-hidden />
        </a>
      </>
    );
  }

  return (
    <div className={buildClassName(styles.container, styles.tokenCard, classNames, color, 'token-card')}>
      <div className={styles.tokenInfo}>
        <Button className={styles.backButton} isSimple onClick={onClose} ariaLabel={lang('Back')}>
          <i className="icon-chevron-left" aria-hidden />
        </Button>
        <img className={styles.tokenLogo} src={logoPath} alt={token.name} />
        <div className={styles.tokenInfoHeader}>
          <b className={styles.tokenAmount}>{formatCurrency(toDecimal(amount, token.decimals), symbol)}</b>
          {withChange && (
            <div className={styles.tokenValue}>
              <div className={styles.currencySwitcher} role="button" tabIndex={0} onClick={openCurrencyMenu}>
                ≈&thinsp;{formatCurrency(value, currencySymbol, undefined, true)}
                <i className={buildClassName('icon', 'icon-caret-down', styles.iconCaretSmall)} aria-hidden />
              </div>
              <CurrencySwitcher
                isOpen={isCurrencyMenuOpen}
                menuPositionHorizontal="right"
                excludedCurrency={token.symbol}
                onClose={closeCurrencyMenu}
                onChange={handleCurrencyChange}
              />
            </div>
          )}
        </div>
        <div className={styles.tokenInfoSubheader}>
          <span className={styles.tokenTitle}>
            <span className={styles.tokenName}>{name}</span>
            {yieldType && (
              <span className={styles.apy} onClick={() => onYieldClick(stakingId)}>
                {yieldType} {annualYield}%
              </span>
            )}
          </span>
          {withChange && Boolean(changeValue) && (
            <div className={styles.tokenChange}>
              {changePrefix}
              &thinsp;
              {Math.abs(changePercent)}% · {formatCurrency(Math.abs(changeValue), currencySymbol)}
            </div>
          )}
        </div>
      </div>

      <Transition activeKey={!history ? 0 : history.length ? HISTORY_PERIODS.indexOf(period) + 1 : -1} name="fade">
        {!history ? (
          <div className={buildClassName(styles.isLoading)}>
            <Spinner color="white" className={styles.center} />
          </div>
        ) : history?.length ? (
          <>
            <TokenPriceChart
              className={styles.chart}
              imgClassName={styles.chartImg}
              width={CHART_DIMENSIONS.width}
              height={CHART_DIMENSIONS.height}
              prices={history!}
              selectedIndex={selectedHistoryIndex}
              onSelectIndex={setSelectedHistoryIndex}
              isUpdating={isUpdating}
            />

            <div className={styles.tokenHistoryPrice}>
              {formatCurrency(history![0][1], currencySymbol, 2, true)}
              <div className={styles.tokenPriceDate}>{formatShortDay(lang.code!, historyStartDay!)}</div>
            </div>
          </>
        ) : undefined}
      </Transition>

      <span
        className={buildClassName(styles.periodChooser, shouldHideChartPeriodSwitcher && styles.periodChooserHidden)}
        role="button"
        tabIndex={0}
        onClick={openHistoryMenu}
      >
        {period === 'ALL' ? 'All' : period}
        <i className={buildClassName('icon', 'icon-caret-down', styles.iconCaretSmall)} aria-hidden />
        <ChartHistorySwitcher
          isOpen={isHistoryMenuOpen}
          onChange={refreshHistory}
          onClose={closeHistoryMenu}
        />
      </span>

      <div className={styles.tokenCurrentPrice}>
        {formatCurrency(price, currencySymbol, selectedHistoryIndex === -1 ? 2 : 4, true)}
        <div className={styles.tokenPriceDate}>
          {dateStr}
          {withExplorerButton && renderExplorerLink()}
        </div>
      </div>
    </div>
  );
}

export default memo(
  withGlobal<OwnProps>((global, ownProps): StateProps => {
    const slug = ownProps.token.slug;
    const accountState = selectCurrentAccountState(global);
    const tokenAddress = global.tokenInfo.bySlug[slug]?.tokenAddress;
    const stakingStates = selectAccountStakingStates(global, global.currentAccountId!);

    return {
      isTestnet: global.settings.isTestnet,
      period: accountState?.currentTokenPeriod,
      baseCurrency: global.settings.baseCurrency,
      historyPeriods: global.tokenPriceHistory.bySlug[ownProps.token.slug],
      tokenAddress,
      stakingStates,
    };
  })(TokenCard),
);
