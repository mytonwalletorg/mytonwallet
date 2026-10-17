package org.mytonwallet.app_air.uitonconnect

import android.content.Intent
import android.net.Uri
import androidx.lifecycle.lifecycleScope
import java.lang.ref.WeakReference
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.mytonwallet.app_air.uicomponents.base.WNavigationController
import org.mytonwallet.app_air.uicomponents.base.WWindow
import org.mytonwallet.app_air.uicomponents.base.showAlert
import org.mytonwallet.app_air.uicomponents.extensions.startActivityCatching
import org.mytonwallet.app_air.uitonconnect.viewControllers.connect.TonConnectRequestConnectVC
import org.mytonwallet.app_air.uitonconnect.viewControllers.send.requestSend.TonConnectRequestSendVC
import org.mytonwallet.app_air.walletbasecontext.localization.LocaleController
import org.mytonwallet.app_air.walletbasecontext.logger.Logger
import org.mytonwallet.app_air.walletcontext.WalletContextManager
import org.mytonwallet.app_air.walletcore.WalletCore
import org.mytonwallet.app_air.walletcore.WalletEvent
import org.mytonwallet.app_air.walletcore.helpers.DappDeeplinkReturnTracker
import org.mytonwallet.app_air.walletcore.helpers.TonConnectHelper
import org.mytonwallet.app_air.walletcore.moshi.ApiConnectionType
import org.mytonwallet.app_air.walletcore.moshi.ReturnStrategy
import org.mytonwallet.app_air.walletcore.moshi.api.ApiMethod
import org.mytonwallet.app_air.walletcore.moshi.api.ApiUpdate

