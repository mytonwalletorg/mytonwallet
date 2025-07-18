package org.mytonwallet.app_air.walletcore.api

import android.os.Handler
import android.os.Looper
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import org.mytonwallet.app_air.walletcontext.utils.toJSONString
import org.mytonwallet.app_air.walletcore.TONCOIN_SLUG
import org.mytonwallet.app_air.walletcore.WalletCore
import org.mytonwallet.app_air.walletcore.models.MBridgeError
import org.mytonwallet.app_air.walletcore.models.MHistoryTimePeriod
import org.mytonwallet.app_air.walletcore.moshi.ApiNft
import org.mytonwallet.app_air.walletcore.moshi.MApiTransaction
import org.mytonwallet.app_air.walletcore.stores.NftStore
import java.util.concurrent.Executors

fun WalletCore.fetchAllActivitySlice(
    accountId: String,
    limit: Int,
    toTimestamp: Long?,
    tronTokenSlugs: Array<String>,
    callback: (ArrayList<MApiTransaction>?, MBridgeError?) -> Unit
) {
    Log.d(
        "fetchAllActivitySlice",
        "Account: $accountId - limit: $limit - toTimestamp: $toTimestamp"
    )
    bridge?.callApi(
        "fetchAllActivitySlice",
        "[${JSONObject.quote(accountId)}, $limit, ${toTimestamp ?: System.currentTimeMillis()}, ${tronTokenSlugs.toJSONString}]"
    ) { result, error ->
        if (error != null || result == null) {
            callback(null, error)
        } else {
            val executor = Executors.newSingleThreadExecutor()
            executor.run {
                try {
                    val transactions = ArrayList<MApiTransaction>()
                    val transactionJSONArray = JSONArray(result)
                    for (index in 0..<transactionJSONArray.length()) {
                        val transactionObj = transactionJSONArray.getJSONObject(index)
                        val transaction = MApiTransaction.fromJson(transactionObj)!!
                        transactions.add(transaction)
                    }
                    Handler(Looper.getMainLooper()).post {
                        callback(transactions, null)
                    }
                } catch (_: Error) {
                    Handler(Looper.getMainLooper()).post {
                        callback(null, null)
                    }
                }
            }
        }
    }
}

fun WalletCore.fetchTokenActivitySlice(
    accountId: String,
    chain: String,
    slug: String,
    fromTimestamp: Long?,
    limit: Int,
    callback: (ArrayList<MApiTransaction>?, MBridgeError?, String) -> Unit
) {
    Log.d("fetchTokenActivitySlice", "Account: $accountId - Chain: $chain - Slug: $slug")
    bridge?.callApi(
        "fetchActivitySlice",
        "[${JSONObject.quote(accountId)}, ${JSONObject.quote(chain)}, ${
            if (slug == TONCOIN_SLUG)
                null
            else
                JSONObject.quote(slug)
        }, ${fromTimestamp ?: System.currentTimeMillis()}, $limit]"
    ) { result, error ->
        if (error != null || result == null) {
            callback(null, error, accountId)
        } else {
            val executor = Executors.newSingleThreadExecutor()
            executor.run {
                try {
                    val transactions = ArrayList<MApiTransaction>()
                    val transactionJSONArray = JSONArray(result)
                    for (index in 0..<transactionJSONArray.length()) {
                        val transactionObj = transactionJSONArray.getJSONObject(index)
                        val transaction = MApiTransaction.fromJson(transactionObj)!!
                        transactions.add(transaction)
                    }
                    Handler(Looper.getMainLooper()).post {
                        callback(transactions, null, accountId)
                    }
                } catch (_: Error) {
                    Handler(Looper.getMainLooper()).post {
                        callback(null, null, accountId)
                    }
                }
            }
        }
    }
}

fun WalletCore.fetchNfts(
    accountId: String,
    callback: (ArrayList<ApiNft>?, MBridgeError?) -> Unit
) {
    bridge?.callApi(
        "fetchNfts",
        "[\"$accountId\"]"
    ) { result, error ->
        if (error != null || result == null) {
            callback(null, error)
        } else {
            val executor = Executors.newSingleThreadExecutor()
            executor.execute {
                try {
                    val nfts = ArrayList<ApiNft>()
                    val nftJSONArray = JSONArray(result)
                    for (index in 0..<nftJSONArray.length()) {
                        val nftObject = nftJSONArray.getJSONObject(index)
                        val nft = ApiNft.fromJson(nftObject)!!
                        nfts.add(nft)
                    }
                    Handler(Looper.getMainLooper()).post {
                        NftStore.setNfts(nfts, notifyObservers = true, isReorder = false)
                        callback(nfts, null)
                    }
                } catch (_: Error) {
                    Handler(Looper.getMainLooper()).post {
                        callback(null, null)
                    }
                }
            }
        }
    }
}

fun WalletCore.tryUpdatePrices() {
    bridge?.callApi(
        "tryUpdateTokens",
        "[]"
    ) { _, _ ->
    }
    bridge?.callApi(
        "tryUpdateSwapTokens",
        "[]"
    ) { _, _ ->
    }
}

fun WalletCore.fetchPriceHistory(
    slug: String,
    period: MHistoryTimePeriod,
    baseCurrency: String,
    callback: (Array<Array<Double>>?, MBridgeError?) -> Unit
) {
    bridge?.callApi(
        "fetchPriceHistory",
        "[\"$slug\", \"${period.value}\", \"$baseCurrency\"]"
    ) { result, error ->
        if (error != null || result == null) {
            callback(null, error)
        } else {
            val executor = Executors.newSingleThreadExecutor()
            executor.execute {
                try {
                    val arrayOfArray = JSONArray(result)
                    val parsedList = Array(arrayOfArray.length()) { i ->
                        Array(arrayOfArray.getJSONArray(i).length()) { j ->
                            arrayOfArray.getJSONArray(i).getDouble(j)
                        }
                    }

                    Handler(Looper.getMainLooper()).post {
                        callback(parsedList, null)
                    }
                } catch (_: Error) {
                    Handler(Looper.getMainLooper()).post {
                        callback(null, null)
                    }
                }
            }
        }
    }
}
