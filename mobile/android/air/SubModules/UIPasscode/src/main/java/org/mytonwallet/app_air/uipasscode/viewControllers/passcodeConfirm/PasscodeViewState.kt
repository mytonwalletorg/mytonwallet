package org.mytonwallet.app_air.uipasscode.viewControllers.passcodeConfirm

import android.view.View
import org.mytonwallet.app_air.walletcontext.theme.ThemeManager

sealed class PasscodeViewState {

    open val navbarTitle: String? = null

    data class Default(
        val title: String,
        val subtitle: String,
        override val navbarTitle: String? = null,
        val showNavigationSeparator: Boolean = true,
        val showNavBar: Boolean = true,
        val light: Boolean = ThemeManager.isDark,
        val showMotionBackgroundDrawable: Boolean = false,
        val animated: Boolean = false,
        val startWithBiometrics: Boolean = false,
        val isUnlockScreen: Boolean = false
    ) : PasscodeViewState()

    data class CustomHeader(
        val headerView: View,
        override val navbarTitle: String? = null,
        val showNavbarTitle: Boolean = true
    ) : PasscodeViewState()

}
