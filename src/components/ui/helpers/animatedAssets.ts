import { IS_CORE_WALLET } from '../../../config';

import iconAddDark from '../../../assets/lottie/add_dark.tgs';
import iconAddLight from '../../../assets/lottie/add_light.tgs';
import iconClockDark from '../../../assets/lottie/clock_dark.tgs';
import iconClockDarkBlue from '../../../assets/lottie/clock_dark_blue.tgs';
import iconClockDarkGray from '../../../assets/lottie/clock_dark_gray.tgs';
import iconClockDarkGrayWhite from '../../../assets/lottie/clock_dark_gray_white.tgs';
import iconClockDarkGreen from '../../../assets/lottie/clock_dark_green.tgs';
import iconClockDarkPurple from '../../../assets/lottie/clock_dark_purple.tgs';
import iconClockDarkPurpleWhite from '../../../assets/lottie/clock_dark_purple_white.tgs';
import iconClockLight from '../../../assets/lottie/clock_light.tgs';
import iconClockLightBlue from '../../../assets/lottie/clock_light_blue.tgs';
import iconClockLightGray from '../../../assets/lottie/clock_light_gray.tgs';
import iconClockLightGrayWhite from '../../../assets/lottie/clock_light_gray_white.tgs';
import iconClockLightGreen from '../../../assets/lottie/clock_light_green.tgs';
import iconClockLightPurple from '../../../assets/lottie/clock_light_purple.tgs';
import iconClockLightPurpleWhite from '../../../assets/lottie/clock_light_purple_white.tgs';
import coreWalletLogo from '../../../assets/lottie/core_wallet_logo.tgs';
import bill from '../../../assets/lottie/duck_bill.tgs';
import forge from '../../../assets/lottie/duck_forges.tgs';
import guard from '../../../assets/lottie/duck_guard.tgs';
import happy from '../../../assets/lottie/duck_happy.tgs';
import hello from '../../../assets/lottie/duck_hello.tgs';
import noData from '../../../assets/lottie/duck_no-data.tgs';
import run from '../../../assets/lottie/duck_run.tgs';
import snitch from '../../../assets/lottie/duck_snitch.tgs';
import thumbUp from '../../../assets/lottie/duck_thumb.tgs';
import holdTon from '../../../assets/lottie/duck_ton.tgs';
import wait from '../../../assets/lottie/duck_wait.tgs';
import yeee from '../../../assets/lottie/duck_yeee.tgs';
import iconEarnDark from '../../../assets/lottie/earn_dark.tgs';
import iconEarnDarkPurple from '../../../assets/lottie/earn_dark_purple.tgs';
import iconEarnLight from '../../../assets/lottie/earn_light.tgs';
import iconEarnLightPurple from '../../../assets/lottie/earn_light_purple.tgs';
import iconSendDark from '../../../assets/lottie/send_dark.tgs';
import iconSendLight from '../../../assets/lottie/send_light.tgs';
import iconSwapDark from '../../../assets/lottie/swap_dark.tgs';
import iconSwapLight from '../../../assets/lottie/swap_light.tgs';
import iconClockPreviewDark from '../../../assets/lottiePreview/clock_dark.svg';
import iconClockPreviewDarkBlue from '../../../assets/lottiePreview/clock_dark_blue.svg';
import iconClockPreviewDarkGray from '../../../assets/lottiePreview/clock_dark_gray.svg';
import iconClockPreviewDarkGrayWhite from '../../../assets/lottiePreview/clock_dark_gray_white.svg';
import iconClockPreviewDarkGreen from '../../../assets/lottiePreview/clock_dark_green.svg';
import iconClockPreviewDarkPurple from '../../../assets/lottiePreview/clock_dark_purple.svg';
import iconClockPreviewDarkPurpleWhite from '../../../assets/lottiePreview/clock_dark_purple_white.svg';
import iconClockPreviewLight from '../../../assets/lottiePreview/clock_light.svg';
import iconClockPreviewLightBlue from '../../../assets/lottiePreview/clock_light_blue.svg';
import iconClockPreviewLightGray from '../../../assets/lottiePreview/clock_light_gray.svg';
import iconClockPreviewLightGrayWhite from '../../../assets/lottiePreview/clock_light_gray_white.svg';
import iconClockPreviewLightGreen from '../../../assets/lottiePreview/clock_light_green.svg';
import iconClockPreviewLightPurple from '../../../assets/lottiePreview/clock_light_purple.svg';
import iconClockPreviewLightPurpleWhite from '../../../assets/lottiePreview/clock_light_purple_white.svg';
import coreWalletLogoPreview from '../../../assets/lottiePreview/core_wallet_logo.png';
import billPreview from '../../../assets/lottiePreview/duck_bill.png';
import forgePreview from '../../../assets/lottiePreview/duck_forges.png';
import guardPreview from '../../../assets/lottiePreview/duck_guard.png';
import happyPreview from '../../../assets/lottiePreview/duck_happy.png';
import helloPreview from '../../../assets/lottiePreview/duck_hello.png';
import noDataPreview from '../../../assets/lottiePreview/duck_no-data.png';
import runPreview from '../../../assets/lottiePreview/duck_run.png';
import snitchPreview from '../../../assets/lottiePreview/duck_snitch.png';
import thumbUpPreview from '../../../assets/lottiePreview/duck_thumb.png';
import holdTonPreview from '../../../assets/lottiePreview/duck_ton.png';
import waitPreview from '../../../assets/lottiePreview/duck_wait.png';
import yeeePreview from '../../../assets/lottiePreview/duck_yeee.png';

