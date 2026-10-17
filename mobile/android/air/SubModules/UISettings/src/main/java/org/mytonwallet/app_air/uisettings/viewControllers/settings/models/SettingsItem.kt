package org.mytonwallet.app_air.uisettings.viewControllers.settings.models

import org.mytonwallet.app_air.uisettings.R
import org.mytonwallet.app_air.walletcore.models.MAccount

data class SettingsItem(
    val identifier: Identifier,
    val icon: Int? = null,
    val title: CharSequence,
    val subtitle: String? = null,
    val value: String? = null,
    val hasTintColor: Boolean,
    val account: MAccount? = null,
    // Stable resource id for UI automation
    val testViewId: Int? = identifier.testViewId
) {
    enum class Identifier {
        ACCOUNT,
        SHOW_ALL_WALLETS,
        ADD_ACCOUNT,
        PORTFOLIO,
        NOTIFICATION_SETTINGS,
        APPEARANCE,
        ASSETS_AND_ACTIVITY,
        CONNECTED_APPS,
        LANGUAGE,
        SECURITY,
        MFA,
        SUBWALLETS,
        WALLET_VERSIONS,
        ASK_A_QUESTION,
        HELP_CENTER,
        MTW_FEATURES,
        USE_RESPONSIBILITY,
        MTW_CARDS_NFT,
        INSTALL_ON_DESKTOP,
        ABOUT_MTW,
        SWITCH_TO_LEGACY,
        NONE;

        /** Stable resource id of the Settings list row, for UI automation; `null` where rows repeat (accounts) or have no identity */
        val testViewId: Int?
            get() = when (this) {
                ADD_ACCOUNT -> R.id.settings_item_add_account
                SHOW_ALL_WALLETS -> R.id.settings_item_show_all_wallets
                PORTFOLIO -> R.id.settings_item_portfolio
                NOTIFICATION_SETTINGS -> R.id.settings_item_notification_settings
                APPEARANCE -> R.id.settings_item_appearance
                ASSETS_AND_ACTIVITY -> R.id.settings_item_assets_and_activity
                CONNECTED_APPS -> R.id.settings_item_connected_apps
                LANGUAGE -> R.id.settings_item_language
                SECURITY -> R.id.settings_item_security
                MFA -> R.id.settings_item_mfa
                SUBWALLETS -> R.id.settings_item_subwallets
                WALLET_VERSIONS -> R.id.settings_item_wallet_versions
                ASK_A_QUESTION -> R.id.settings_item_ask_a_question
                HELP_CENTER -> R.id.settings_item_help_center
                MTW_FEATURES -> R.id.settings_item_mtw_features
                USE_RESPONSIBILITY -> R.id.settings_item_use_responsibility
                MTW_CARDS_NFT -> R.id.settings_item_mtw_cards_nft
                INSTALL_ON_DESKTOP -> R.id.settings_item_install_on_desktop
                ABOUT_MTW -> R.id.settings_item_about_mtw
                ACCOUNT, SWITCH_TO_LEGACY, NONE -> null
            }
    }

    override fun equals(other: Any?): Boolean {
        if (this == other) return true
        if (other !is SettingsItem) return false
        return identifier == other.identifier
    }

    override fun hashCode(): Int = (identifier.toString() + '_' + account?.accountId).hashCode()
}
