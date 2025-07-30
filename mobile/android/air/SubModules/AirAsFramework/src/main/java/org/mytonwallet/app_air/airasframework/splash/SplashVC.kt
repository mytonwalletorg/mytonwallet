package org.mytonwallet.app_air.airasframework.splash

import WNavigationController
import android.content.Context
import android.graphics.Color
import android.net.Uri
import android.view.View
import androidx.core.net.toUri
import org.mytonwallet.app_air.airasframework.AirAsFrameworkApplication
import org.mytonwallet.app_air.airasframework.LaunchConfig.Companion.setShouldStartOnAir
import org.mytonwallet.app_air.airasframework.MainWindow
import org.mytonwallet.app_air.uiassets.viewControllers.token.TokenVC
import org.mytonwallet.app_air.uicomponents.base.WViewController
import org.mytonwallet.app_air.uicomponents.base.WWindow
import org.mytonwallet.app_air.uicomponents.base.showAlert
import org.mytonwallet.app_air.uicomponents.helpers.PopupHelpers
import org.mytonwallet.app_air.uicomponents.widgets.hideKeyboard
import org.mytonwallet.app_air.uicreatewallet.viewControllers.intro.IntroVC
import org.mytonwallet.app_air.uiinappbrowser.InAppBrowserVC
import org.mytonwallet.app_air.uipasscode.viewControllers.passcodeConfirm.PasscodeConfirmVC
import org.mytonwallet.app_air.uipasscode.viewControllers.passcodeConfirm.PasscodeViewState
import org.mytonwallet.app_air.uireceive.ReceiveVC
import org.mytonwallet.app_air.uisend.send.SendVC
import org.mytonwallet.app_air.uisend.send.SendVC.InitialValues
import org.mytonwallet.app_air.uistake.earn.EarnRootVC
import org.mytonwallet.app_air.uiswap.screens.main.SwapVC
import org.mytonwallet.app_air.walletcontext.R
import org.mytonwallet.app_air.walletcontext.WalletContextManager
import org.mytonwallet.app_air.walletcontext.WalletContextManagerDelegate
import org.mytonwallet.app_air.walletcontext.cacheStorage.WCacheStorage
import org.mytonwallet.app_air.walletcontext.globalStorage.WGlobalStorage
import org.mytonwallet.app_air.walletcontext.helpers.AutoLockHelper
import org.mytonwallet.app_air.walletcontext.helpers.BiometricHelpers
import org.mytonwallet.app_air.walletcontext.helpers.LocaleController
import org.mytonwallet.app_air.walletcontext.helpers.logger.Logger
import org.mytonwallet.app_air.walletcontext.models.MRecentAddress
import org.mytonwallet.app_air.walletcontext.secureStorage.WSecureStorage
import org.mytonwallet.app_air.walletcontext.theme.WColor
import org.mytonwallet.app_air.walletcontext.theme.color
import org.mytonwallet.app_air.walletcore.MAIN_NETWORK
import org.mytonwallet.app_air.walletcore.WalletCore
import org.mytonwallet.app_air.walletcore.WalletEvent
import org.mytonwallet.app_air.walletcore.api.activateAccount
import org.mytonwallet.app_air.walletcore.api.resetAccounts
import org.mytonwallet.app_air.walletcore.api.swapGetAssets
import org.mytonwallet.app_air.walletcore.api.tryUpdatePrices
import org.mytonwallet.app_air.walletcore.deeplink.Deeplink
import org.mytonwallet.app_air.walletcore.deeplink.DeeplinkNavigator
import org.mytonwallet.app_air.walletcore.deeplink.DeeplinkParser
import org.mytonwallet.app_air.walletcore.helpers.TonConnectHelper
import org.mytonwallet.app_air.walletcore.models.MAccount
import org.mytonwallet.app_air.walletcore.models.MBlockchain
import org.mytonwallet.app_air.walletcore.moshi.MApiSwapAsset
import org.mytonwallet.app_air.walletcore.moshi.api.ApiMethod.DApp.StartSseConnection
import org.mytonwallet.app_air.walletcore.moshi.api.ApiMethod.DApp.StartSseConnection.Request
import org.mytonwallet.app_air.walletcore.stores.AccountStore
import org.mytonwallet.app_air.walletcore.stores.TokenStore
import org.mytonwallet.uihome.tabs.TabsVC
import java.io.UnsupportedEncodingException
import java.net.URLEncoder
import java.util.Date

