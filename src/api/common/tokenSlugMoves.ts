import { createCallbackManager } from '../../util/callbacks';

/**
 * Reports the slugs whose balances the catalog made stale, so the balance streams refetch them: a slug whose token moved
 * to its full slug and left it to another token, as a balance stored under it belongs to the previous holder, and the
 * full slug a catalog token left for its backend slug.
 */
const slugMoveListeners = createCallbackManager<(slugs: string[]) => void>();

export const onTokenSlugsMove = slugMoveListeners.addCallback;
export const notifyTokenSlugsMove = slugMoveListeners.runCallbacks;
