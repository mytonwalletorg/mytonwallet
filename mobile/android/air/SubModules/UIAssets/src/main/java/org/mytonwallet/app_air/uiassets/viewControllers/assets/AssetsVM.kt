package org.mytonwallet.app_air.uiassets.viewControllers.assets

import android.os.Handler
import android.os.Looper
import org.mytonwallet.app_air.walletcore.WalletCore
import org.mytonwallet.app_air.walletcore.api.fetchNfts
import org.mytonwallet.app_air.walletcore.constants.TelegramGiftAddresses
import org.mytonwallet.app_air.walletcore.moshi.ApiNft
import org.mytonwallet.app_air.walletcore.stores.AccountStore
import org.mytonwallet.app_air.walletcore.stores.NftStore
import java.lang.ref.WeakReference

class AssetsVM(val collectionMode: AssetsVC.CollectionMode?, delegate: Delegate) :
    WalletCore.EventObserver {
    interface Delegate {
        fun updateEmptyView()
        fun nftsUpdated()
    }

    private val delegate: WeakReference<Delegate> = WeakReference(delegate)

    private var waitingForNetwork = false
    internal var nfts: MutableList<ApiNft>? = null

    init {
        updateNftsArray()
    }

    fun delegateIsReady() {
        WalletCore.registerObserver(this)
        if (!WalletCore.isConnected()) {
            waitingForNetwork = true
        }
        refresh()
    }

    private fun refresh() {
        WalletCore.fetchNfts(AccountStore.activeAccountId ?: "") { nfts, error ->
            if (error != null) {
                if (!waitingForNetwork) {
                    Handler(Looper.getMainLooper()).postDelayed({
                        refresh()
                    }, 3000)
                }
            }
        }
    }

    private fun updateNfts() {
        val oldNftsAddresses = nfts?.map { it.address }
        updateNftsArray()
        val newNftsAddresses = nfts?.map { it.address }

        if (oldNftsAddresses != newNftsAddresses) {
            delegate.get()?.updateEmptyView()
            delegate.get()?.nftsUpdated()
        }
    }

    private fun updateNftsArray() {
        nfts = NftStore.cachedNfts?.filter {
            it.shouldHide() != true &&
                when (collectionMode) {
                    is AssetsVC.CollectionMode.SingleCollection -> {
                        it.collectionAddress == collectionMode.collection.address
                    }

                    is AssetsVC.CollectionMode.TelegramGifts -> {
                        TelegramGiftAddresses.all.contains(it.collectionAddress)
                    }

                    else -> {
                        true
                    }
                }
        }?.toMutableList()
    }

    override fun onWalletEvent(event: WalletCore.Event) {
        when (event) {
            WalletCore.Event.NftsUpdated, WalletCore.Event.ReceivedNewNFT, WalletCore.Event.NftsReordered -> {
                updateNfts()
            }

            is WalletCore.Event.AccountChanged -> {
                updateNfts()
                refresh()
            }

            WalletCore.Event.NetworkConnected -> {
                refresh()
            }

            WalletCore.Event.NetworkDisconnected -> {
                waitingForNetwork = true
            }

            else -> {}
        }
    }

    fun moveItem(fromPosition: Int, toPosition: Int) {
        nfts?.let { nftList ->
            if (fromPosition < nftList.size && toPosition < nftList.size) {
                val cachedNfts = NftStore.cachedNfts ?: return

                val mainFromPos =
                    cachedNfts.indexOfFirst { it.address == nftList[fromPosition].address }
                val mainToPos =
                    cachedNfts.indexOfFirst { it.address == nftList[toPosition].address }

                val item = nftList.removeAt(fromPosition)
                nftList.add(toPosition, item)

                val mainItem = cachedNfts.removeAt(mainFromPos)
                cachedNfts.add(mainToPos, mainItem)
                NftStore.setNfts(cachedNfts, notifyObservers = true, isReorder = true)
            }
        }
    }
}
