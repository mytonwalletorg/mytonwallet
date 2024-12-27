import type { ApiMtwCardBorderShineType, ApiNft } from '../api/types';

import buildClassName from '../util/buildClassName';

import { getCardNftImageUrl } from '../components/main/sections/Card/helpers/getCardNftImageUrl';

interface CardCustomizationResult {
  backgroundImageUrl?: string;
  withTextGradient: boolean;
  classNames: string;
  borderShineType?: ApiMtwCardBorderShineType;
}

export default function useCardCustomization(
  cardNft?: ApiNft,
): CardCustomizationResult {
  const { mtwCardType, mtwCardTextType, mtwCardBorderShineType } = cardNft?.metadata || {};
  const withTextGradient = !!mtwCardType && mtwCardType !== 'standard';
  const mtwCardTextTypeClass = mtwCardType !== 'standard'
    ? undefined
    : (mtwCardTextType === 'dark' ? 'MtwCard__darkText' : 'MtwCard__lightText');

  const backgroundImageUrl = cardNft ? getCardNftImageUrl(cardNft) : undefined;

  return {
    backgroundImageUrl,
    withTextGradient,
    classNames: buildClassName(mtwCardType && `MtwCard__${mtwCardType}`, mtwCardTextTypeClass),
    borderShineType: mtwCardBorderShineType,
  };
}
