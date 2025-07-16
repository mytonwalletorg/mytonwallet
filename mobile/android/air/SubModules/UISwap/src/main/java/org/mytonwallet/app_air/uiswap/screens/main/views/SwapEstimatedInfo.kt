package org.mytonwallet.app_air.uiswap.screens.main.views

import android.annotation.SuppressLint
import android.content.Context
import android.widget.LinearLayout
import org.mytonwallet.app_air.uicomponents.commonViews.AnimatedKeyValueRowView
import org.mytonwallet.app_air.uicomponents.widgets.ExpandableFrameLayout
import org.mytonwallet.app_air.uiswap.screens.main.SwapViewModel
import org.mytonwallet.app_air.walletcontext.R
import org.mytonwallet.app_air.walletcontext.helpers.LocaleController

@SuppressLint("ViewConstructor")
class SwapEstimatedInfo(
    context: Context,
    private var onDexPopupPressed: (() -> Unit)?,
    private var onSlippageChange: ((Float) -> Unit)?
) : ExpandableFrameLayout(context) {
    private val linearLayout = LinearLayout(context).apply {
        layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT)
        orientation = LinearLayout.VERTICAL
    }

    private val estRate = SwapRateRowView(context) {
        onDexPopupPressed?.invoke()
    }

    private val slippageRowView = SwapSlippageRowView(context) {
        onSlippageChange?.invoke(it)
    }

    private val estBlockchainFee = AnimatedKeyValueRowView(context).apply {
        title = LocaleController.getString(R.string.Swap_Est_BlockchainFee)
    }

    private val estRoutingFee = AnimatedKeyValueRowView(context).apply {
        setTitleDrawable(org.mytonwallet.app_air.icons.R.drawable.ic_info_24, 0.5f)
        title = LocaleController.getString(R.string.Swap_Est_RoutingFee)
    }

    private val estPriceImpact = AnimatedKeyValueRowView(context).apply {
        setTitleDrawable(org.mytonwallet.app_air.icons.R.drawable.ic_info_24, 0.5f)
        title = LocaleController.getString(R.string.Swap_Est_PriceImpact)
    }

    private val estMinimumReceived = AnimatedKeyValueRowView(context).apply {
        setTitleDrawable(org.mytonwallet.app_air.icons.R.drawable.ic_info_24, 0.5f)
        title = LocaleController.getString(R.string.Swap_Est_MinReceived)
        separator.allowSeparator = false
    }

    var onDialogShowListener: ((String, String) -> Unit)? = null

    init {
        linearLayout.addView(estRate)
        linearLayout.addView(slippageRowView)
        linearLayout.addView(estBlockchainFee)
        linearLayout.addView(estRoutingFee)
        linearLayout.addView(estPriceImpact)
        linearLayout.addView(estMinimumReceived)

        estRoutingFee.setOnClickListener {
            onDialogShowListener?.invoke(
                LocaleController.getString(R.string.Swap_Est_RoutingFee),
                LocaleController.getString(R.string.Swap_Est_RoutingFee_Info, listOf("0.857"))
            )
        }
        slippageRowView.setOnClickListener {
            onDialogShowListener?.invoke(
                LocaleController.getString(R.string.Swap_Est_Slippage),
                LocaleController.getString(R.string.Swap_Est_Slippage_Info)
            )
        }
        estPriceImpact.setOnClickListener {
            onDialogShowListener?.invoke(
                LocaleController.getString(R.string.Swap_Est_PriceImpact),
                LocaleController.getString(R.string.Swap_Est_PriceImpact_Info)
            )
        }
        estMinimumReceived.setOnClickListener {
            onDialogShowListener?.invoke(
                LocaleController.getString(R.string.Swap_Est_MinReceived),
                LocaleController.getString(R.string.Swap_Est_MinReceived_Info)
            )
        }

        addView(linearLayout)
    }

    fun setIsCex(isCex: Boolean) {
        val visibility = if (isCex) GONE else VISIBLE
        estPriceImpact.visibility = visibility
        estMinimumReceived.visibility = visibility
        estRoutingFee.visibility = visibility
        slippageRowView.visibility = visibility
        estBlockchainFee.separator.allowSeparator = !isCex
    }

    fun setEstimated(est: SwapViewModel.EstimateSwapResponse?) {
        estBlockchainFee.value = est?.transactionFeeFmt2
        estPriceImpact.value = est?.priceImpactFmt
        estMinimumReceived.value = est?.minReceivedFmt
        estRoutingFee.value =
            est?.let { LocaleController.getString(R.string.Swap_Est_RoutingFee_Included) }

        est?.let {
            estRate.setTitleAndValue(
                LocaleController.getString(R.string.Swap_Est_PricePer, listOf(it.rateReceiveFmt)),
                it.rateSendFmt,
                est.dex?.dexLabel?.displayName,
                est.dex?.dexLabel == (est.dex?.bestDexLabel ?: est.dex?.dexLabel),
                (est.dex?.all?.size ?: 0) > 1
            )
        } ?: run {
            estRate.clearValue()
        }
    }
}
