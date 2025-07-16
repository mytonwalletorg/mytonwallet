package org.mytonwallet.app_air.walletcontext.utils

import java.math.BigDecimal

fun BigDecimal.smartDecimalsCount(): Int {
    val amount = this.abs()
    if (amount == BigDecimal.ZERO)
        return 0
    var newAmount = amount
    var multiplier = 0
    while (newAmount < BigDecimal(10).multiply(BigDecimal(2))
    ) {
        newAmount *= BigDecimal(10)
        multiplier += 1
    }
    return multiplier
}
