import type { FormEvent } from 'react';
import React, { memo, useEffect, useState } from '../../../lib/teact/teact';

import { MNEMONIC_CHECK_COUNT } from '../../../config';
import renderText from '../../../global/helpers/renderText';
import { areSortedArraysEqual } from '../../../util/iteratees';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import InputMnemonic from '../InputMnemonic';

import styles from './BackUpContent.module.scss';

interface OwnProps {
  isActive?: boolean;
  isInModal?: boolean;
  checkIndexes?: number[];
  mnemonic?: string[];
  descriptionClassName?: string;
  formClassName?: string;
  errorClassName?: string;
  onSubmit: AnyFunction;
}

function CheckWordsForm({
  isActive,
  isInModal,
  checkIndexes,
  mnemonic,
  descriptionClassName,
  formClassName,
  errorClassName,
  onSubmit,
}: OwnProps) {
  const lang = useLang();
  const [words, setWords] = useState<Record<number, string>>({});
  const [hasMnemonicError, setHasMnemonicError] = useState(false);

  const handleMnemonicCheckSubmit = useLastCallback((e: FormEvent) => {
    e.preventDefault();
    const answer = mnemonic && checkIndexes?.map((index) => mnemonic[index]);
    if (answer && areSortedArraysEqual(answer, Object.values(words))) {
      onSubmit();
    } else {
      setHasMnemonicError(true);
    }
  });

  useEffect(() => {
    if (isActive) {
      setWords({});
      setHasMnemonicError(false);
    }
  }, [isActive]);

  const handleSetWord = useLastCallback((value: string, index: number) => {
    setWords({
      ...words,
      [index]: value?.toLowerCase(),
    });
  });

  return (
    <>
      <p className={descriptionClassName}>
        {renderText(lang('$mnemonic_check_words_list', checkIndexes?.map((n) => n + 1)?.join(', ')))}
      </p>

      <form className={formClassName} onSubmit={handleMnemonicCheckSubmit} id="check_mnemonic_form">
        {checkIndexes!.map((key, i) => (
          <InputMnemonic
            key={key}
            id={`check-mnemonic-${i}`}
            nextId={i + 1 < MNEMONIC_CHECK_COUNT ? `check-mnemonic-${i + 1}` : undefined}
            labelText={`${key + 1}`}
            value={words[key]}
            isInModal={isInModal}
            suggestionsPosition={i > 1 ? 'top' : undefined}
            inputArg={key}
            className={styles.checkMnemonicInput}
            onInput={handleSetWord}
          />
        ))}
      </form>

      {hasMnemonicError && (
        <div className={errorClassName}>
          {renderText(lang('$mnemonic_check_error'))}
        </div>
      )}
    </>
  );
}

export default memo(CheckWordsForm);
