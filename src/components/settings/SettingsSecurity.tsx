import { AndroidSettings, IOSSettings, NativeSettings } from 'capacitor-native-settings';
import { Dialog } from 'native-dialog';
import React, { memo, useLayoutEffect, useState } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import { SettingsState } from '../../global/types';

import {
  ANIMATED_STICKER_BIG_SIZE_PX, ANIMATED_STICKER_HUGE_SIZE_PX, IS_CAPACITOR, PIN_LENGTH,
} from '../../config';
import { selectIsPasswordPresent } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { getIsNativeBiometricAuthSupported, vibrateOnSuccess } from '../../util/capacitor';
import resolveModalTransitionName from '../../util/resolveModalTransitionName';
import { pause } from '../../util/schedulers';
import {
  IS_BIOMETRIC_AUTH_SUPPORTED, IS_ELECTRON, IS_IOS, IS_IOS_APP,
} from '../../util/windowEnvironment';
import { callApi } from '../../api';
import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';

import useHistoryBack from '../../hooks/useHistoryBack';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import usePrevious from '../../hooks/usePrevious';
import useScrolledState from '../../hooks/useScrolledState';

import AnimatedIconWithPreview from '../ui/AnimatedIconWithPreview';
import Button from '../ui/Button';
import CreatePasswordForm from '../ui/CreatePasswordForm';
import ModalHeader from '../ui/ModalHeader';
import PasswordForm from '../ui/PasswordForm';
import PinPad from '../ui/PinPad';
import Switcher from '../ui/Switcher';
import Transition from '../ui/Transition';
import NativeBiometricsToggle from './biometrics/NativeBiometricsToggle';

import modalStyles from '../ui/Modal.module.scss';
import styles from './Settings.module.scss';

import biometricsImg from '../../assets/settings/settings_biometrics.svg';

const enum SLIDES {
  settings,
  password,
  newPassword,
  createNewPin,
  confirmNewPin,
  passwordChanged,
}

const SUBMIT_PAUSE_MS = 1500;

interface OwnProps {
  isActive?: boolean;
  handleBackClick: NoneToVoidFunction;
  isInsideModal?: boolean;
  isAutoUpdateEnabled: boolean;
  onAutoUpdateEnabledToggle: VoidFunction;
}

interface StateProps {
  isBiometricAuthEnabled: boolean;
  isNativeBiometricAuthEnabled: boolean;
  isPasswordNumeric?: boolean;
  isPasswordPresent: boolean;
}

const INITIAL_CHANGE_PASSWORD_SLIDE = IS_CAPACITOR ? SLIDES.createNewPin : SLIDES.newPassword;

