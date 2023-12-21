import { IS_ANDROID, IS_IOS } from './windowEnvironment';

export default function resolveModalTransitionName() {
  return IS_ANDROID ? 'slideFadeAndroid' : IS_IOS ? 'slideLayers' : 'slideFade';
}