class TonConnectController(private val window: WWindow) :
    WalletCore.UpdatesObserver,
    WalletCore.EventObserver {
    private class AccountRequest(
        val accountId: String,
        val promiseId: String,
        val onActivated: (accountChanged: Boolean) -> Unit
    )

    private class DeferredRequest(val promiseId: String)

    private val pendingAccountRequests = ArrayDeque<AccountRequest>()
    private var activatingRequest: AccountRequest? = null
    private val deferredRequests = mutableSetOf<DeferredRequest>()

    companion object {
        private var loadingConnectRequestViewController:
            WeakReference<TonConnectRequestConnectVC>? = null
        private var loadingSendRequestViewController: WeakReference<TonConnectRequestSendVC>? =
            null

        private class PendingReturn(val promiseId: String, val strategy: ReturnStrategy)
        private class PendingError(val promiseId: String, val error: String)

        private var pendingReturn: PendingReturn? = null
        private var pendingError: PendingError? = null

        fun handleRequestSettled(
            window: WWindow,
            promiseId: String,
            returnStrategy: String,
            error: String?
        ) {
            val isRequestNavPresented = window.navigationControllers.any {
                (it as? DappRequestNavigationController)?.promiseId == promiseId
            }
            if (error != null) {
                pendingReturn = null
                if (isRequestNavPresented) {
                    pendingError = PendingError(promiseId, error)
                } else {
                    WalletContextManager.delegate?.get()?.showError(error)
                }
                return
            }
            val strategy = ReturnStrategy.fromDeeplinkValue(returnStrategy)
            if (strategy == ReturnStrategy.None) return
            if (isRequestNavPresented) {
                pendingReturn = PendingReturn(promiseId, strategy)
            } else {
                performReturnStrategy(window, strategy)
            }
        }

        internal fun onRequestNavDismissed(nav: DappRequestNavigationController) {
            pendingError?.let { pending ->
                if (pending.promiseId != nav.promiseId) return@let
                pendingError = null
                nav.window.lifecycleScope.launch(Dispatchers.Main) {
                    WalletContextManager.delegate?.get()?.showError(pending.error)
                }
                return
            }
            val pending = pendingReturn ?: return
            if (pending.promiseId != nav.promiseId) return
            pendingReturn = null
            performReturnStrategy(nav.window, pending.strategy)
        }

        private fun performReturnStrategy(window: WWindow, strategy: ReturnStrategy) {
            when (strategy) {
                is ReturnStrategy.Url -> {
                    val uri = strategy.uri
                    val opened = uri != null &&
                        window.startActivityCatching(Intent(Intent.ACTION_VIEW, uri))
                    if (!opened) window.moveTaskToBack(true)
                }

                ReturnStrategy.Back, ReturnStrategy.Empty -> window.moveTaskToBack(true)

                ReturnStrategy.None -> {}
            }
        }

        fun setLoadingConnectRequestViewController(vc: TonConnectRequestConnectVC): Boolean {
            if (loadingConnectRequestViewController?.get()?.isDestroyed == false) {
                return false // A loading screen already shown
            }
            loadingConnectRequestViewController = WeakReference(vc)
            return true
        }

        fun setLoadingSendRequestViewController(vc: TonConnectRequestSendVC): Boolean {
            if (loadingSendRequestViewController?.get()?.isDestroyed == false) {
                return false // A loading screen already shown
            }
            loadingSendRequestViewController = WeakReference(vc)
            return true
        }

        fun connectStart(link: String) {
            WalletCore.call(
                ApiMethod.DApp.TonConnectHandleDeepLink(
                    url = link,
                    identifier = TonConnectHelper.generateId()
                )
            ) { _, err ->
                if (err != null) {
                    Logger.e(Logger.LogTag.TON_CONNECT, "handleDeeplink: $err")
                }
            }
        }
    }

    override fun onBridgeUpdate(update: ApiUpdate) {
        when (update) {
            is ApiUpdate.ApiUpdateDappCloseLoading -> {
                update.connectionType?.let { closeLoadingPlaceholder(it) }
            }

            is ApiUpdate.ApiUpdateDappConnect -> {
                DappDeeplinkReturnTracker.bindTonConnectRequest(
                    update.dapp.sse?.appClientId,
                    update.promiseId
                )
                doOnWalletReady(update.promiseId) {
                    WalletCore.recordTonConnectEvent(
                        "wallet-connect-request-ui-displayed",
                        update.promiseId
                    )
                    val loadingVC = loadingConnectRequestViewController?.get()
                        ?.takeIf { !it.isDestroyed }
                    if (loadingVC != null) {
                        (loadingVC.navigationController as? DappRequestNavigationController)
                            ?.promiseId = update.promiseId
                        loadingVC.setDappUpdate(update)
                        loadingConnectRequestViewController = null
                    } else {
                        if (window.isAnimating) {
                            WalletCore.call(
                                ApiMethod.DApp.CancelDappRequest(
                                    promiseId = update.promiseId,
                                    reason = LocaleController.getString("Canceled by the user")
                                )
                            ) { _, _ ->
                                if (DappDeeplinkReturnTracker.consumeCompletedRequest(
                                        update.promiseId
                                    )
                                ) {
                                    window.moveTaskToBack(true)
                                }
                            }
                            return@doOnWalletReady
                        }
                        val navVC = DappRequestNavigationController(
                            window,
                            WNavigationController.PresentationConfig(
                                style = WNavigationController.PresentationStyle.BottomSheet
                            )
                        )
                        navVC.promiseId = update.promiseId
                        navVC.setRoot(TonConnectRequestConnectVC(window, update))
                        window.presentOnWalletReady(navVC)
                    }
                }
            }

            is ApiUpdate.ApiUpdateDappSendTransactions -> {
                DappDeeplinkReturnTracker.bindTonConnectRequest(
                    update.dapp.sse?.appClientId,
                    update.promiseId
                )
                enqueueAccountRequest(update.accountId, update.promiseId) { accountChanged ->
                    doOnWalletReady(update.promiseId) {
                        WalletCore.recordTonConnectEvent(
                            "wallet-transaction-confirmation-ui-displayed",
                            update.promiseId
                        )
                        val loadingVC = loadingSendRequestViewController?.get()
                            ?.takeIf { !it.isDestroyed }
                        if (accountChanged) {
                            dismissNavsBelow(loadingVC)
                        }
                        if (loadingVC != null) {
                            (loadingVC.navigationController as? DappRequestNavigationController)
                                ?.promiseId = update.promiseId
                            loadingVC.setUpdate(update)
                            loadingSendRequestViewController = null
                        } else {
                            val navVC = DappRequestNavigationController(
                                window,
                                WNavigationController.PresentationConfig.PreferredFullScreen
                            )
                            navVC.promiseId = update.promiseId
                            navVC.setRoot(
                                TonConnectRequestSendVC(
                                    window,
                                    ApiConnectionType.SEND_TRANSACTION,
                                    update
                                )
                            )
                            window.presentOnWalletReady(navVC)
                        }
                    }
                }
            }

            is ApiUpdate.ApiUpdateDappSignData -> {
                DappDeeplinkReturnTracker.bindTonConnectRequest(
                    update.dapp.sse?.appClientId,
                    update.promiseId
                )
                enqueueAccountRequest(update.accountId, update.promiseId) { accountChanged ->
                    doOnWalletReady(update.promiseId) {
                        WalletCore.recordTonConnectEvent(
                            "wallet-sign-data-confirmation-ui-displayed",
                            update.promiseId
                        )
                        val loadingVC = loadingSendRequestViewController?.get()
                            ?.takeIf { !it.isDestroyed }
                        if (accountChanged) {
                            dismissNavsBelow(loadingVC)
                        }
                        if (loadingVC != null) {
                            (loadingVC.navigationController as? DappRequestNavigationController)
                                ?.promiseId = update.promiseId
                            loadingVC.setUpdate(update)
                            loadingSendRequestViewController = null
                        } else {
                            val navVC = DappRequestNavigationController(
                                window,
                                WNavigationController.PresentationConfig.PreferredFullScreen
                            )
                            navVC.promiseId = update.promiseId
                            navVC.setRoot(
                                TonConnectRequestSendVC(
                                    window,
                                    ApiConnectionType.SIGN_DATA,
                                    update
                                )
                            )
                            window.presentOnWalletReady(navVC)
                        }
                    }
                }
            }

            is ApiUpdate.ApiUpdateDappAlreadyConnected -> {
                val url = update.url
                window.topViewController?.showAlert(
                    title = LocaleController.getString("Already Connected"),
                    text = LocaleController.getString(
                        "Return to the dapp to proceed, or reconnect."
                    ),
                    button = LocaleController.getString("OK"),
                    buttonPressed = { url?.let { openExternalUri(Uri.parse(it)) } },
                    secondaryButton = if (url !=
                        null
                    ) {
                        LocaleController.getString("Cancel")
                    } else {
                        null
                    }
                )
            }

            is ApiUpdate.ApiUpdateDappRequestSettled -> {
                handleRequestSettled(window, update.promiseId, update.returnStrategy, update.error)
            }

            is ApiUpdate.ApiUpdateDappDisconnected -> {
                val url = update.url
                window.topViewController?.showAlert(
                    title = LocaleController.getString("Dapp Disconnected"),
                    text = LocaleController.getString(
                        "Please reconnect your wallet from the dapp."
                    ),
                    button = LocaleController.getString("OK"),
                    buttonPressed = { url?.let { openExternalUri(Uri.parse(it)) } },
                    secondaryButton = if (url !=
                        null
                    ) {
                        LocaleController.getString("Cancel")
                    } else {
                        null
                    }
                )
            }

            else -> {}
        }
    }

    override fun onWalletEvent(walletEvent: WalletEvent) {
        if (walletEvent is WalletEvent.AccountsReset) rejectQueuedRequests()
    }

    fun onCreate() {
        WalletCore.registerObserver(this)
        WalletCore.subscribeToApiUpdates(ApiUpdate.ApiUpdateDappConnect::class.java, this)
        WalletCore.subscribeToApiUpdates(ApiUpdate.ApiUpdateDappSendTransactions::class.java, this)
        WalletCore.subscribeToApiUpdates(ApiUpdate.ApiUpdateDappSignData::class.java, this)
        WalletCore.subscribeToApiUpdates(ApiUpdate.ApiUpdateDappAlreadyConnected::class.java, this)
        WalletCore.subscribeToApiUpdates(ApiUpdate.ApiUpdateDappDisconnected::class.java, this)
        WalletCore.subscribeToApiUpdates(ApiUpdate.ApiUpdateDappRequestSettled::class.java, this)
        WalletCore.subscribeToApiUpdates(ApiUpdate.ApiUpdateDappCloseLoading::class.java, this)
    }

    fun onDestroy() {
        WalletCore.unregisterObserver(this)
        WalletCore.unsubscribeFromApiUpdates(ApiUpdate.ApiUpdateDappConnect::class.java, this)
        WalletCore.unsubscribeFromApiUpdates(
            ApiUpdate.ApiUpdateDappSendTransactions::class.java,
            this
        )
        WalletCore.unsubscribeFromApiUpdates(
            ApiUpdate.ApiUpdateDappSignData::class.java,
            this
        )
        WalletCore.unsubscribeFromApiUpdates(
            ApiUpdate.ApiUpdateDappAlreadyConnected::class.java,
            this
        )
        WalletCore.unsubscribeFromApiUpdates(
            ApiUpdate.ApiUpdateDappDisconnected::class.java,
            this
        )
        WalletCore.unsubscribeFromApiUpdates(
            ApiUpdate.ApiUpdateDappRequestSettled::class.java,
            this
        )
        WalletCore.unsubscribeFromApiUpdates(
            ApiUpdate.ApiUpdateDappCloseLoading::class.java,
            this
        )
    }

    // A request that fails before it reaches the screen leaves only its loading placeholder, which would otherwise wait
    // forever. A filled request is left alone: it belongs to the user's decision.
    private fun closeLoadingPlaceholder(connectionType: ApiConnectionType) {
        val placeholder = when (connectionType) {
            ApiConnectionType.CONNECT ->
                loadingConnectRequestViewController?.get()
                    ?.takeIf { !it.isDestroyed && it.isPlaceholder }

            ApiConnectionType.SEND_TRANSACTION, ApiConnectionType.SIGN_DATA ->
                loadingSendRequestViewController?.get()
                    ?.takeIf { !it.isDestroyed && it.isPlaceholderFor(connectionType) }
        } ?: return
        val navigationController = placeholder.navigationController ?: return
        if (!window.discardPendingPresentationNav(navigationController)) {
            window.dismissNav(navigationController)
        }
        if (connectionType == ApiConnectionType.CONNECT) {
            loadingConnectRequestViewController = null
        } else {
            loadingSendRequestViewController = null
        }
    }

    // One activation at a time, after startup activation: an overlapping one drops the other's callback
    private fun enqueueAccountRequest(
        accountId: String,
        promiseId: String,
        onActivated: (accountChanged: Boolean) -> Unit
    ) {
        pendingAccountRequests.addLast(AccountRequest(accountId, promiseId, onActivated))
        activateNextRequestAccount()
    }

    private fun activateNextRequestAccount() {
        if (activatingRequest != null) return
        val request = pendingAccountRequests.removeFirstOrNull() ?: return
        activatingRequest = request
        window.doOnWalletReady {
            if (activatingRequest !== request) return@doOnWalletReady
            WalletCore.ensureAccountActivated(
                request.accountId,
                onFailure = {
                    if (activatingRequest === request) {
                        activatingRequest = null
                        rejectRequest(request.promiseId)
                        activateNextRequestAccount()
                    }
                }
            ) { accountChanged ->
                if (activatingRequest === request) {
                    activatingRequest = null
                    request.onActivated(accountChanged)
                    activateNextRequestAccount()
                }
            }
        }
    }

    private fun doOnWalletReady(promiseId: String, task: () -> Unit) {
        val deferred = DeferredRequest(promiseId)
        deferredRequests.add(deferred)
        window.doOnWalletReady {
            if (deferredRequests.remove(deferred)) task()
        }
    }

    // The next wallet reuses the account ids, so a request kept across a reset would be signed by it
    private fun rejectQueuedRequests() {
        val promiseIds = deferredRequests.map { it.promiseId } +
            listOfNotNull(activatingRequest?.promiseId) +
            pendingAccountRequests.map { it.promiseId }
        deferredRequests.clear()
        activatingRequest = null
        pendingAccountRequests.clear()
        promiseIds.forEach(::rejectRequest)
    }

    private fun rejectRequest(promiseId: String) {
        WalletCore.call(ApiMethod.DApp.CancelDappRequest(promiseId, null)) { _, _ -> }
    }

    // Dismisses each screen stacked between the tabs and the loading request once. Dismissing the top screen only
    // starts its animation, so re-checking the stack until the screen is gone would never end.
    private fun dismissNavsBelow(loadingVC: TonConnectRequestSendVC?) {
        val loadingNav = loadingVC?.navigationController
        window.navigationControllers
            .drop(1)
            .takeWhile { it !== loadingNav }
            .reversed()
            .forEach { window.dismissNav(it) }
    }

    private fun openExternalUri(uri: Uri) {
        window.startActivityCatching(Intent(Intent.ACTION_VIEW, uri))
    }
}
