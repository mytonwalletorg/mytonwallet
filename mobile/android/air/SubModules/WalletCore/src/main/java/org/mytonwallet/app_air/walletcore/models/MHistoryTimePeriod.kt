package org.mytonwallet.app_air.walletcore.models

import org.mytonwallet.app_air.walletcontext.R
import org.mytonwallet.app_air.walletcontext.helpers.LocaleController

enum class MHistoryTimePeriod(val value: String) {
    DAY("1D"),
    WEEK("7D"),
    MONTH("1M"),
    THREE_MONTHS("3M"),
    YEAR("1Y"),
    ALL("ALL");

    val localized: String
        get() = when (this) {
            DAY -> LocaleController.getString(R.string.Token_Day)
            WEEK -> LocaleController.getString(R.string.Token_Week)
            MONTH -> LocaleController.getString(R.string.Token_Month)
            THREE_MONTHS -> LocaleController.getString(R.string.Token_3Months)
            YEAR -> LocaleController.getString(R.string.Token_Year)
            ALL -> LocaleController.getString(R.string.Token_All)
        }

    companion object {
        val allPeriods = arrayOf(
            ALL,
            YEAR,
            THREE_MONTHS,
            MONTH,
            WEEK,
            DAY
        )
    }
}
