package org.mytonwallet.app_air.uitonconnect.controller

import WNavigationController
import org.mytonwallet.app_air.uicomponents.base.WWindow
import org.mytonwallet.app_air.uitonconnect.screen.TonConnectRequestConnectVC
import org.mytonwallet.app_air.uitonconnect.screen.TonConnectRequestSendVC
import org.mytonwallet.app_air.walletcore.WalletCore
import org.mytonwallet.app_air.walletcore.helpers.TonConnectHelper
import org.mytonwallet.app_air.walletcore.models.MAccount
import org.mytonwallet.app_air.walletcore.moshi.api.ApiMethod
import org.mytonwallet.app_air.walletcore.moshi.api.ApiUpdate
import org.mytonwallet.app_air.walletcore.stores.AccountStore

class TonConnectController(private val window: WWindow) : WalletCore.UpdatesObserver {
    fun connectStart(link: String) {
        WalletCore.call(
            ApiMethod.DApp.StartSseConnection(
                ApiMethod.DApp.StartSseConnection.Request(
                    url = link,
                    identifier = TonConnectHelper.generateId(),
                    deviceInfo = TonConnectHelper.deviceInfo
                )
            )
        ) { _, _ -> }
    }

    override fun onBridgeUpdate(update: ApiUpdate) {
        if (AccountStore.activeAccount?.accountType == MAccount.AccountType.VIEW)
            return
        when (update) {

            is ApiUpdate.ApiUpdateDappSendTransactions -> {
                val navVC = WNavigationController(window)
                navVC.setRoot(TonConnectRequestSendVC(window, update))
                window.presentOnWalletReady(navVC)
            }

            is ApiUpdate.ApiUpdateDappConnect -> {
                val navVC = WNavigationController(
                    window, WNavigationController.PresentationConfig(
                        overFullScreen = false,
                        isBottomSheet = true
                    )
                )
                navVC.setRoot(TonConnectRequestConnectVC(window, update))
                window.presentOnWalletReady(navVC)
            }

            else -> {}
        }
    }

    fun onCreate() {
        WalletCore.subscribeToApiUpdates(ApiUpdate.ApiUpdateDappConnect::class.java, this)
        WalletCore.subscribeToApiUpdates(ApiUpdate.ApiUpdateDappSendTransactions::class.java, this)
    }

    fun onDestroy() {
        WalletCore.unsubscribeFromApiUpdates(ApiUpdate.ApiUpdateDappConnect::class.java, this)
        WalletCore.unsubscribeFromApiUpdates(
            ApiUpdate.ApiUpdateDappSendTransactions::class.java,
            this
        )
    }
}
