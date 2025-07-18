package org.mytonwallet.app_air.uisettings.viewControllers.settings

import org.mytonwallet.app_air.uisettings.R
import org.mytonwallet.app_air.uisettings.viewControllers.settings.models.SettingsItem
import org.mytonwallet.app_air.uisettings.viewControllers.settings.models.SettingsSection
import org.mytonwallet.app_air.walletcontext.helpers.LocaleController
import org.mytonwallet.app_air.walletcontext.utils.toString
import org.mytonwallet.app_air.walletcore.WalletCore
import org.mytonwallet.app_air.walletcore.stores.AccountStore
import org.mytonwallet.app_air.walletcore.stores.BalanceStore
import org.mytonwallet.app_air.walletcore.stores.DappsStore

class SettingsVM {

    val settingsSections = listOf(
        SettingsSection(
            section = SettingsSection.Section.ACCOUNTS,
            children = emptyList()
        ),
        SettingsSection(
            section = SettingsSection.Section.WALLET_CONFIG,
            children = emptyList()
        ),
        SettingsSection(
            section = SettingsSection.Section.WALLET_DATA,
            children = emptyList()
        ),
        SettingsSection(
            section = SettingsSection.Section.NOT_IDENTIFIED,
            children = listOf(
                SettingsItem(
                    identifier = SettingsItem.Identifier.QUESTION_AND_ANSWERS,
                    icon = R.drawable.ic_qa,
                    title = LocaleController.getString(org.mytonwallet.app_air.walletcontext.R.string.Settings_QuestionAndAnswers),
                    hasTintColor = false
                ),
                SettingsItem(
                    identifier = SettingsItem.Identifier.TERMS,
                    icon = R.drawable.ic_terms,
                    title = LocaleController.getString(org.mytonwallet.app_air.walletcontext.R.string.Settings_Terms),
                    hasTintColor = false
                )
            )
        ),
        /*SettingsSection(
            section = SettingsSection.Section.NOT_IDENTIFIED,
            children = listOf(
                SettingsItem(
                    identifier = SettingsItem.Identifier.SWITCH_TO_LEGACY,
                    title = LocaleController.getString(org.mytonwallet.app_air.walletcontext.R.string.Settings_SwitchToLegacy),
                    hasTintColor = false
                )
            )
        )*/
    )

    fun valueFor(item: SettingsItem): String? {
        // Check if there's a cached value and return it if available
        item.value?.let {
            return it
        }

        // Determine the value based on the item's identifier
        return when (item.identifier) {
            SettingsItem.Identifier.LANGUAGE -> LocaleController.getString(org.mytonwallet.app_air.walletcontext.R.string.Language_Active)
            SettingsItem.Identifier.WALLET_VERSIONS -> AccountStore.walletVersionsData?.currentVersion
            else -> null
        }
    }

    fun fillOtherAccounts() {
        val accountsSectionIndex =
            settingsSections.indexOfFirst { it.section == SettingsSection.Section.ACCOUNTS }
        if (accountsSectionIndex == -1) return

        val items = mutableListOf<SettingsItem>()
        val accounts = WalletCore.getAllAccounts()
        for (account in accounts) {
            if (account.accountId == AccountStore.activeAccountId) continue

            val balanceAmount = BalanceStore.totalBalanceInBaseCurrency(account.accountId)
            val balance = balanceAmount?.toString(
                WalletCore.baseCurrency?.decimalsCount ?: 2,
                WalletCore.baseCurrency?.sign ?: "",
                WalletCore.baseCurrency?.decimalsCount ?: 2,
                true
            )

            items.add(
                SettingsItem(
                    identifier = SettingsItem.Identifier.ACCOUNT,
                    icon = null,
                    title = account.name,
                    value = balance,
                    hasTintColor = false,
                    account = account
                )
            )
        }

        items.add(
            SettingsItem(
                identifier = SettingsItem.Identifier.ADD_ACCOUNT,
                icon = R.drawable.ic_add,
                title = LocaleController.getString(org.mytonwallet.app_air.walletcontext.R.string.Settings_AddAccount),
                hasTintColor = false
            )
        )

        settingsSections[accountsSectionIndex].children = items
    }

    fun updateWalletConfigSection() {
        val walletConfigSectionIndex =
            settingsSections.indexOfFirst { it.section == SettingsSection.Section.WALLET_CONFIG }
        if (walletConfigSectionIndex == -1) return

        val items = mutableListOf(
            SettingsItem(
                identifier = SettingsItem.Identifier.APPEARANCE,
                icon = R.drawable.ic_appearance,
                title = LocaleController.getString(org.mytonwallet.app_air.walletcontext.R.string.Settings_Appearance),
                hasTintColor = false
            ),
            SettingsItem(
                identifier = SettingsItem.Identifier.ASSETS_AND_ACTIVITY,
                icon = R.drawable.ic_assets_activities,
                title = LocaleController.getString(org.mytonwallet.app_air.walletcontext.R.string.Settings_AssetsAndActivity),
                hasTintColor = false
            ),
            /*SettingsItem(
                identifier = SettingsItem.Identifier.LANGUAGE,
                icon = R.drawable.ic_language,
                title = LocaleController.getString(WStrings.SettingsLanguage),
                hasTintColor = false
            )*/
        )

        if (DappsStore.dApps[AccountStore.activeAccountId]?.isNotEmpty() == true) {
            items.add(
                2,
                SettingsItem(
                    identifier = SettingsItem.Identifier.CONNECTED_APPS,
                    icon = R.drawable.ic_apps,
                    title = LocaleController.getString(org.mytonwallet.app_air.walletcontext.R.string.Settings_ConnectedApps),
                    hasTintColor = false,
                    value = DappsStore.dApps[AccountStore.activeAccountId]!!.size.toString()
                )
            )
        }

        settingsSections[walletConfigSectionIndex].children = items
    }

    fun updateWalletDataSection() {
        val walletDataSectionIndex =
            settingsSections.indexOfFirst { it.section == SettingsSection.Section.WALLET_DATA }
        if (walletDataSectionIndex == -1) return

        val items = mutableListOf<SettingsItem>()

        if (AccountStore.activeAccount?.isPasscodeProtected == true)
            items.add(
                SettingsItem(
                    identifier = SettingsItem.Identifier.SECURITY,
                    icon = R.drawable.ic_backup,
                    title = LocaleController.getString(org.mytonwallet.app_air.walletcontext.R.string.Settings_Security),
                    hasTintColor = false
                )
            )

        if (AccountStore.walletVersionsData?.versions?.isNotEmpty() == true) {
            items.add(
                SettingsItem(
                    identifier = SettingsItem.Identifier.WALLET_VERSIONS,
                    icon = R.drawable.ic_versions,
                    title = LocaleController.getString(org.mytonwallet.app_air.walletcontext.R.string.Settings_WalletVersions),
                    hasTintColor = false
                )
            )
        }

        settingsSections[walletDataSectionIndex].children = items
    }
}
