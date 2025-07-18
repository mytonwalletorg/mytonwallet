package org.mytonwallet.app_air.walletcore.stores

import android.os.Handler
import android.os.Looper
import org.json.JSONArray
import org.json.JSONObject
import org.mytonwallet.app_air.walletcontext.WalletContextManager
import org.mytonwallet.app_air.walletcontext.cacheStorage.WCacheStorage
import org.mytonwallet.app_air.walletcontext.globalStorage.WGlobalStorage
import org.mytonwallet.app_air.walletcore.WalletCore
import org.mytonwallet.app_air.walletcore.constants.TelegramGiftAddresses
import org.mytonwallet.app_air.walletcore.models.NftCollection
import org.mytonwallet.app_air.walletcore.moshi.ApiNft
import org.mytonwallet.app_air.walletcore.moshi.api.ApiMethod
import java.util.concurrent.Executors

object NftStore {
    private var cacheExecutor = Executors.newSingleThreadExecutor()
    var cachedNfts: MutableList<ApiNft>? = null
        private set
    var whitelistedNftAddresses = ArrayList<String>()
        private set
    var blacklistedNftAddresses = ArrayList<String>()
        private set

    fun loadCachedNfts(accountId: String) {
        clean()
        Executors.newSingleThreadExecutor().execute {
            val nftsString = WCacheStorage.getNfts(accountId)
            if (nftsString != null) {
                val nftsJSONArray = JSONArray(nftsString)
                val nftsArray = ArrayList<ApiNft>()
                for (i in 0 until nftsJSONArray.length()) {
                    val nftJson = nftsJSONArray.get(i) as JSONObject
                    ApiNft.fromJson(nftJson)?.let { nft ->
                        nftsArray.add(nft)
                    }
                }

                Handler(Looper.getMainLooper()).post {
                    if (AccountStore.activeAccountId != accountId)
                        return@post
                    setNfts(nftsArray, notifyObservers = true, isReorder = false)
                }
            }
        }
    }

    fun resetWhitelistAndBlacklist() {
        whitelistedNftAddresses =
            WGlobalStorage.getWhitelistedNftAddresses(AccountStore.activeAccountId!!)
        blacklistedNftAddresses =
            WGlobalStorage.getBlacklistedNftAddresses(AccountStore.activeAccountId!!)
    }

    fun showNft(nft: ApiNft) {
        if (nft.isHidden == true) {
            if (!whitelistedNftAddresses.contains(nft.address)) {
                whitelistedNftAddresses.add(nft.address)
                WGlobalStorage.setWhitelistedNftAddresses(
                    AccountStore.activeAccountId!!,
                    whitelistedNftAddresses
                )
            }
        } // else: it's shown by default
        // To make sure it's not in blacklist (maybe nft was not hidden before and added to blacklist manually)
        blacklistedNftAddresses.remove(nft.address)
        WGlobalStorage.setBlacklistedNftAddresses(
            AccountStore.activeAccountId!!,
            blacklistedNftAddresses
        )
        WalletCore.notifyEvent(WalletCore.Event.NftsUpdated)
    }

    fun hideNft(nft: ApiNft) {
        if (nft.isHidden != true) {
            if (!blacklistedNftAddresses.contains(nft.address)) {
                blacklistedNftAddresses.add(nft.address)
                WGlobalStorage.setBlacklistedNftAddresses(
                    AccountStore.activeAccountId!!,
                    blacklistedNftAddresses
                )
            }
        } // else: it's hidden by default
        // Make sure it's not in whitelist (maybe nft was hidden before and added to whitelist, so do it in all conditions)
        whitelistedNftAddresses.remove(nft.address)
        WGlobalStorage.setWhitelistedNftAddresses(
            AccountStore.activeAccountId!!,
            whitelistedNftAddresses
        )
        WalletCore.notifyEvent(WalletCore.Event.NftsUpdated)
    }

