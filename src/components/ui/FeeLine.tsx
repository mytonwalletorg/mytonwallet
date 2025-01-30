import type { TeactNode } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';

import type { OwnProps as FeeProps } from './Fee';

import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';

import Fee from './Fee';
import Transition from './Transition';

import styles from './FeeLine.module.scss';

const TERMS_TRANSITION_KEY = 0b1;
const DETAILS_TRANSITION_KEY = 0b10;

/**
 * The component will be rendered empty unless all the required options from `FeeProps` are provided.
 * After that it will fade in.
 */
type OwnProps = Partial<Pick<FeeProps, 'terms' | 'token'>> & Pick<FeeProps, 'precision'> & {
  className?: string;
  /** Whether the component is rendered on a landscape layout (with a lighter background) */
  isStatic?: boolean;
  /** If true, the "Details" button will be shown even when no fee can be displayed. */
  keepDetailsButtonWithoutFee?: boolean;
  /** If undefined, the details button is not shown */
  onDetailsClick?(): void;
};

function FeeLine({
  className,
  isStatic,
  terms,
  token,
  precision,
  keepDetailsButtonWithoutFee,
  onDetailsClick,
}: OwnProps) {
  const lang = useLang();
  const content: TeactNode[] = [];
  let transitionKey = 0;

  if (terms && token) {
    const langKey = precision === 'exact' ? '$fee_value_with_colon' : '$fee_value';

    content.push(
      lang(langKey, {
        fee: <Fee terms={terms} token={token} precision={precision} />,
      }),
    );

    if (onDetailsClick) {
      content.push(' · ');
    }

    transitionKey += TERMS_TRANSITION_KEY;
  }

  if (onDetailsClick && (keepDetailsButtonWithoutFee || content.length)) {
    content.push(
      <span
        role="button"
        tabIndex={0}
        className={styles.details}
        onClick={() => onDetailsClick()}
      >
        {lang('Details')}
        <i className={buildClassName('icon-chevron-right', styles.detailsIcon)} aria-hidden />
      </span>,
    );
    transitionKey += DETAILS_TRANSITION_KEY;
  }

  return (
    <Transition
      name="fade"
      activeKey={transitionKey}
      className={buildClassName(styles.root, className, isStatic && styles.static)}
    >
      {content}
    </Transition>
  );
}

export default memo(FeeLine);
