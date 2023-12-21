import React, { memo, useState } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiBaseCurrency } from '../../../../api/types';
import type { UserToken } from '../../../../global/types';

import { TON_TOKEN_SLUG } from '../../../../config';
import { selectCurrentAccountState } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { calcChangeValue } from '../../../../util/calcChangeValue';
import { formatShortDay } from '../../../../util/dateFormat';
import { formatCurrency, getShortCurrencySymbol } from '../../../../util/formatNumber';
import { round } from '../../../../util/round';
import { ASSET_LOGO_PATHS } from '../../../ui/helpers/assetLogos';

import { useDeviceScreen } from '../../../../hooks/useDeviceScreen';
import useForceUpdate from '../../../../hooks/useForceUpdate';
import useLang from '../../../../hooks/useLang';
import useTimeout from '../../../../hooks/useTimeout';

import TokenPriceChart from '../../../common/TokenPriceChart';
import Button from '../../../ui/Button';
import Transition from '../../../ui/Transition';

import styles from './Card.module.scss';

import tonUrl from '../../../../assets/coins/ton.svg';

interface OwnProps {
  token: UserToken;
  classNames: string;
  color?: string;
  onApyClick?: NoneToVoidFunction;
  onClose: NoneToVoidFunction;
}

interface StateProps {
  period?: keyof typeof HISTORY_PERIODS;
  apyValue: number;
  baseCurrency?: ApiBaseCurrency;
}

const HISTORY_PERIODS = {
  '24h': { historyKey: 'history24h', changeKey: 'change24h', title: '1d' },
  '7d': { historyKey: 'history7d', changeKey: 'change7d', title: '7d' },
  '30d': { historyKey: 'history30d', changeKey: 'change30d', title: '1m' },
} as const;

const DEFAULT_PERIOD = '24h';
const OFFLINE_TIMEOUT = 120000; // 2 minutes

const CHART_DIMENSIONS = { width: 300, height: 64 };

