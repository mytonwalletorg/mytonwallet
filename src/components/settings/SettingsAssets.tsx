import React, { memo, useCallback } from '../../lib/teact/teact';

import { CARD_SECONDARY_VALUE_SYMBOL, TINY_TRANSFER_MAX_AMOUNT } from '../../config';
import { getActions } from '../../global';
import buildClassName from '../../util/buildClassName';
import stopEvent from '../../util/stopEvent';
import { IS_TOUCH_ENV } from '../../util/windowEnvironment';

import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useScrolledState from '../../hooks/useScrolledState';

import Button from '../ui/Button';
import Dropdown from '../ui/DropDown';
import ModalHeader from '../ui/ModalHeader';
import Switcher from '../ui/Switcher';
import Tooltip from '../ui/Tooltip';

import styles from './Settings.module.scss';

interface OwnProps {
  handleBackClick: () => void;
  areTinyTransfersHidden?: boolean;
  isInvestorViewEnabled?: boolean;
  isInsideModal?: boolean;
}

const CURRENCY_OPTIONS = [{
  value: 'usd',
  name: 'US Dollar',
}];

function SettingsAssets({
  handleBackClick,
  areTinyTransfersHidden,
  isInvestorViewEnabled,
  isInsideModal,
}: OwnProps) {
  const {
    toggleTinyTransfersHidden,
    toggleInvestorView,
  } = getActions();
  const lang = useLang();

  const [isInvestorHelpTooltipOpen, openInvestorHelpTooltip, closeInvestorHelpTooltip] = useFlag();
  const [isTinyTransfersHelpTooltipOpen, openTinyTransfersHelpTooltip, closeTinyTransfersHelpTooltip] = useFlag();

  const {
    handleScroll: handleContentScroll,
    isAtBeginning: isContentNotScrolled,
  } = useScrolledState();

  const handleTinyTransfersHiddenToggle = useCallback(() => {
    toggleTinyTransfersHidden({ isEnabled: !areTinyTransfersHidden });
  }, [areTinyTransfersHidden, toggleTinyTransfersHidden]);

  const handleInvestorViewToggle = useCallback(() => {
    toggleInvestorView({ isEnabled: !isInvestorViewEnabled });
  }, [isInvestorViewEnabled, toggleInvestorView]);

  return (
    <div className={styles.slide}>
      {isInsideModal ? (
        <ModalHeader
          title={lang('Assets & Activity')}
          withBorder={!isContentNotScrolled}
          onBackButtonClick={handleBackClick}
        />
      ) : (
        <div className={styles.header}>
          <Button isSimple isText onClick={handleBackClick} className={styles.headerBack}>
            <i className={buildClassName(styles.iconChevron, 'icon-chevron-left')} aria-hidden />
            <span>{lang('Back')}</span>
          </Button>
          <span className={styles.headerTitle}>{lang('Assets & Activity')}</span>
        </div>
      )}
      <div className={buildClassName(styles.content, 'custom-scroll')} onScroll={handleContentScroll}>
        <div className={styles.settingsBlock}>
          <Dropdown
            label={lang('Fiat Currency')}
            items={CURRENCY_OPTIONS}
            selectedValue={CURRENCY_OPTIONS[0].value}
            theme="light"
            disabled
            shouldTranslateOptions
            className={buildClassName(styles.item, styles.item_small)}
          />
          <div className={buildClassName(styles.item, styles.item_small)} onClick={handleInvestorViewToggle}>
            <div className={styles.blockWithTooltip}>
              {lang('Investor View')}

              <Tooltip
                isOpen={isInvestorHelpTooltipOpen}
                message={lang('Focus on asset value rather than current balance')}
                className={styles.tooltip}
              />
              <i
                className={buildClassName(styles.iconQuestion, 'icon-question')}
                onClick={IS_TOUCH_ENV ? stopEvent : undefined}
                onMouseEnter={openInvestorHelpTooltip}
                onMouseLeave={closeInvestorHelpTooltip}
              />

            </div>

            <Switcher
              className={styles.menuSwitcher}
              label={lang('Investor View')}
              checked={isInvestorViewEnabled}
            />
          </div>
          <div className={buildClassName(styles.item, styles.item_small)} onClick={handleTinyTransfersHiddenToggle}>
            <div className={styles.blockWithTooltip}>
              {lang('Hide Tiny Transfers')}

              <Tooltip
                isOpen={isTinyTransfersHelpTooltipOpen}
                message={
                  lang(
                    '$tiny_transfers_help',
                    [TINY_TRANSFER_MAX_AMOUNT, CARD_SECONDARY_VALUE_SYMBOL],
                  ) as string
                }
                className={buildClassName(styles.tooltip, styles.tooltip_wide)}
              />
              <i
                className={buildClassName(styles.iconQuestion, 'icon-question')}
                onClick={IS_TOUCH_ENV ? stopEvent : undefined}
                onMouseEnter={openTinyTransfersHelpTooltip}
                onMouseLeave={closeTinyTransfersHelpTooltip}
              />
            </div>

            <Switcher
              className={styles.menuSwitcher}
              label={lang('Hide Tiny Transfers')}
              checked={areTinyTransfersHidden}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(SettingsAssets);