export const ANIMATED_STICKERS_PATHS = {
  hello,
  snitch,
  bill,
  thumbUp,
  holdTon,
  happy,
  noData,
  forge,
  wait,
  run,
  yeee,
  guard,
  helloPreview,
  snitchPreview,
  billPreview,
  thumbUpPreview,
  holdTonPreview,
  happyPreview,
  noDataPreview,
  forgePreview,
  waitPreview,
  runPreview,
  yeeePreview,
  guardPreview,
  ...(IS_CORE_WALLET && {
    coreWalletLogo,
    coreWalletLogoPreview,
  }),
  light: {
    iconAdd: iconAddLight,
    iconClock: iconClockLight,
    iconClockBlue: iconClockLightBlue,
    iconClockGray: iconClockLightGray,
    iconClockGrayWhite: iconClockLightGrayWhite,
    iconClockGreen: iconClockLightGreen,
    iconClockPurple: iconClockLightPurple,
    iconClockPurpleWhite: iconClockLightPurpleWhite,
    iconEarn: iconEarnLight,
    iconEarnPurple: iconEarnLightPurple,
    iconSend: iconSendLight,
    iconSwap: iconSwapLight,
    preview: {
      iconClock: iconClockPreviewLight,
      iconClockBlue: iconClockPreviewLightBlue,
      iconClockGray: iconClockPreviewLightGray,
      iconClockGrayWhite: iconClockPreviewLightGrayWhite,
      iconClockGreen: iconClockPreviewLightGreen,
      iconClockPurple: iconClockPreviewLightPurple,
      iconClockPurpleWhite: iconClockPreviewLightPurpleWhite,
    },
  },
  dark: {
    iconAdd: iconAddDark,
    iconClock: iconClockDark,
    iconClockBlue: iconClockDarkBlue,
    iconClockGray: iconClockDarkGray,
    iconClockGrayWhite: iconClockDarkGrayWhite,
    iconClockGreen: iconClockDarkGreen,
    iconClockPurple: iconClockDarkPurple,
    iconClockPurpleWhite: iconClockDarkPurpleWhite,
    iconEarn: iconEarnDark,
    iconEarnPurple: iconEarnDarkPurple,
    iconSend: iconSendDark,
    iconSwap: iconSwapDark,
    preview: {
      iconClock: iconClockPreviewDark,
      iconClockBlue: iconClockPreviewDarkBlue,
      iconClockGray: iconClockPreviewDarkGray,
      iconClockGrayWhite: iconClockPreviewDarkGrayWhite,
      iconClockGreen: iconClockPreviewDarkGreen,
      iconClockPurple: iconClockPreviewDarkPurple,
      iconClockPurpleWhite: iconClockPreviewDarkPurpleWhite,
    },
  },
};
