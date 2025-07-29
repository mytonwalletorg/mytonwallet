import React from '../../lib/teact/teact';

import type { OwnProps as ButtonProps } from '../../components/ui/Button';

import { IS_TELEGRAM_APP, THEME_DEFAULT } from '../../config';
import { pick } from '../../util/iteratees';

import useAppTheme from '../../hooks/useAppTheme';
import useTelegramBottomButton from '../hooks/useTelegramBottomButton';

import Button from '../../components/ui/Button';

interface OwnProps extends ButtonProps {
  isActive: boolean;
}

function UniversalButton(props: OwnProps) {
  const appTheme = useAppTheme(THEME_DEFAULT);

  useTelegramBottomButton({
    isActive: props.isActive,
    type: props.isPrimary ? 'main' : 'secondary',
    appTheme,
    ...pick(props, ['isLoading', 'isPrimary', 'isDestructive', 'isDisabled', 'onClick']),
    text: props.children,
  });

  if (IS_TELEGRAM_APP) {
    return undefined;
  }

  return (
    <Button {...props} />
  );
}

export default UniversalButton;
