package org.mytonwallet.app_air.walletcore.models

import java.math.BigInteger

data class ExplainedTransferFee(
    /** Whether the result implies paying the fee with a diesel */
    val isGasless: Boolean,
    /**
     * The fee that will be sent with the transfer. The wallet must have it on the balance to send the transfer.
     * Show this in the transfer form when the input amount is ≤ the balance, but the remaining balance can't cover the
     * full fee; show `realFee` otherwise. Undefined means that it's unknown.
     */
    val fullFee: MFee?,
    /**
     * The real fee (the full fee minus the excess). Undefined means that it's unknown. There is no need to fall back to
     * `fullFee` when `realFee` is undefined (because it's undefined too in this case).
     */
    val realFee: MFee?,
    /**
     * Whether the full token balance can be transferred despite the fee.
     * If yes, the fee will be taken from the transferred amount.
     */
    val canTransferFullBalance: Boolean,
    /** The excess fee. Measured in the native token. It's always approximate. Undefined means that it's unknown. */
    var excessFee: BigInteger
)
