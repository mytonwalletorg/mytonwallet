import { IS_ANDROID, IS_IOS } from './windowEnvironment';

export default function resolveSlideTransitionName() {
  return IS_ANDROID ? 'slideFadeAndroid' : IS_IOS ? 'slideLayers' : 'slideFade';
}
