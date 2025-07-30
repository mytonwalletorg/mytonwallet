package org.mytonwallet.app_air.uistake.helpers

import android.graphics.Typeface
import android.text.Spannable
import android.text.SpannableStringBuilder
import android.text.style.ForegroundColorSpan
import android.text.style.StyleSpan
import org.mytonwallet.app_air.uicomponents.helpers.spans.WClickableSpan
import org.mytonwallet.app_air.walletcontext.helpers.LocaleController
import org.mytonwallet.app_air.walletcontext.theme.WColor
import org.mytonwallet.app_air.walletcontext.theme.color
import org.mytonwallet.app_air.walletcore.MYCOIN_SLUG
import org.mytonwallet.app_air.walletcore.TONCOIN_SLUG
import org.mytonwallet.app_air.walletcore.USDE_SLUG
import org.mytonwallet.app_air.walletcore.WalletCore
import org.mytonwallet.app_air.walletcore.WalletEvent

class StakingMessageHelpers {
    companion object {
        fun whyStakingIsSafeDescription(tokenSlug: String): CharSequence? {
            val rawText = LocaleController.getString(
                when (tokenSlug) {
                    TONCOIN_SLUG -> org.mytonwallet.app_air.walletcontext.R.string.Stake_WhyStakingIsSafe_Desc
                    MYCOIN_SLUG -> org.mytonwallet.app_air.walletcontext.R.string.Stake_WhyStakingIsSafeJetton_Desc
                    USDE_SLUG -> org.mytonwallet.app_air.walletcontext.R.string.Stake_WhyStakingIsSafeEthena_Desc
                    else -> return null
                }
            )

            val spannable = SpannableStringBuilder()

            val parts = rawText.split("**")
            var isBold = false
            for (part in parts) {
                val start = spannable.length
                spannable.append(part)
                val end = spannable.length

                if (isBold) {
                    spannable.setSpan(
                        StyleSpan(Typeface.BOLD),
                        start,
                        end,
                        Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
                    )
                }
                isBold = !isBold
            }

            val jvaultRegex = Regex("JVault")
            val matches = jvaultRegex.findAll(spannable)
            for (match in matches) {
                val start = match.range.first
                val end = match.range.last + 1

                spannable.setSpan(
                    ForegroundColorSpan(WColor.Tint.color),
                    start,
                    end,
                    Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
                )
                val jVaultURL = "https://jvault.xyz"
                spannable.setSpan(
                    WClickableSpan(jVaultURL) {
                        WalletCore.notifyEvent(WalletEvent.OpenUrl(jVaultURL))
                    },
                    start,
                    end,
                    Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
                )
            }

            return spannable
        }
    }
}