class SplashVC(context: Context) : WViewController(context),
    WalletContextManagerDelegate,
    DeeplinkNavigator {

    override val shouldDisplayTopBar = false

    companion object {
        // Pending deeplink url when launching the app using a deeplink, before creating Splash instance
        var pendingDeeplink: Deeplink? = null
        var sharedInstance: DeeplinkNavigator? = null
    }

    private var appIsUnlocked = false
    private var _isWalletReady = false

    // Pending deeplink to run after the wallet is ready
    private var nextDeeplink: Deeplink? = null

    init {
        sharedInstance = this
        if (pendingDeeplink != null) {
            nextDeeplink = pendingDeeplink;
            pendingDeeplink = null;
        }
    }

    override fun setupViews() {
        super.setupViews()
        updateTheme()
    }

    override fun updateTheme() {
        super.updateTheme()
        view.setBackgroundColor(WColor.Background.color)
    }

    // Presents the view controllers even before bridge becomes ready, to reduce the app start-up time
    var preloadedScreen: WCacheStorage.InitialScreen? = null
    fun preloadScreens() {
        preloadedScreen = null
        view.post { // insets should be loaded first
            if (WalletCore.isBridgeReady)
                return@post // Bridge got ready during view.post process!
            WCacheStorage.getInitialScreen()?.let {
                when (it) {
                    WCacheStorage.InitialScreen.INTRO -> {
                        if (WGlobalStorage.accountIds().isNotEmpty())
                            return@post
                        presentIntro()
                        preloadedScreen = WCacheStorage.InitialScreen.INTRO
                    }

                    WCacheStorage.InitialScreen.HOME -> {
                        return@post
                    }

                    WCacheStorage.InitialScreen.LOCK -> {
                        if (WGlobalStorage.accountIds().isEmpty())
                            return@post
                        presentTabsAndLockScreen(true)
                        preloadedScreen = WCacheStorage.InitialScreen.LOCK
                    }
                }
            }
        }
    }

    fun bridgeIsReady() {
        Logger.i(Logger.LogTag.AIR_APPLICATION, "Bridge Ready, Activating account")
        val accountIds = WGlobalStorage.accountIds()
        if (accountIds.isEmpty()) {
            // Reset and make sure nothing is cached (to handle corrupted global storage conditions)
            resetToIntro()
            return
        }
        var activeAccountId = WGlobalStorage.getActiveAccountId()
        if (nextDeeplink?.accountAddress != null) {
            // Switch to the deeplink account
            activeAccountId = AccountStore.accountIdByAddress(nextDeeplink?.accountAddress)
            if (activeAccountId == null) {
                // Account not found, Ignore the deeplink
                nextDeeplink = null
            }
        }
        WalletCore.activateAccount(
            activeAccountId ?: accountIds.first(),
            notifySDK = true
        ) { res, err ->
            if (res == null || err != null) {
                // Should not happen normally
                Logger.d(Logger.LogTag.ACCOUNT, "Reset accounts on splash error")
                resetToIntro()
            } else {
                WalletCore.tryUpdatePrices()
                WalletCore.swapGetAssets(true)
                if (preloadedScreen == null)
                    presentTabsAndLockScreen(AccountStore.activeAccount?.isPasscodeProtected == true)
            }
            WalletCore.checkPendingBridgeTasks()
        }
    }

    private fun presentIntro() {
        if (preloadedScreen == WCacheStorage.InitialScreen.INTRO)
            return
        val navigationController = WNavigationController(window!!)
        navigationController.setRoot(IntroVC(context))
        window!!.replace(navigationController, false)
        Logger.i(Logger.LogTag.AIR_APPLICATION, "Presented Intro")
    }

    private fun presentTabsAndLockScreen(presentLockScreen: Boolean) {
        val tabsNav = WNavigationController(window!!)
        tabsNav.setRoot(TabsVC(context))
        window!!.replace(tabsNav, false, onCompletion = {
            Logger.i(Logger.LogTag.AIR_APPLICATION, "Presented tabsNav")
            if (presentLockScreen)
                presentLockScreen()
            else {
                appIsUnlocked = true
            }
        })
    }

    private fun resetToIntro() {
        WalletCore.resetAccounts { _, _ ->
            WGlobalStorage.deleteAllWallets()
            WSecureStorage.deleteAllWalletValues()
            appIsUnlocked = true
            presentIntro()
        }
    }

    override fun restartApp() {
        // Make sure we are on splash screen
        if ((window?.navigationControllers?.size ?: 1) > 1) {
            for (i in (window?.navigationControllers!!.size - 2) downTo 1) {
                window?.dismissNav(i)
            }
            window?.dismissLastNav {
                restartApp()
            }
            window?.navigationControllers[0]?.visibility = View.INVISIBLE
            return
        }
        // Reset app
        window?.forceStatusBarLight = null
        window?.forceBottomBarLight = null
        (window as? MainWindow)?.restartBridge(forcedRecreation = true)
    }

    override fun getAddAccountVC(): WViewController {
        return IntroVC(context, false)
    }

    override fun getTabsVC(): WViewController {
        return TabsVC(context)
    }

    override fun themeChanged() {
        AirAsFrameworkApplication.initTheme(window!!.applicationContext)
        window?.updateTheme()
    }

    override fun protectedModeChanged() {
        window?.updateProtectedView()
    }

    override fun lockScreen() {
        if (!appIsUnlocked || AccountStore.activeAccount?.isPasscodeProtected == false)
            return
        PopupHelpers.dismissAllPopups()
        presentLockScreen()
    }

    private fun presentLockScreen() {
        view.hideKeyboard()
        appIsUnlocked = false
        val passcodeConfirmVC = PasscodeConfirmVC(
            context,
            PasscodeViewState.Default(
                LocaleController.getString(R.string.Unlock_Title),
                LocaleController.getString(
                    (if (WGlobalStorage.isBiometricActivated() &&
                        BiometricHelpers.canAuthenticate(window!!)
                    )
                        R.string.Unlock_WalletBiometrics else R.string.Unlock_Wallet)
                ),
                showNavBar = false,
                light = WColor.Tint.color != Color.BLACK && WColor.Tint.color != Color.WHITE,
                showMotionBackgroundDrawable = true,
                animated = true,
                startWithBiometrics = true,
                isUnlockScreen = true
            ),
            task = {
                // After unlock:
                window?.forceStatusBarLight = null
                window?.forceBottomBarLight = null
                window?.dismissLastNav(
                    WWindow.DismissAnimation.SCALE_IN,
                    onCompletion = {
                        appIsUnlocked = true
                        handleDeeplinkIfRequired()
                    })
            },
            allowedToCancel = false
        )
        val navigationController = WNavigationController(window!!)
        navigationController.setRoot(passcodeConfirmVC)
        window!!.present(navigationController)
    }

    override fun isAppUnlocked(): Boolean {
        return appIsUnlocked
    }

    override fun handleDeeplink(deeplink: String): Boolean {
        nextDeeplink = DeeplinkParser.parse(deeplink.toUri())
        val isAValidDeeplink = nextDeeplink != null
        handleDeeplinkIfRequired()
        return isAValidDeeplink
    }

    override fun walletIsReady() {
        _isWalletReady = true
        handleDeeplinkIfRequired()
    }

    override fun isWalletReady(): Boolean {
        return _isWalletReady
    }

    private fun handleDeeplinkIfRequired() {
        if (window?.presentPendingPresentationNav() == true) {
            nextDeeplink = null
            return
        }
        nextDeeplink?.let { handle(it) }
    }

    override fun switchToLegacy() {
        setShouldStartOnAir(context, false)
        context.startActivity(WalletContextManager.getMainActivityIntent(context))
        AutoLockHelper.stop()
        window?.finish()
        sharedInstance = null
    }

    override fun handle(deeplink: Deeplink) {
        if (!_isWalletReady ||
            (!isAppUnlocked() && AccountStore.activeAccount?.accountType != MAccount.AccountType.VIEW)
        ) {
            nextDeeplink = deeplink
            return
        }
        if (window?.presentPendingPresentationNav() == true) {
            nextDeeplink = null
            return
        }
        if (deeplink.accountAddress != null) {
            val accountId =
                AccountStore.accountIdByAddress(deeplink.accountAddress) ?: run {
                    nextDeeplink = null
                    return
                }
            val prevAccountId = AccountStore.activeAccountId
            if (accountId != prevAccountId) {
                val accountExistsInStorage = WGlobalStorage.accountIds().contains(accountId)
                if (!accountExistsInStorage) {
                    // Account is already removed, ignore the deeplink!
                    nextDeeplink = null
                    return
                }
                // Switch to the deeplink account first
                _isWalletReady = false
                WalletCore.activateAccount(
                    accountId,
                    notifySDK = true
                ) { res, err ->
                    if (res == null || err != null) {
                        // Switch account failed, Switch back!
                        prevAccountId?.let {
                            nextDeeplink = null
                            WalletCore.activateAccount(
                                prevAccountId,
                                notifySDK = true
                            ) { res, err ->
                                if (res == null || err != null) {
                                    // Should not happen!
                                    throw Exception("Switch-Back Account Failure")
                                }
                                WalletCore.notifyEvent(WalletEvent.AccountChangedInApp)
                            }
                        }
                    } else {
                        WalletCore.notifyEvent(WalletEvent.AccountChangedInApp)
                    }
                }
                return
            }
        }
        val account = AccountStore.activeAccount
        if (account == null) {
            // Ignore deeplinks when the wallet is not ready yet
            nextDeeplink = null
            return
        }

        when (deeplink) {
            is Deeplink.Invoice -> {
                val addressObj = MRecentAddress(
                    address = deeplink.address,
                    addressAlias = "",
                    dt = Date()
                )

                val navVC = WNavigationController(window!!)
                navVC.setRoot(
                    SendVC(
                        context, deeplink.token, InitialValues(
                            addressObj.address,
                            deeplink.amount,
                            deeplink.comment
                        )
                    )
                )
                window?.present(navVC)
            }

            is Deeplink.TonConnect2 -> {
                val uri = try {
                    encodeUriParams(deeplink.requestUri).toString()
                } catch (t: Throwable) {
                    return
                }

                WalletCore.call(
                    StartSseConnection(
                        Request(
                            url = uri,
                            deviceInfo = TonConnectHelper.deviceInfo,
                            identifier = TonConnectHelper.generateId()
                        )
                    )
                ) { _, _ ->
                    //if (err != null) {
                    // todo?
                    //}
                }
            }

            is Deeplink.Swap -> {
                if (!account.supportsSwap) {
                    showAlert(
                        null,
                        LocaleController.getString(R.string.Swap_NotSupportedOnAccount)
                    )
                    return
                }
                val fromToken = TokenStore.getToken(deeplink.from)
                val toToken = TokenStore.getToken(deeplink.to)
                val swapVC = SwapVC(
                    context,
                    if (fromToken != null) MApiSwapAsset.from(fromToken) else null,
                    if (toToken != null) MApiSwapAsset.from(toToken) else null,
                    deeplink.amountIn
                )
                val navVC = WNavigationController(window!!)
                navVC.setRoot(swapVC)
                window?.present(navVC)
            }

            is Deeplink.BuyWithCard -> {
                if (!account.supportsBuyWithCard) {
                    showAlert(
                        null,
                        LocaleController.getString(R.string.Receive_BuyNotSupported)
                    )
                }
                val navVC = WNavigationController(window!!)
                navVC.setRoot(ReceiveVC(context, MBlockchain.ton, true))
                window?.present(navVC)
            }

            is Deeplink.Stake -> {
                if (WalletCore.activeNetwork != MAIN_NETWORK) {
                    showAlert(
                        null,
                        LocaleController.getString(R.string.Stake_NotSupportedOnTestnet)
                    )
                }
                val navVC = WNavigationController(window!!)
                navVC.setRoot(EarnRootVC(context))
                window?.present(navVC)
            }

            is Deeplink.Url -> {
                val inAppBrowserVC = InAppBrowserVC(
                    context,
                    null,
                    deeplink.config
                )
                val nav = WNavigationController(window!!)
                nav.setRoot(inAppBrowserVC)
                window?.present(nav)
            }

            is Deeplink.Jetton -> {
                val token = TokenStore.getToken(deeplink.slug)
                if (token != null) {
                    val tokenVC = TokenVC(
                        context,
                        token
                    )
                    val nav = WNavigationController(window!!)
                    nav.setRoot(tokenVC)
                    window?.present(nav)
                }
            }

            is Deeplink.StakeTx -> {
                val nav = WNavigationController(window!!)
                nav.setRoot(EarnRootVC(context))
                window?.present(nav)
                // TODO:: Handle and use deeplink.stakingId
            }

            is Deeplink.Transaction -> {
                // TODO:: Handle and use deeplink.txId
            }
        }

        nextDeeplink = null
    }

    private fun encodeUriParams(uri: Uri): Uri {
        val builder = Uri.Builder()
            .scheme(uri.scheme)
            .authority(uri.authority)

        for (param in uri.queryParameterNames) {
            val value = uri.getQueryParameter(param)
            if (value != null) {
                try {
                    val encodedValue = URLEncoder.encode(value, "UTF-8")
                    builder.appendQueryParameter(param, encodedValue)
                } catch (e: UnsupportedEncodingException) {
                    e.printStackTrace()
                }
            }
        }

        return builder.build()
    }
}
