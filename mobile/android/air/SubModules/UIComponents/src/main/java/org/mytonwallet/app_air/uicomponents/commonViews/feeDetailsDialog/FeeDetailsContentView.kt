package org.mytonwallet.app_air.uicomponents.commonViews.feeDetailsDialog

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.util.TypedValue
import android.view.Gravity
import android.view.ViewGroup
import android.widget.LinearLayout
import androidx.constraintlayout.widget.ConstraintLayout.LayoutParams.MATCH_PARENT
import androidx.constraintlayout.widget.ConstraintLayout.LayoutParams.WRAP_CONTENT
import androidx.core.widget.TextViewCompat
import org.mytonwallet.app_air.uicomponents.extensions.dp
import org.mytonwallet.app_air.uicomponents.helpers.WFont
import org.mytonwallet.app_air.uicomponents.widgets.WButton
import org.mytonwallet.app_air.uicomponents.widgets.WLabel
import org.mytonwallet.app_air.uicomponents.widgets.WThemedView
import org.mytonwallet.app_air.uicomponents.widgets.WView
import org.mytonwallet.app_air.uicomponents.widgets.setBackgroundColor
import org.mytonwallet.app_air.walletcontext.R
import org.mytonwallet.app_air.walletcontext.helpers.LocaleController
import org.mytonwallet.app_air.walletcontext.theme.WColor
import org.mytonwallet.app_air.walletcontext.theme.color
import org.mytonwallet.app_air.walletcontext.utils.smartDecimalsCount
import org.mytonwallet.app_air.walletcontext.utils.toString
import org.mytonwallet.app_air.walletcore.models.ExplainedTransferFee
import org.mytonwallet.app_air.walletcore.models.MFee
import org.mytonwallet.app_air.walletcore.moshi.IApiToken
import java.math.BigInteger

@SuppressLint("ViewConstructor")
class FeeDetailsContentView(
    context: Context,
    private val token: IApiToken,
    private val feeDetails: ExplainedTransferFee,
    private val onClosePressed: () -> Unit
) : WView(context), WThemedView {

    private val finalFeeLabel = WLabel(context).apply {
        setStyle(14f, WFont.Bold)
        text = LocaleController.getString(R.string.FeeDetails_FinalFee)
    }

    private val excessFeeLabel = WLabel(context).apply {
        setStyle(14f, WFont.Bold)
        text = LocaleController.getString(R.string.FeeDetails_Excess)
    }

    private val finalFeeValueLabel = WLabel(context).apply {
        setStyle(14f, WFont.SemiBold)
        maxLines = 1
        gravity = Gravity.CENTER_VERTICAL
        setPadding(10.dp, 0, 2.dp, 0)
        TextViewCompat.setAutoSizeTextTypeUniformWithConfiguration(
            this@apply,
            10,
            15,
            1,
            TypedValue.COMPLEX_UNIT_SP
        )
    }

    private val excessFeeValueLabel = WLabel(context).apply {
        setStyle(14f, WFont.SemiBold)
        maxLines = 2
        gravity = Gravity.CENTER_VERTICAL or Gravity.END
        setPadding(2.dp, 0, 10.dp, 0)
        TextViewCompat.setAutoSizeTextTypeUniformWithConfiguration(
            this@apply,
            10,
            15,
            1,
            TypedValue.COMPLEX_UNIT_SP
        )
    }

    private val feeValuesView = LinearLayout(context).apply {
        id = generateViewId()
        orientation = LinearLayout.HORIZONTAL
        addView(finalFeeValueLabel, LinearLayout.LayoutParams(0, MATCH_PARENT))
        addView(excessFeeValueLabel, LinearLayout.LayoutParams(0, MATCH_PARENT))
    }

    private val detailsLabel = WLabel(context).apply {
        setStyle(15f, WFont.Regular)
    }

    private val okButton = WButton(context).apply {
        text = LocaleController.getString(R.string.FeeDetails_OK)
    }

    @SuppressLint("SetTextI18n")
    override fun setupViews() {
        super.setupViews()

        addView(finalFeeLabel)
        addView(excessFeeLabel)
        addView(feeValuesView, ViewGroup.LayoutParams(MATCH_PARENT, 40.dp))
        addView(detailsLabel, LayoutParams(0, WRAP_CONTENT))
        addView(okButton, LayoutParams(0, WRAP_CONTENT))

        setConstraints {
            toTop(finalFeeLabel, 20f)
            toTop(excessFeeLabel, 20f)
            toLeft(finalFeeLabel, 26f)
            toRight(excessFeeLabel, 26f)
            topToBottom(feeValuesView, finalFeeLabel, 6f)
            toCenterX(feeValuesView, 24f)
            topToBottom(detailsLabel, feeValuesView, 32f)
            toCenterX(detailsLabel, 24f)
            topToBottom(okButton, detailsLabel, 32f)
            toBottom(okButton)
            toCenterX(okButton, 24f)
        }

        val finalFeeVal = feeDetails.realFee?.nativeSum ?: BigInteger.ZERO
        finalFeeValueLabel.text = feeDetails.realFee?.toString(token)
        finalFeeValueLabel.layoutParams =
            (finalFeeValueLabel.layoutParams as LinearLayout.LayoutParams).apply {
                weight =
                    (finalFeeVal * BigInteger.valueOf(1000) / (finalFeeVal + feeDetails.excessFee)).toFloat() / 1000f
            }
        val nativeToken = token.nativeToken!!
        excessFeeValueLabel.text = "~${
            feeDetails.excessFee.toString(
                nativeToken.decimals,
                nativeToken.symbol,
                feeDetails.excessFee.smartDecimalsCount(nativeToken.decimals),
                false
            )
        }"
        excessFeeValueLabel.layoutParams =
            (excessFeeValueLabel.layoutParams as LinearLayout.LayoutParams).apply {
                weight =
                    (feeDetails.excessFee * BigInteger.valueOf(1000) / (finalFeeVal + feeDetails.excessFee)).toFloat() / 1000f
                if (weight > 0)
                    leftMargin = 3.dp
            }

        fillDetailsLabel()

        okButton.setOnClickListener {
            onClosePressed()
        }

        updateTheme()
    }

    override fun updateTheme() {
        finalFeeLabel.setTextColor(WColor.Tint.color)
        excessFeeLabel.setTextColor(WColor.Green.color)
        finalFeeValueLabel.setTextColor(WColor.TextOnTint.color)
        finalFeeValueLabel.setBackgroundColor(WColor.Tint.color, 4f.dp)
        excessFeeValueLabel.setTextColor(Color.WHITE)
        excessFeeValueLabel.setBackgroundColor(WColor.Green.color, 4f.dp)
        feeValuesView.setBackgroundColor(Color.TRANSPARENT, 10f.dp, true)
        detailsLabel.setTextColor(WColor.SecondaryText.color)
    }

    private fun fillDetailsLabel() {
        val fee =
            feeDetails.fullFee?.apply { precision = MFee.FeePrecision.EXACT }?.toString(token) ?: ""
        val nativeToken = token.nativeToken
        val symbol = nativeToken?.symbol?.uppercase() ?: ""
        val chain = LocaleController.getString(
            R.string.FeeDetails_Chain,
            listOf(nativeToken?.chain?.uppercase() ?: "")
        )

        detailsLabel.text = LocaleController.getStringBold(
            R.string.FeeDetails_Desc,
            listOf(fee, symbol, chain)
        )
    }
}
