package org.mytonwallet.app_air.uitonconnect.adapter

import org.mytonwallet.app_air.uicomponents.adapter.BaseListItem
import org.mytonwallet.app_air.walletcore.moshi.ApiDapp

sealed class TonConnectItem(
    type: Type,
    key: String? = null
) : BaseListItem(type.value, key) {
    enum class Type {
        AMOUNT,
        SEND_HEADER;

        val value: Int
            get() = this.ordinal
    }

    data class CurrencyAmount(
        val text: CharSequence
    ) : TonConnectItem(Type.AMOUNT, text.toString())

    data class SendRequestHeader(
        val app: ApiDapp
    ) : TonConnectItem(Type.SEND_HEADER, app.url)
}
