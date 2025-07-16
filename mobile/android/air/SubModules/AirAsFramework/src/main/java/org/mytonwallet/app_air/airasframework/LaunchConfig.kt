package org.mytonwallet.app_air.airasframework

import android.content.Context
import androidx.core.content.edit

class LaunchConfig {
    companion object {
        private const val LAUNCHER_PREF_NAME = "Launcher"
        private const val LAUNCHER_PREF_START_ON_AIR_KEY = "isOnAir"

        fun shouldStartOnAir(context: Context): Boolean {
            return context.getSharedPreferences(
                LAUNCHER_PREF_NAME,
                Context.MODE_PRIVATE
            ).getBoolean(LAUNCHER_PREF_START_ON_AIR_KEY, true)
        }

        fun setShouldStartOnAir(context: Context, newValue: Boolean) {
            context.getSharedPreferences(
                LAUNCHER_PREF_NAME,
                Context.MODE_PRIVATE
            ).edit { putBoolean(LAUNCHER_PREF_START_ON_AIR_KEY, newValue) }
        }
    }
}
