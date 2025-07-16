package org.mytonwallet.app_air.airasframework

import android.animation.ValueAnimator
import android.content.Context
import android.content.res.Configuration
import android.util.Log
import com.facebook.drawee.backends.pipeline.Fresco
import org.mytonwallet.app_air.uicomponents.helpers.FontManager
import org.mytonwallet.app_air.walletcontext.cacheStorage.WCacheStorage
import org.mytonwallet.app_air.walletcontext.globalStorage.IGlobalStorageProvider
import org.mytonwallet.app_air.walletcontext.globalStorage.WGlobalStorage
import org.mytonwallet.app_air.walletcontext.helpers.ApplicationContextHolder
import org.mytonwallet.app_air.walletcontext.helpers.DevicePerformanceClassifier
import org.mytonwallet.app_air.walletcontext.helpers.LauncherIconController
import org.mytonwallet.app_air.walletcontext.secureStorage.WSecureStorage
import org.mytonwallet.app_air.walletcontext.theme.ThemeManager
import org.mytonwallet.app_air.walletcore.stores.AccountStore
import org.mytonwallet.app_air.walletcore.stores.ActivityStore
import org.mytonwallet.app_air.walletcore.stores.BalanceStore
import org.mytonwallet.app_air.walletcore.stores.TokenStore

class AirAsFrameworkApplication {

    companion object {
        fun onCreate(
            applicationContext: Context,
            globalStorageProvider: IGlobalStorageProvider
        ) {
            Log.i("MTWAirApplication", "Initializing basic required objects")
            val start = System.currentTimeMillis()

            var t = System.currentTimeMillis()
            ApplicationContextHolder.update(applicationContext)
            Log.i(
                "MTWAirApplication",
                "ApplicationContextHolder.update: ${System.currentTimeMillis() - t}ms"
            )

            t = System.currentTimeMillis()
            WSecureStorage.init(applicationContext)
            Log.i("MTWAirApplication", "WSecureStorage.init: ${System.currentTimeMillis() - t}ms")

            t = System.currentTimeMillis()
            WCacheStorage.init(applicationContext)
            Log.i("MTWAirApplication", "WCacheStorage.init: ${System.currentTimeMillis() - t}ms")

            t = System.currentTimeMillis()
            WGlobalStorage.init(globalStorageProvider)
            Log.i("MTWAirApplication", "WGlobalStorage.init: ${System.currentTimeMillis() - t}ms")

            t = System.currentTimeMillis()
            FontManager.init(applicationContext)
            Log.i("MTWAirApplication", "FontManager.init: ${System.currentTimeMillis() - t}ms")

            t = System.currentTimeMillis()
            initTheme(applicationContext)
            Log.i("MTWAirApplication", "initTheme: ${System.currentTimeMillis() - t}ms")

            t = System.currentTimeMillis()
            Fresco.initialize(applicationContext)
            Log.i("MTWAirApplication", "Fresco.initialize: ${System.currentTimeMillis() - t}ms")

            t = System.currentTimeMillis()
            ActivityStore.loadFromCache()
            Log.i(
                "MTWAirApplication",
                "ActivityStore.loadFromCache: ${System.currentTimeMillis() - t}ms"
            )

            t = System.currentTimeMillis()
            BalanceStore.loadFromCache()
            Log.i(
                "MTWAirApplication",
                "BalanceStore.loadFromCache: ${System.currentTimeMillis() - t}ms"
            )

            t = System.currentTimeMillis()
            TokenStore.loadFromCache()
            Log.i(
                "MTWAirApplication",
                "TokenStore.loadFromCache: ${System.currentTimeMillis() - t}ms"
            )

            t = System.currentTimeMillis()
            ValueAnimator.setFrameDelay(8)
            Log.i(
                "MTWAirApplication",
                "ValueAnimator.setFrameDelay: ${System.currentTimeMillis() - t}ms"
            )

            t = System.currentTimeMillis()
            LauncherIconController.tryFixLauncherIconIfNeeded(applicationContext)
            Log.i(
                "MTWAirApplication",
                "LauncherIconController.tryFixLauncherIconIfNeeded: ${System.currentTimeMillis() - t}ms"
            )

            t = System.currentTimeMillis()
            DevicePerformanceClassifier.init(applicationContext)
            Log.i(
                "MTWAirApplication",
                "DevicePerformanceClassifier.init: ${System.currentTimeMillis() - t}ms"
            )

            val end = System.currentTimeMillis()
            Log.i("MTWAirApplication", "Total initialization time: ${end - start}ms")
        }

        fun initTheme(applicationContext: Context) {
            val accountId = AccountStore.activeAccountId ?: WGlobalStorage.getActiveAccountId()
            val selectedTheme = WGlobalStorage.getActiveTheme()
            when (selectedTheme) {
                ThemeManager.THEME_LIGHT -> {
                    ThemeManager.init(ThemeManager.THEME_LIGHT, accountId = accountId)
                }

                ThemeManager.THEME_DARK -> {
                    ThemeManager.init(ThemeManager.THEME_DARK, accountId = accountId)
                }

                ThemeManager.THEME_SYSTEM -> {
                    val nightModeFlags =
                        applicationContext.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK
                    when (nightModeFlags) {
                        Configuration.UI_MODE_NIGHT_YES -> ThemeManager.init(
                            ThemeManager.THEME_DARK,
                            accountId = accountId
                        )

                        Configuration.UI_MODE_NIGHT_NO -> ThemeManager.init(
                            ThemeManager.THEME_LIGHT,
                            accountId = accountId
                        )

                        Configuration.UI_MODE_NIGHT_UNDEFINED -> ThemeManager.init(
                            ThemeManager.THEME_LIGHT,
                            accountId = accountId
                        )
                    }
                }
            }
        }
    }
}
