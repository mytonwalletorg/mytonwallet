import React, { memo } from '../../../lib/teact/teact';

import renderText from '../../../global/helpers/renderText';
import buildClassName from '../../../util/buildClassName';

import useLang from '../../../hooks/useLang';

import styles from './BackUpContent.module.scss';

interface OwnProps {
  mnemonic?: string[];
}

function SecretWordsList({
  mnemonic,
}: OwnProps) {
  const lang = useLang();

  return (
    <>
      <p className={buildClassName(styles.info, styles.small)}>
        {renderText(lang('$mnemonic_list_description'))}
      </p>
      <p className={buildClassName(styles.warning)}>
        {renderText(lang('$mnemonic_warning'))}
      </p>
      <ol className={styles.words}>
        {mnemonic?.map((word, i) => (

          <li key={i} className={styles.word}>{word}</li>
        ))}
      </ol>
    </>
  );
}

export default memo(SecretWordsList);
