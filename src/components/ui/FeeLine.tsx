import type { TeactNode } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';

import type { FormatFeeOptions } from '../../util/fee/formatFee';

import buildClassName from '../../util/buildClassName';
import { formatFee } from '../../util/fee/formatFee';

import useLang from '../../hooks/useLang';

import Transition from './Transition';

import styles from './FeeLine.module.scss';

/**
 * The component will be rendered empty unless all the required options from `FormatFeeOptions` are provided.
 * After that it will fade in.
 */
type OwnProps = Partial<FormatFeeOptions> & Pick<FormatFeeOptions, 'precision'> & {
  className?: string;
  /** Whether the component is rendered on a landscape layout (with a lighter background) */
  isStatic?: boolean;
};

function FeeLine({
  className,
  isStatic,
  terms,
  token,
  nativeToken,
  ...formatOptions
}: OwnProps) {
  const lang = useLang();
  let transitionKey = 0;
  let content: TeactNode = ' ';

  if (terms && token && nativeToken) {
    const feeText = formatFee({
      terms,
      token,
      nativeToken,
      ...formatOptions,
    });
    const langKey = formatOptions.precision === 'exact'
      ? '$fee_value_with_colon'
      : '$fee_value';

    transitionKey = 1;
    content = lang(langKey, { fee: feeText });
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
