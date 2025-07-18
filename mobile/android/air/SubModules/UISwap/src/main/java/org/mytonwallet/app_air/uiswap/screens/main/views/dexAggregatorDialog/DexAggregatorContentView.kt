package org.mytonwallet.app_air.uiswap.screens.main.views.dexAggregatorDialog

import android.annotation.SuppressLint
import android.content.Context
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.LinearLayout
import org.mytonwallet.app_air.uicomponents.drawable.HighlightGradientBackgroundDrawable
import org.mytonwallet.app_air.uicomponents.extensions.dp
import org.mytonwallet.app_air.uicomponents.helpers.Rate
import org.mytonwallet.app_air.uicomponents.widgets.WButton
import org.mytonwallet.app_air.uicomponents.widgets.WLabel
import org.mytonwallet.app_air.uicomponents.widgets.WThemedView
import org.mytonwallet.app_air.uicomponents.widgets.WView
import org.mytonwallet.app_air.uicomponents.widgets.setBackgroundColor
import org.mytonwallet.app_air.walletcontext.R
import org.mytonwallet.app_air.walletcontext.helpers.LocaleController
import org.mytonwallet.app_air.walletcontext.theme.WColor
import org.mytonwallet.app_air.walletcontext.theme.color
import org.mytonwallet.app_air.walletcontext.utils.CoinUtils
import org.mytonwallet.app_air.walletcontext.utils.smartDecimalsCount
import org.mytonwallet.app_air.walletcore.moshi.IApiToken
import org.mytonwallet.app_air.walletcore.moshi.MApiSwapDexLabel
import org.mytonwallet.app_air.walletcore.moshi.MApiSwapEstimateVariant

@SuppressLint("ViewConstructor")
class DexAggregatorContentView(
    context: Context,
    private val fromToken: IApiToken,
    private val toToken: IApiToken,
    private val variants: List<MApiSwapEstimateVariant>,
    private val bestDex: MApiSwapDexLabel,
    private var selectedDex: MApiSwapDexLabel,
    private val onSelect: (MApiSwapDexLabel) -> Unit
) : WView(context), WThemedView {

    private fun dexAggregatorView(label: MApiSwapDexLabel): DexAggregatorDexView {
        return DexAggregatorDexView(context, label).apply {
            isBest = bestDex == label
            isSelectedDex = selectedDex == label
            variants.find { it.dexLabel == label }?.let {
                val rate = Rate.build(
                    sendAmount = it.toAmount,
                    receiveAmount = it.fromAmount
                )
                fillValues(
                    "${
                        CoinUtils.toDecimalString(
                            it.toAmount,
                            decimals = 2.coerceAtLeast(it.toAmount.smartDecimalsCount()),
                            round = false
                        )
                    } ${toToken.symbol}",
                    rate.fmtReceive(
                        toToken.symbol,
                        decimals = null,
                        round = false
                    ) + " ≈ " + rate.fmtSend(
                        fromToken.symbol,
                        decimals = 5,
                        round = false
                    )
                )
            }
        }
    }

    private val dedustView = dexAggregatorView(MApiSwapDexLabel.DEDUST)
    private val stonfiView = dexAggregatorView(MApiSwapDexLabel.STON)

    private val dexView = LinearLayout(context).apply {
        id = generateViewId()
        orientation = LinearLayout.HORIZONTAL
        clipChildren = false
        clipToPadding = false
        setPadding(0, 4.dp, 0, 0)
        addView(dedustView, LinearLayout.LayoutParams(0, WRAP_CONTENT).apply {
            weight = 1f
        })
        addView(
            stonfiView,
            LinearLayout.LayoutParams(0, WRAP_CONTENT).apply {
                weight = 1f
                leftMargin = 12.dp
            }
        )
        dedustView.setOnClickListener {
            selectedDex = MApiSwapDexLabel.DEDUST
            dedustView.isSelectedDex = true
            stonfiView.isSelectedDex = false
            updateOkButton()
        }
        stonfiView.setOnClickListener {
            selectedDex = MApiSwapDexLabel.STON
            stonfiView.isSelectedDex = true
            dedustView.isSelectedDex = false
            updateOkButton()
        }
    }

    private val detailsLabel = WLabel(context).apply {
        text = LocaleController.getString(R.string.FeeDetails_OK)
    }

    private val okButton = WButton(context).apply {
        text = LocaleController.getString(R.string.FeeDetails_OK)
        setOnClickListener {
            onSelect(selectedDex)
        }
    }

    @SuppressLint("SetTextI18n")
    override fun setupViews() {
        super.setupViews()

        clipChildren = false
        clipToPadding = false
        setPadding(24.dp, 0, 24.dp, 0)
        addView(dexView, LayoutParams(MATCH_PARENT, WRAP_CONTENT))
        addView(detailsLabel, LayoutParams(0, WRAP_CONTENT))
        addView(okButton, LayoutParams(0, WRAP_CONTENT))

        setConstraints {
            toTop(dexView, 4f)
            toCenterX(dexView)
            topToBottom(detailsLabel, dexView, 24f)
            toCenterX(detailsLabel)
            topToBottom(okButton, detailsLabel, 32f)
            toBottom(okButton)
            toCenterX(okButton)
        }

        okButton.setOnClickListener {
            onSelect(selectedDex)
        }

        fillDetailsLabel()
        updateOkButton()

        updateTheme()
    }

    override fun updateTheme() {
        detailsLabel.setTextColor(WColor.SecondaryText.color)
    }

    private fun fillDetailsLabel() {
        val diff =
            variants.find { it.dexLabel == bestDex }!!.toAmount - variants.find { it.dexLabel != bestDex }!!.toAmount
        val diffString =
            "${
                CoinUtils.toDecimalString(
                    diff,
                    2.coerceAtLeast(diff.smartDecimalsCount()),
                    false
                )
            } ${toToken.symbol}"

        detailsLabel.text = LocaleController.getStringBold(
            R.string.DexAggregator_Details,
            listOf(
                MApiSwapDexLabel.DEDUST.displayName,
                MApiSwapDexLabel.STON.displayName,
                LocaleController.getString(R.string.DexAggregator_BestRate).lowercase(),
                diffString
            )
        )
    }

    private fun updateOkButton() {
        if (selectedDex == bestDex) {
            detailsLabel.alpha = 1f
            okButton.background = HighlightGradientBackgroundDrawable(true, 25f.dp)
            okButton.text = LocaleController.getString(R.string.DexAggregator_UseBestRate)
        } else {
            detailsLabel.alpha = 0.5f
            okButton.setBackgroundColor(WColor.Tint.color, 25f.dp)
            okButton.text = LocaleController.getString(
                R.string.DexAggregator_SwitchTo,
                listOf(selectedDex.displayName)
            )
        }
    }
}
