package org.mytonwallet.app_air.airasframework

import WNavigationController
import android.Manifest
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.os.Build
import android.os.Bundle
import android.os.SystemClock
import android.util.Log
import android.view.MotionEvent
import android.view.View
import androidx.constraintlayout.widget.ConstraintLayout
import androidx.core.content.ContextCompat
import org.mytonwallet.app_air.airasframework.splash.SplashVC
import org.mytonwallet.app_air.uicomponents.base.WWindow
import org.mytonwallet.app_air.walletcontext.WalletContextManager
import org.mytonwallet.app_air.walletcontext.globalStorage.WGlobalStorage
import org.mytonwallet.app_air.walletcontext.helpers.AutoLockHelper
import org.mytonwallet.app_air.walletcore.JSWebViewBridge
import org.mytonwallet.app_air.walletcore.pushNotifications.AirPushNotifications

class MainWindow : WWindow() {
    private val splashVC by lazy {
        val vc = SplashVC(this)
        WalletContextManager.delegate = vc
        vc
    }

    override fun getKeyNavigationController(): WNavigationController {
        val navigationController = WNavigationController(this)
        navigationController.setRoot(splashVC)
        return navigationController
    }

    private var webViewBridge: JSWebViewBridge? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (!WGlobalStorage.isInitialized) {
            return
        }

        AirAsFrameworkApplication.initTheme(applicationContext)

        restartBridge()

        AutoLockHelper.start(WGlobalStorage.getAppLock().period)

        checkPushNotifications()
    }

    fun restartBridge() {
        val startTime = SystemClock.elapsedRealtime()

        webViewBridge?.destroy()
        webViewBridge = JSWebViewBridge(this)
        webViewBridge!!.visibility = View.GONE
        windowView.addView(webViewBridge, ConstraintLayout.LayoutParams(0, 0))
        webViewBridge!!.setupBridge {
            // Bridge ready now!
            splashVC.bridgeIsReady()

            val endTime = SystemClock.elapsedRealtime()
            Log.d("MTWAirApplication", "Bridge setup took ${endTime - startTime} ms")
        }
    }

    fun destroyBridge() {
        webViewBridge?.destroy()
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)

        AirAsFrameworkApplication.initTheme(applicationContext)
        updateTheme()
    }

    override fun dispatchTouchEvent(event: MotionEvent?): Boolean {
        triggerTouchEvent()
        return super.dispatchTouchEvent(event)
    }

    private var lastTouchEventTimestamp: Long = 0
    private fun triggerTouchEvent() {
        val now = System.currentTimeMillis()
        if (now < lastTouchEventTimestamp + 5000) return
        lastTouchEventTimestamp = now
        AutoLockHelper.resetTimer()
    }

    override fun onResume() {
        super.onResume()
        AutoLockHelper.appResumed()
    }

    override fun onDestroy() {
        super.onDestroy()
        destroyBridge()
    }

    private fun checkPushNotifications() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        ) {
            // Permission already granted
            AirPushNotifications.register()
        } else {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS)) { _, grantResults ->
                if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                    AirPushNotifications.register()
                }
            }
        }
    }

}
