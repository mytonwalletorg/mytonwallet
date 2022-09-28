import React, {
  memo, useCallback, useMemo, useState,
} from '../../lib/teact/teact';

import { getActions, withGlobal } from '../../global';

import { ANIMATED_STICKER_SMALL_SIZE_PX, MNEMONIC_COUNT } from '../../config';
import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';
import buildClassName from '../../util/buildClassName';
import useClipboardPaste from '../../hooks/useClipboardPaste';

import AnimatedIcon from '../ui/AnimatedIcon';
import InputMnemonic from '../ui/InputMnemonic';
import Button from '../ui/Button';

import styles from './Auth.module.scss';

interface OwnProps {
  isActive?: boolean;
}

type StateProps = {
  error?: string;
};

const MNEMONIC_INPUTS = [...Array(MNEMONIC_COUNT)].map((_, index) => ({
  id: index,
  label: `${index + 1}`,
}));

const AuthImportMnemonic = ({ isActive, error }: OwnProps & StateProps) => {
  const { afterImportMnemonic, restartAuth } = getActions();
  const [mnemonic, setMnemonic] = useState<Record<number, string>>({});

  const handlePasteMnemonic = useCallback((pastedText: string) => {
    const pastedMnemonic = parsePastedText(pastedText);

    if (pastedMnemonic.length !== MNEMONIC_COUNT) {
      return;
    }

    setMnemonic(pastedMnemonic);

    if (document.activeElement?.id.startsWith('import-mnemonic-')) {
      (document.activeElement as HTMLInputElement).blur();
    }
  }, []);

  useClipboardPaste(Boolean(isActive), handlePasteMnemonic);

  const isSubmitDisabled = useMemo(() => {
    const mnemonicValues = Object.values(mnemonic);

    return mnemonicValues.length !== MNEMONIC_COUNT || mnemonicValues.some((word) => !word);
  }, [mnemonic]);

  const handleSetWord = useCallback((value: string, index: number) => {
    setMnemonic({
      ...mnemonic,
      [index]: value?.toLowerCase(),
    });
  }, [mnemonic]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isSubmitDisabled) {
      afterImportMnemonic({ mnemonic: Object.values(mnemonic) });
    }
  };

  return (
    <div className={buildClassName(styles.container, styles.container_scrollable, 'custom-scroll')}>
      <AnimatedIcon
        play={isActive}
        size={ANIMATED_STICKER_SMALL_SIZE_PX}
        tgsUrl={ANIMATED_STICKERS_PATHS.snitch}
        nonInteractive
        noLoop={false}
        className={styles.sticker}
      />
      <div className={buildClassName(styles.title, styles.title_afterSmallSticker)}>{MNEMONIC_COUNT} Secret Words</div>
      <div className={buildClassName(styles.info, styles.info_pull)}>
        You can restore access to your wallet by entering the {MNEMONIC_COUNT} secret words
        that you wrote down when creating the wallet.
      </div>

      <form
        id="import_mnemonic_form"
        className={styles.importingContent}
        onSubmit={handleSubmit}
      >
        {MNEMONIC_INPUTS.map(({ id, label }) => (
          <InputMnemonic
            key={id}
            id={`import-mnemonic-${id}`}
            nextId={id + 1 < MNEMONIC_COUNT ? `import-mnemonic-${id + 1}` : undefined}
            labelText={label}
            value={mnemonic[id]}
            suggestionsPosition={(id > 7 && id < 12) || id > 19 ? 'top' : undefined}
            inputArg={id}
            onInput={handleSetWord}
          />
        ))}
      </form>

      <div className={styles.buttons}>
        {error && <div className={styles.footerError}>{error}</div>}
        <div className={styles.buttons__inner}>
          <Button onClick={restartAuth} className={styles.btn}>
            Cancel
          </Button>
          <Button
            forFormId="import_mnemonic_form"
            isPrimary
            isDisabled={isSubmitDisabled}
            className={styles.btn}
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>((global): StateProps => {
  return {
    error: global.auth.error,
  };
})(AuthImportMnemonic));

function parsePastedText(str: string) {
  return str.replace(/(?:\r\n)+|[\r\n\s;,\t]+/g, ' ').trim().split(' ');
}
