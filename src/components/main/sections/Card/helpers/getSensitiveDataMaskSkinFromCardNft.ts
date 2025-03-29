import type { ApiNft } from '../../../../../api/types';
import type { SensitiveDataMaskSkin } from '../../../../common/SensitiveDataMask';

export default function getSensitiveDataMaskSkinFromCardNft(cardNft?: ApiNft): SensitiveDataMaskSkin {
  const { mtwCardType, mtwCardTextType } = cardNft?.metadata || {};

  return mtwCardType === 'gold'
    ? 'cardGoldText'
    : mtwCardType === 'silver' || mtwCardTextType === 'dark'
      ? 'cardDarkText'
      : 'cardLightText';
}
