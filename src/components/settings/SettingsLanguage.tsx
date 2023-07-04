import React, { memo, useCallback } from '../../lib/teact/teact';

import type { LangCode } from '../../global/types';

import { LANG_LIST } from '../../config';
import { getActions } from '../../global';
import buildClassName from '../../util/buildClassName';
import { setLanguage } from '../../util/langProvider';

import useLang from '../../hooks/useLang';

import Button from '../ui/Button';
import ModalHeader from '../ui/ModalHeader';

import styles from './Settings.module.scss';

import checkmarkImg from '../../assets/settings/checkmark.svg';

interface OwnProps {
  langCode: LangCode;
  handleBackClick: () => void;
  isInsideModal?: boolean;
}

function SettingsLanguage({
  langCode,
  handleBackClick,
  isInsideModal,
}: OwnProps) {
  const {
    changeLanguage,
  } = getActions();
  const lang = useLang();

  const handleLanguageChange = useCallback((newLangCode: LangCode) => {
    void setLanguage(newLangCode, () => {
      changeLanguage({ langCode: newLangCode });
    });
  }, [changeLanguage]);

  function renderLanguages() {
    return LANG_LIST.map(({ name, nativeName, langCode: lc }) => (
      <div
        key={lc}
        className={buildClassName(styles.item, styles.item_lang)}
        onClick={() => handleLanguageChange(lc)}
      >
        <div className={styles.languageInfo}>
          <span className={styles.languageMain}>{name}</span>
          <span className={styles.languageNative}>{nativeName}</span>
        </div>

        {langCode === lc && <img src={checkmarkImg} alt={name} />}
      </div>
    ));
  }

  return (
    <div className={styles.slide}>
      {isInsideModal ? (
        <ModalHeader
          title={lang('Language')}
          onBackButtonClick={handleBackClick}
          className={styles.languageHeader}
        />
      ) : (
        <div className={styles.header}>
          <Button isSimple isText onClick={handleBackClick} className={styles.headerBack}>
            <i className={buildClassName(styles.iconChevron, 'icon-chevron-left')} aria-hidden />
            <span>{lang('Back')}</span>
          </Button>
          <span className={styles.headerTitle}>{lang('Language')}</span>
        </div>
      )}
      <div className={buildClassName(styles.content, 'custom-scroll')}>
        <div className={styles.block}>
          {renderLanguages()}
        </div>
      </div>
    </div>
  );
}

export default memo(SettingsLanguage);