    fun setNfts(nfts: List<ApiNft>?, notifyObservers: Boolean, isReorder: Boolean) {
        if (!isReorder &&
            cachedNfts != null &&
            nfts != null &&
            cachedNfts!!.size == nfts.size &&
            cachedNfts!!.all { cached -> nfts.any { new -> cached.isSame(new) } }
        ) {
            return
        }

        cachedNfts = when {
            isReorder || nfts.isNullOrEmpty() || cachedNfts.isNullOrEmpty() -> nfts
            else -> {
                val nftMap = nfts.associateBy { it.address }
                val cachedAddresses =
                    cachedNfts?.mapTo(mutableSetOf()) { it.address } ?: emptyList()

                val newNfts = nfts.filterNot { it.address in cachedAddresses }

                val updatedCachedNfts = cachedNfts?.mapNotNull { cached ->
                    nftMap[cached.address]
                }

                newNfts + (updatedCachedNfts ?: emptyList())
            }
        }?.toMutableList()
        writeToCache()

        if (notifyObservers)
            WalletCore.notifyEvent(if (isReorder) WalletCore.Event.NftsReordered else WalletCore.Event.NftsUpdated)
        if (!WGlobalStorage.getWasTelegramGiftsAutoAdded(AccountStore.activeAccountId ?: "") &&
            cachedNfts?.any {
                TelegramGiftAddresses.all.contains(it.collectionAddress)
            } == true
        ) {
            val homeNftCollections =
                WGlobalStorage.getHomeNftCollections(AccountStore.activeAccountId!!)
            if (!homeNftCollections.contains(NftCollection.TELEGRAM_GIFTS_SUPER_COLLECTION)) {
                homeNftCollections.add(NftCollection.TELEGRAM_GIFTS_SUPER_COLLECTION)
                WGlobalStorage.setWasTelegramGiftsAutoAdded(
                    AccountStore.activeAccountId ?: "",
                    true
                )
                WGlobalStorage.setHomeNftCollections(
                    AccountStore.activeAccountId!!,
                    homeNftCollections
                )
                WalletCore.notifyEvent(WalletCore.Event.HomeNftCollectionsUpdated)
            }
        }
    }

    fun add(nft: ApiNft) {
        val index = cachedNfts?.indexOfFirst { it.address == nft.address }
        if ((index ?: -1) > -1) {
            cachedNfts?.set(index!!, nft)
        } else {
            if (cachedNfts == null)
                cachedNfts = mutableListOf(nft)
            else
                cachedNfts?.add(0, nft)
        }
        writeToCache()
        WalletCore.notifyEvent(WalletCore.Event.ReceivedNewNFT)
    }

    fun removeByAddress(nftAddress: String) {
        cachedNfts = cachedNfts?.filter { it.address != nftAddress }?.toMutableList()
        writeToCache()
        WalletCore.notifyEvent(WalletCore.Event.NftsUpdated)
    }

    fun clean() {
        cachedNfts = null
        cacheExecutor.shutdownNow()
        cacheExecutor = Executors.newSingleThreadExecutor()
    }

    private fun writeToCache() {
        val accountId = AccountStore.activeAccountId
        accountId?.let {
            cacheExecutor.execute {
                cachedNfts?.let {
                    val arr = JSONArray()
                    for (it in cachedNfts) {
                        arr.put(it.toDictionary())
                    }
                    WCacheStorage.setNfts(accountId, arr.toString())
                } ?: run {
                    WCacheStorage.setNfts(accountId, null)
                }
            }
        }
    }

    fun checkCardNftOwnership(accountId: String) {
        val installedCard = WGlobalStorage.getCardBackgroundNft(accountId)
        installedCard?.let {
            val installedNft = ApiNft.fromJson(installedCard)!!
            WalletCore.call(
                ApiMethod.Nft.CheckNftOwnership(
                    accountId,
                    installedNft.address
                )
            ) { res, err ->
                if (err != null)
                    return@call
                if (res == false) {
                    WGlobalStorage.setCardBackgroundNft(
                        accountId,
                        null
                    )
                    if (AccountStore.activeAccountId == accountId)
                        WalletCore.notifyEvent(WalletCore.Event.NftCardUpdated)
                }
            }
        }
        val installedPalette = WGlobalStorage.getAccentColorNft(accountId)
        installedPalette?.let {
            val installedPaletteNft = ApiNft.fromJson(installedPalette)!!
            WalletCore.call(
                ApiMethod.Nft.CheckNftOwnership(
                    accountId,
                    installedPaletteNft.address
                )
            ) { res, err ->
                if (err != null)
                    return@call
                if (res == false) {
                    WGlobalStorage.setNftAccentColor(
                        accountId,
                        null,
                        null
                    )
                    if (AccountStore.activeAccountId == accountId)
                        WalletContextManager.delegate?.themeChanged()
                }
            }
        }
    }

    fun getCollections(): List<NftCollection> {
        val uniqueCollections = linkedSetOf<NftCollection>()

        val nfts = cachedNfts ?: emptyList()
        for (nft in nfts) {
            if (!nft.shouldHide() && !nft.isStandalone()) {
                nft.collectionAddress?.let {
                    nft.collectionName?.let {
                        uniqueCollections.add(
                            NftCollection(nft.collectionAddress, nft.collectionName)
                        )
                    }
                }
            }
        }

        return uniqueCollections.toList().sortedWith(compareBy { it.name })
    }
}
