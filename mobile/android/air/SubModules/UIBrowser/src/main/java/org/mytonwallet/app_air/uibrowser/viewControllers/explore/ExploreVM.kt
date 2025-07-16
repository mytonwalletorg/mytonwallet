package org.mytonwallet.app_air.uibrowser.viewControllers.explore

import android.os.Handler
import android.os.Looper
import org.mytonwallet.app_air.walletcore.WalletCore
import org.mytonwallet.app_air.walletcore.api.loadExploreSites
import org.mytonwallet.app_air.walletcore.models.MExploreCategory
import org.mytonwallet.app_air.walletcore.models.MExploreSite
import org.mytonwallet.app_air.walletcore.moshi.ApiDapp
import org.mytonwallet.app_air.walletcore.stores.AccountStore
import org.mytonwallet.app_air.walletcore.stores.ConfigStore
import org.mytonwallet.app_air.walletcore.stores.DappsStore
import java.lang.ref.WeakReference

class ExploreVM(delegate: Delegate) : WalletCore.EventObserver {
    interface Delegate {
        fun updateEmptyView()
        fun sitesUpdated()
    }

    private val delegate: WeakReference<Delegate> = WeakReference(delegate)

    private var waitingForNetwork = false
    internal var connectedSites: Array<ApiDapp>? =
        DappsStore.dApps[AccountStore.activeAccountId]?.toTypedArray()
    private var allSites: Array<MExploreSite>? = null
    private var allExploreCategories: Array<MExploreCategory>? = null

    internal var showingExploreCategories: Array<MExploreCategory>? = null
    internal var showingTrendingSites = arrayOf<MExploreSite>()

    fun delegateIsReady() {
        WalletCore.registerObserver(this)
        if (!WalletCore.isConnected()) {
            waitingForNetwork = true
        }
        refresh()
    }

    private fun refresh() {
        WalletCore.loadExploreSites { categories, sites, error ->
            if (error != null) {
                if (!waitingForNetwork) {
                    Handler(Looper.getMainLooper()).postDelayed({
                        refresh()
                    }, 3000)
                }
            } else {
                updateSites(categories, sites)
            }
        }
    }

    private fun updateSites(categories: Array<MExploreCategory>?, sites: Array<MExploreSite>?) {
        this.allSites = sites
        allExploreCategories = categories
        filterAndShowSites()
    }

    private fun filterAndShowSites() {
        showingExploreCategories = allExploreCategories?.filter {
            it.sites.any { it.canBeShown }
        }?.toTypedArray()
        showingTrendingSites =
            allSites?.filter { it.isFeatured && it.canBeShown }?.toTypedArray() ?: emptyArray()
        delegate.get()?.updateEmptyView()
        delegate.get()?.sitesUpdated()
    }

    override fun onWalletEvent(event: WalletCore.Event) {
        when (event) {
            WalletCore.Event.NetworkConnected -> {
                refresh()
            }

            WalletCore.Event.NetworkDisconnected -> {
                waitingForNetwork = true
            }

            WalletCore.Event.DappsCountUpdated -> {
                connectedSites = DappsStore.dApps[AccountStore.activeAccountId]?.toTypedArray()
                delegate.get()?.updateEmptyView()
                delegate.get()?.sitesUpdated()
            }

            WalletCore.Event.ConfigReceived -> {
                delegate.get()?.updateEmptyView()
                delegate.get()?.sitesUpdated()
            }

            else -> {}
        }
    }

    fun filterSites(query: String): List<MExploreSite>? {
        val query = query.lowercase()
        return allSites?.filter {
            (ConfigStore.isLimited != true || !it.canBeRestricted) &&
                (
                    it.name?.lowercase()?.contains(query) != false ||
                        it.description?.lowercase()?.contains(query) != false ||
                        it.url?.lowercase()?.contains(query) != false
                    )
        }
    }

}
