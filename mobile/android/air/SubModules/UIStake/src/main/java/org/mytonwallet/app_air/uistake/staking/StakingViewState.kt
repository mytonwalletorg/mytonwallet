package org.mytonwallet.app_air.uistake.staking

import org.mytonwallet.app_air.walletcontext.R
import org.mytonwallet.app_air.walletcontext.helpers.LocaleController

data class StakeViewState(
    val buttonState: StakeButtonState,
    val isInputTextRed: Boolean,
    val estimatedEarning: String,
    val currentApy: String,
    val currentFee: String,
    val maxAmountString: String
) {
    fun emptyInput(): StakeViewState = copy(
        buttonState = StakeButtonState.EmptyAmount,
        isInputTextRed = false,
        estimatedEarning = ""
    )

    companion object {
        fun initialState() = StakeViewState(
            buttonState = StakeButtonState.EmptyAmount,
            isInputTextRed = false,
            estimatedEarning = "",
            currentApy = "",
            currentFee = "",
            maxAmountString = "",
        )
    }
}


sealed class StakeButtonState {

    abstract val isEnabled: Boolean

    object LowerThanMinAmount : StakeButtonState() {

        fun getText(minAmount: String, symbol: String) = LocaleController.getString(
            R.string.Stake_MinimumAmount, listOf("$minAmount $symbol")
        )

        override val isEnabled = false
    }

    object InsufficientBalance : StakeButtonState() {
        fun getText(symbol: String): String = LocaleController.getString(
            R.string.Stake_InsufficientBalance, listOf(symbol)
        )

        override val isEnabled = false
    }

    object InsufficientFeeAmount : StakeButtonState() {
        fun getText(text: String): String = LocaleController.getString(
            R.string.Stake_InsufficientFeeAmount, listOf(text)
        )

        override val isEnabled = false
    }

    object EmptyAmount : StakeButtonState() {
        fun getText(symbol: String, mode: StakingViewModel.Mode): String =
            if (mode == StakingViewModel.Mode.STAKE)
                LocaleController.getString(
                    R.string.Stake_Do_Stake, listOf(symbol)
                )
            else LocaleController.getString(
                R.string.Stake_Do_Unstake, listOf(symbol)
            )

        override val isEnabled = false
    }

    object ValidAmount : StakeButtonState() {
        fun getText(symbol: String, mode: StakingViewModel.Mode): String =
            if (mode == StakingViewModel.Mode.STAKE)
                LocaleController.getString(
                    R.string.Stake_Do_Stake, listOf(symbol)
                )
            else LocaleController.getString(
                R.string.Stake_Do_Unstake, listOf(symbol)
            )

        override val isEnabled = true
    }

}
