package org.mytonwallet.app_air.walletcore.models

import org.mytonwallet.app_air.walletcontext.R
import org.mytonwallet.app_air.walletcontext.helpers.LocaleController

enum class MBaseCurrency(val currencyCode: String) {
    USD("USD"),
    EUR("EUR"),
    RUB("RUB"),
    CNY("CNY"),
    BTC("BTC"),
    TON("TON");

    val sign: String
        get() = when (this) {
            USD -> "$"
            EUR -> "€"
            RUB -> "₽"
            CNY -> "¥"
            BTC -> "BTC"
            TON -> "TON"
        }

    val decimalsCount: Int
        get() = when (this) {
            BTC -> 6
            else -> 2
        }

    val currencySymbol: String
        get() = when (this) {
            USD -> LocaleController.getString(R.string.BaseCurrency_USD)
            EUR -> LocaleController.getString(R.string.BaseCurrency_EUR)
            RUB -> LocaleController.getString(R.string.BaseCurrency_RUB)
            CNY -> LocaleController.getString(R.string.BaseCurrency_CNY)
            BTC -> LocaleController.getString(R.string.BaseCurrency_BTC)
            TON -> LocaleController.getString(R.string.BaseCurrency_TON)
        }

    val currencyName: String
        get() = when (this) {
            USD -> LocaleController.getString(R.string.BaseCurrency_USDName)
            EUR -> LocaleController.getString(R.string.BaseCurrency_EURName)
            RUB -> LocaleController.getString(R.string.BaseCurrency_RUBName)
            CNY -> LocaleController.getString(R.string.BaseCurrency_CNYName)
            BTC -> LocaleController.getString(R.string.BaseCurrency_BTCName)
            TON -> LocaleController.getString(R.string.BaseCurrency_TONName)
        }

    companion object {
        fun parse(value: String) = try {
            MBaseCurrency.valueOf(value)
        } catch (t: Throwable) {
            USD
        }
    }
}