function SettingsSecurity({
  isActive,
  handleBackClick: navigateBackToSettings,
  isInsideModal,
  isBiometricAuthEnabled,
  isNativeBiometricAuthEnabled,
  isPasswordNumeric,
  isPasswordPresent,
  isAutoUpdateEnabled,
  onAutoUpdateEnabledToggle,
}: OwnProps & StateProps) {
  const {
    setIsPinAccepted,
    clearIsPinAccepted,
    disableNativeBiometrics,
    enableNativeBiometrics,
    openBiometricsTurnOffWarning,
    openBiometricsTurnOn,
    setSettingsState,
  } = getActions();

  const lang = useLang();
  const {
    isScrolled,
    handleScroll: handleContentScroll,
  } = useScrolledState();

  const [currentSlide, setCurrentSlide] = useState<number>(SLIDES.password);
  const previousSlide = usePrevious(currentSlide);
  const [nextKey, setNextKey] = useState<number | undefined>(SLIDES.settings);
  const [passwordError, setPasswordError] = useState<string>();
  const [password, setPassword] = useState<string>();

  // For Capacitor only
  const [pinValue, setPinValue] = useState<string>('');
  const [confirmPinValue, setConfirmPinValue] = useState<string>('');

  const clearPasswordError = useLastCallback(() => {
    setPasswordError(undefined);
  });

  const cleanup = useLastCallback((shouldKeepCurrentPassword?: boolean) => {
    if (!shouldKeepCurrentPassword) setPassword(undefined);
    setPinValue('');
    setConfirmPinValue('');
    clearPasswordError();
    clearIsPinAccepted();
  });

  const handleBackToSettingsClick = useLastCallback(() => {
    navigateBackToSettings();
    cleanup();
  });

  const openConfirmNewPinSlide = useLastCallback(() => {
    setCurrentSlide(SLIDES.confirmNewPin);
    setNextKey(SLIDES.settings);
  });

  const openSettingsSlide = useLastCallback(() => {
    setCurrentSlide(SLIDES.settings);
    setNextKey(undefined);
    cleanup(true);
  });

  const openNewPasswordSlide = useLastCallback(() => {
    setCurrentSlide(INITIAL_CHANGE_PASSWORD_SLIDE);
    setNextKey(SLIDES.settings);
  });

  const openPasswordChangedSlide = useLastCallback(() => {
    setCurrentSlide(SLIDES.passwordChanged);
    setNextKey(SLIDES.settings);
  });

  useLayoutEffect(() => {
    if (password === undefined && isActive) setCurrentSlide(SLIDES.password);
    else if (!isActive) cleanup();
  }, [password, isActive]);

  useHistoryBack({ isActive, onBack: handleBackToSettingsClick });

  const handlePasswordSubmit = useLastCallback(async (enteredPassword: string) => {
    const result = await callApi('verifyPassword', enteredPassword);

    if (!result) {
      setPasswordError('Wrong password, please try again.');
      return;
    }

    if (IS_CAPACITOR) {
      setIsPinAccepted();
      await vibrateOnSuccess(true);
    }

    openSettingsSlide();
    setPassword(enteredPassword);
  });

  const handleNewPasswordSubmit = useLastCallback(async (enteredPassword: string) => {
    await callApi('changePassword', password!, enteredPassword);
    setPassword(enteredPassword);
    if (isNativeBiometricAuthEnabled) {
      disableNativeBiometrics();
      await enableNativeBiometrics({ password: enteredPassword });
    }
    if (IS_CAPACITOR) {
      openSettingsSlide();
    } else {
      openPasswordChangedSlide();
    }
  });

  const handlePinSubmit = useLastCallback((enteredPassword: string) => {
    setPinValue(enteredPassword);
    openConfirmNewPinSlide();
  });

  const handleConfirmPinSubmit = useLastCallback(async (enteredPassword: string) => {
    if (enteredPassword === pinValue) {
      setPasswordError(lang('New code set successfully'));
      await pause(SUBMIT_PAUSE_MS);
      handleNewPasswordSubmit(enteredPassword);
    } else {
      setPasswordError(lang('Codes don’t match'));
      await pause(SUBMIT_PAUSE_MS);
      cleanup(true);
      setCurrentSlide(SLIDES.createNewPin);
    }
  });

  const handleChangePasswordClick = useLastCallback(() => {
    setNextKey(INITIAL_CHANGE_PASSWORD_SLIDE);
    openNewPasswordSlide();
  });

  // Biometrics
  const handleBiometricAuthToggle = useLastCallback(() => {
    if (isBiometricAuthEnabled) {
      openBiometricsTurnOffWarning();
    } else {
      openBiometricsTurnOn();
    }
  });
  const handleNativeBiometricsTurnOnOpen = useLastCallback(() => {
    if (getIsNativeBiometricAuthSupported()) {
      setSettingsState({ state: SettingsState.NativeBiometricsTurnOn });
      return;
    }

    const warningDescription = IS_IOS
      ? 'To use this feature, first enable Face ID in your phone settings.'
      : 'To use this feature, first enable biometrics in your phone settings.';
    Dialog.confirm({
      title: lang('Warning!'),
      message: lang(warningDescription),
      okButtonTitle: lang('Open Settings'),
      cancelButtonTitle: lang('Cancel'),
    })
      .then(({ value }) => {
        if (value) {
          NativeSettings.open({
            optionAndroid: AndroidSettings.ApplicationDetails,
            optionIOS: IOSSettings.App,
          });
        }
      });
  });
  const shouldRenderNativeBiometrics = isPasswordPresent && (getIsNativeBiometricAuthSupported() || IS_IOS_APP);

  function renderSettings() {
    return (
      <div className={styles.slide}>
        {isInsideModal ? (
          <ModalHeader
            title={lang('Security')}
            withNotch={isScrolled}
            onBackButtonClick={handleBackToSettingsClick}
            className={styles.modalHeader}
          />
        ) : (
          <div className={buildClassName(styles.header, 'with-notch-on-scroll', isScrolled && 'is-scrolled')}>
            <Button isSimple isText onClick={handleBackToSettingsClick} className={styles.headerBack}>
              <i className={buildClassName(styles.iconChevron, 'icon-chevron-left')} aria-hidden />
              <span>{lang('Back')}</span>
            </Button>
            <span className={styles.headerTitle}>{lang('Security')}</span>
          </div>
        )}
        <div
          className={buildClassName(styles.content, 'custom-scroll')}
          onScroll={handleContentScroll}
        >
          {shouldRenderNativeBiometrics && (
            <NativeBiometricsToggle
              onEnable={handleNativeBiometricsTurnOnOpen}
            />
          )}
          {isPasswordPresent && IS_BIOMETRIC_AUTH_SUPPORTED && (
            <>
              <div className={buildClassName(styles.block, styles.settingsBlockWithDescription)}>
                <div className={styles.item} onClick={handleBiometricAuthToggle}>
                  <img className={styles.menuIcon} src={biometricsImg} alt={lang('Biometric Authentication')} />
                  {lang('Biometric Authentication')}

                  <Switcher
                    className={styles.menuSwitcher}
                    label={lang('Biometric Authentication')}
                    checked={isBiometricAuthEnabled}
                  />
                </div>
              </div>
              <p className={styles.blockDescription}>{
                lang('To avoid entering the passcode every time, you can use biometrics.')
              }
              </p>
            </>
          )}

          {!(isBiometricAuthEnabled && !isNativeBiometricAuthEnabled) && (
            <>
              <div className={buildClassName(styles.block, styles.settingsBlockWithDescription)}>
                <Button
                  className={styles.changePasswordButton}
                  isSimple
                  onClick={handleChangePasswordClick}
                >
                  {isPasswordNumeric ? lang('Change Passcode') : lang('Change Password')}
                </Button>
              </div>
              <p className={styles.blockDescription}>{lang('The passcode will be changed for all your wallets.')}</p>
            </>
          )}

          {IS_ELECTRON && (
            <>
              <div className={buildClassName(styles.block, styles.settingsBlockWithDescription)}>
                <div className={buildClassName(styles.item, styles.item_small)} onClick={onAutoUpdateEnabledToggle}>
                  {lang('Enable Auto-Updates')}

                  <Switcher
                    className={styles.menuSwitcher}
                    label={lang('Enable Auto-Updates')}
                    checked={isAutoUpdateEnabled}
                  />
                </div>
              </div>
              <p className={styles.blockDescription}>
                {lang('Turn this off so you can manually download updates and verify signatures.')}
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  // eslint-disable-next-line consistent-return
  function renderContent(isSlideActive: boolean, isFrom: boolean, currentKey: number) {
    switch (currentKey) {
      case SLIDES.settings:
        return renderSettings();
      case SLIDES.password:
        return (
          <>
            {isInsideModal ? (
              <ModalHeader
                title={isPasswordNumeric ? lang('Confirm Passcode') : lang('Confirm Password')}
                onBackButtonClick={handleBackToSettingsClick}
                className={styles.modalHeader}
              />
            ) : (
              <div className={styles.header}>
                <Button isSimple isText onClick={handleBackToSettingsClick} className={styles.headerBack}>
                  <i className={buildClassName(styles.iconChevron, 'icon-chevron-left')} aria-hidden />
                  <span>{lang('Back')}</span>
                </Button>
                <span className={styles.headerTitle}>{lang('Enter Password')}</span>
              </div>
            )}
            <PasswordForm
              isActive={isSlideActive}
              error={passwordError}
              containerClassName={IS_CAPACITOR ? styles.passwordFormContent : styles.passwordFormContentInModal}
              placeholder={lang('Enter your current password')}
              submitLabel={lang('Continue')}
              onCancel={handleBackToSettingsClick}
              onSubmit={handlePasswordSubmit}
              onUpdate={clearPasswordError}
            />
          </>
        );
      case SLIDES.newPassword:
        return (
          <>
            {isInsideModal ? (
              <ModalHeader
                title={lang('Change Password')}
                onBackButtonClick={openSettingsSlide}
                className={styles.modalHeader}
              />
            ) : (
              <div className={styles.header}>
                <Button isSimple isText onClick={openSettingsSlide} className={styles.headerBack}>
                  <i className={buildClassName(styles.iconChevron, 'icon-chevron-left')} aria-hidden />
                  <span>{lang('Back')}</span>
                </Button>
                <span className={styles.headerTitle}>{lang('Change Password')}</span>
              </div>
            )}
            <div className={modalStyles.transitionContent}>
              <AnimatedIconWithPreview
                tgsUrl={ANIMATED_STICKERS_PATHS.guard}
                previewUrl={ANIMATED_STICKERS_PATHS.guardPreview}
                play={isSlideActive}
                size={ANIMATED_STICKER_BIG_SIZE_PX}
                nonInteractive
                noLoop={false}
                className={styles.sticker}
              />
              <CreatePasswordForm
                isActive={isSlideActive}
                onSubmit={handleNewPasswordSubmit}
                onCancel={openSettingsSlide}
                formId="auth-create-password"
              />
            </div>
          </>
        );
      case SLIDES.createNewPin:
        return (
          <>
            <div className={styles.header}>
              <Button isSimple isText onClick={openSettingsSlide} className={styles.headerBack}>
                <i className={buildClassName(styles.iconChevron, 'icon-chevron-left')} aria-hidden />
                <span>{lang('Back')}</span>
              </Button>
            </div>

            <div className={styles.pinPadHeader}>
              <AnimatedIconWithPreview
                play={isActive}
                tgsUrl={ANIMATED_STICKERS_PATHS.guard}
                previewUrl={ANIMATED_STICKERS_PATHS.guardPreview}
                noLoop={false}
                size={ANIMATED_STICKER_HUGE_SIZE_PX}
                nonInteractive
              />
              <div className={styles.pinPadTitle}>{lang('Change Passcode')}</div>
            </div>

            <PinPad
              isActive={isActive}
              title={lang('Enter your new code')}
              length={PIN_LENGTH}
              value={pinValue}
              onChange={setPinValue}
              onSubmit={handlePinSubmit}
            />
          </>
        );
      case SLIDES.confirmNewPin:
        return (
          <>
            <div className={styles.header}>
              <Button isSimple isText onClick={openSettingsSlide} className={styles.headerBack}>
                <i className={buildClassName(styles.iconChevron, 'icon-chevron-left')} aria-hidden />
                <span>{lang('Back')}</span>
              </Button>
            </div>

            <div className={styles.pinPadHeader}>
              <AnimatedIconWithPreview
                play={isActive}
                tgsUrl={ANIMATED_STICKERS_PATHS.guard}
                previewUrl={ANIMATED_STICKERS_PATHS.guardPreview}
                noLoop={false}
                size={ANIMATED_STICKER_HUGE_SIZE_PX}
                nonInteractive
              />
              <div className={styles.pinPadTitle}>
                {
                  passwordError && pinValue === confirmPinValue
                    ? lang('Passcode Changed!')
                    : lang('Change Passcode')
                }
              </div>
            </div>

            <PinPad
              isActive={isActive}
              title={!passwordError ? lang('Re-enter your new code') : passwordError}
              type={passwordError ? (pinValue === confirmPinValue ? 'success' : 'error') : undefined}
              length={PIN_LENGTH}
              value={confirmPinValue}
              onChange={setConfirmPinValue}
              onSubmit={handleConfirmPinSubmit}
            />
          </>
        );
      case SLIDES.passwordChanged:
        return (
          <>
            {isInsideModal ? (
              <ModalHeader
                title={lang('Password Changed!')}
                className={styles.modalHeader}
              />
            ) : (
              <div className={buildClassName(styles.header, styles.onlyTextHeader)}>
                <span className={styles.headerTitle}>{lang('Password Changed!')}</span>
              </div>
            )}
            <div className={modalStyles.transitionContent}>
              <AnimatedIconWithPreview
                tgsUrl={ANIMATED_STICKERS_PATHS.yeee}
                previewUrl={ANIMATED_STICKERS_PATHS.yeeePreview}
                play={isActive}
                size={ANIMATED_STICKER_HUGE_SIZE_PX}
                nonInteractive
                noLoop={false}
                className={buildClassName(styles.sticker, styles.stickerHuge)}
              />

              <div className={modalStyles.buttons}>
                <Button isPrimary onClick={openSettingsSlide} className={modalStyles.customSubmitButton}>
                  {lang('Done')}
                </Button>
              </div>
            </div>
          </>
        );
    }
  }

  return (
    <Transition
      direction={previousSlide === SLIDES.password && currentSlide === SLIDES.settings ? 1 : 'auto'}
      name={resolveModalTransitionName()}
      className={buildClassName(modalStyles.transition, 'custom-scroll')}
      slideClassName={modalStyles.transitionSlide}
      activeKey={currentSlide}
      nextKey={nextKey}
      shouldCleanup
    >
      {renderContent}
    </Transition>
  );
}

export default memo(withGlobal<OwnProps>((global): StateProps => {
  const { isPasswordNumeric, authConfig } = global.settings;
  const isBiometricAuthEnabled = !!authConfig && authConfig.kind !== 'password';
  const isNativeBiometricAuthEnabled = !!authConfig && authConfig.kind === 'native-biometrics';
  const isPasswordPresent = selectIsPasswordPresent(global);
  return {
    isBiometricAuthEnabled,
    isNativeBiometricAuthEnabled,
    isPasswordNumeric,
    isPasswordPresent,
  };
})(SettingsSecurity));