function TokenCard({
  token,
  classNames,
  color,
  period = DEFAULT_PERIOD,
  apyValue,
  onApyClick,
  onClose,
  baseCurrency,
}: OwnProps & StateProps) {
  const { setCurrentTokenPeriod } = getActions();
  const { isPortrait } = useDeviceScreen();
  const lang = useLang();
  const forceUpdate = useForceUpdate();

  const shortBaseSymbol = getShortCurrencySymbol(baseCurrency);
  const currentHistoryPeriod = HISTORY_PERIODS[period].historyKey;
  const currentChangePeriod = HISTORY_PERIODS[period].changeKey;

  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState(-1);

  const {
    slug, symbol, amount, image, name, price: lastPrice,
  } = token;

  const logoPath = slug === TON_TOKEN_SLUG
    ? tonUrl
    : image || ASSET_LOGO_PATHS[symbol.toLowerCase() as keyof typeof ASSET_LOGO_PATHS];

  const history = currentHistoryPeriod in token ? token[currentHistoryPeriod] : undefined;

  const tokenLastUpdatedAt = history?.length ? history[history.length - 1][0] * 1000 : undefined;
  const selectedHistoryPoint = history?.[selectedHistoryIndex];
  const price = selectedHistoryPoint?.[1] || lastPrice;
  const isLoading = !tokenLastUpdatedAt || (Date.now() - tokenLastUpdatedAt > OFFLINE_TIMEOUT);
  const dateStr = selectedHistoryPoint
    ? formatShortDay(lang.code!, selectedHistoryPoint[0] * 1000, true, true)
    : (isLoading && tokenLastUpdatedAt ? formatShortDay(lang.code!, tokenLastUpdatedAt, true, false) : lang('Now'));

  useTimeout(forceUpdate, isLoading ? undefined : OFFLINE_TIMEOUT, [tokenLastUpdatedAt]);

  const initialPrice = history?.[0]?.[1];
  const change = initialPrice
    ? (price - initialPrice) / initialPrice
    : currentChangePeriod in token
      ? token[currentChangePeriod]
      : undefined;

  const value = amount * price;
  const changePrefix = change === undefined ? change : change > 0 ? '↑' : change < 0 ? '↓' : 0;
  const changeValue = change ? Math.abs(round(calcChangeValue(value, change), 4)) : 0;
  const changePercent = change ? Math.abs(round(change * 100, 2)) : 0;

  const withChange = Boolean(change !== undefined);
  const withHistory = Boolean(history?.length);
  const historyStartDay = withHistory ? new Date(history![0][0] * 1000) : undefined;
  const withCmcButton = Boolean(token.cmcSlug);

  function renderChart() {
    return (
      <TokenPriceChart
        className={styles.chart}
        imgClassName={styles.chartImg}
        width={CHART_DIMENSIONS.width}
        height={CHART_DIMENSIONS.height}
        prices={history!}
        selectedIndex={selectedHistoryIndex}
        onSelectIndex={setSelectedHistoryIndex}
      />
    );
  }

  return (
    <div className={buildClassName(styles.container, styles.tokenCard, classNames, color, 'token-card')}>
      <div className={styles.tokenInfo}>
        <Button className={styles.backButton} isSimple onClick={onClose} ariaLabel={lang('Back')}>
          <i className="icon-chevron-left" aria-hidden />
        </Button>
        <img className={styles.tokenLogo} src={logoPath} alt={token.name} />
        <div>
          <b className={styles.tokenAmount}>{formatCurrency(amount, symbol)}</b>
          <span className={styles.tokenName}>
            {name}
            {token.slug === TON_TOKEN_SLUG && (
              <span className={styles.apy} onClick={onApyClick}>
                APY {apyValue}%
              </span>
            )}
          </span>
        </div>
      </div>

      {withChange && (
        <div className={styles.tokenPrice}>
          ≈&thinsp;{formatCurrency(value, shortBaseSymbol)}
          {Boolean(changeValue) && (
            <div className={styles.tokenChange}>
              {changePrefix}
              &thinsp;
              {Math.abs(changePercent)}% · {formatCurrency(Math.abs(changeValue), shortBaseSymbol)}
            </div>
          )}
        </div>
      )}

      {withHistory && (
        <>
          <Transition activeKey={Object.keys(HISTORY_PERIODS).indexOf(period)} name="fade">
            {renderChart}
          </Transition>

          <div className={styles.tokenHistoryPrice}>
            {formatCurrency(history![0][1], shortBaseSymbol)}
            <div className={styles.tokenPriceDate}>{formatShortDay(lang.code!, historyStartDay!)}</div>
          </div>

          <div className={buildClassName(styles.periodChooser, isPortrait && styles.compact)}>
            {Object.entries(HISTORY_PERIODS).map(([historyPeriod, { historyKey, title }]) => (
              <label
                key={historyKey}
                className={buildClassName(
                  styles.periodItem,
                  currentHistoryPeriod === historyKey && styles.periodItem_active,
                )}
              >
                <input
                  teactExperimentControlled
                  type="radio"
                  className={styles.periodInput}
                  name="historyPeriod"
                  checked={currentHistoryPeriod === historyKey}
                  onChange={() => setCurrentTokenPeriod({ period: historyPeriod as keyof typeof HISTORY_PERIODS })}
                />
                {title}
              </label>
            ))}
          </div>
        </>
      )}

      <div className={styles.tokenCurrentPrice}>
        {formatCurrency(price, shortBaseSymbol, selectedHistoryIndex === -1 ? 2 : 4)}
        <div className={styles.tokenPriceDate}>
          {dateStr}
          {withCmcButton && (
            <>
              {' · '}
              <a
                href={`https://coinmarketcap.com/currencies/${token.cmcSlug}/`}
                title={lang('Open on CoinMarketCap')}
                target="_blank"
                rel="noreferrer"
                className={styles.cmcButton}
              >
                <i className="icon-coinmarket" aria-hidden />
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(
  withGlobal<OwnProps>((global): StateProps => {
    const accountState = selectCurrentAccountState(global);

    return {
      period: accountState?.currentTokenPeriod,
      apyValue: accountState?.staking?.apy || 0,
      baseCurrency: global.settings.baseCurrency,
    };
  })(TokenCard),
);
