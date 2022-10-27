import React, { memo, useState } from '../../lib/teact/teact';

import Button from '../ui/Button';
import Modal from '../ui/Modal';
import DropDown from '../ui/DropDown';

import styles from './SettingsModal.module.scss';
import modalStyles from '../ui/Modal.module.scss';

interface OwnProps {
  isOpen: boolean;
  onClose: NoneToVoidFunction;
}

const EnglishLang = {
  value: 'EN',
  name: 'English',
  icon: 'flag-en.svg',
};
const RussianLang = {
  value: 'RU',
  name: 'Russian',
  icon: 'flag-ru.svg',

};
const SpanishLang = {
  value: 'ES',
  name: 'Spanish',
  icon: 'flag-es.svg',

};

function Settings({ isOpen, onClose }: OwnProps) {
  const [selectedOption, setSelectedOption] = useState(EnglishLang.value);
  return (
    <Modal dialogClassName={styles.modal} isOpen={isOpen} onClose={onClose} title="Settings" hasCloseButton>
      <div className={styles.elementLine}>
        <div className={styles.divElementText}>
          <p> Language </p>
        </div>
        <DropDown
          items={[EnglishLang, RussianLang, SpanishLang]}
          selectedValue={selectedOption}
          className={styles.tokenDropDown}
          onChange={setSelectedOption}
        />
      </div>
      <div className={modalStyles.buttons}>
        <Button onClick={onClose}>Close</Button>
      </div>
    </Modal>
  );
}

export default memo(Settings);
