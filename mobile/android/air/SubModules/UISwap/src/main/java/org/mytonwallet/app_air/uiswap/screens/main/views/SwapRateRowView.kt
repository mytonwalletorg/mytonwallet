package org.mytonwallet.app_air.uiswap.screens.main.views

import android.annotation.SuppressLint
import android.content.Context
import android.view.Gravity
import android.view.ViewGroup
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.LinearLayout
import androidx.appcompat.widget.AppCompatImageView
import androidx.core.content.ContextCompat
import org.mytonwallet.app_air.uicomponents.drawable.HighlightGradientBackgroundDrawable
import org.mytonwallet.app_air.uicomponents.drawable.SeparatorBackgroundDrawable
import org.mytonwallet.app_air.uicomponents.drawable.WRippleDrawable
import org.mytonwallet.app_air.uicomponents.extensions.dp
import org.mytonwallet.app_air.uicomponents.helpers.WFont
import org.mytonwallet.app_air.uicomponents.widgets.WCounterLabel
import org.mytonwallet.app_air.uicomponents.widgets.WLabel
import org.mytonwallet.app_air.uicomponents.widgets.WThemedView
import org.mytonwallet.app_air.uicomponents.widgets.WView
import org.mytonwallet.app_air.uicomponents.widgets.animateHeight
import org.mytonwallet.app_air.uicomponents.widgets.fadeIn
import org.mytonwallet.app_air.uicomponents.widgets.fadeOut
import org.mytonwallet.app_air.walletcontext.R
import org.mytonwallet.app_air.walletcontext.helpers.LocaleController
import org.mytonwallet.app_air.walletcontext.theme.WColor
import org.mytonwallet.app_air.walletcontext.theme.color

@SuppressLint("ViewConstructor")
class SwapRateRowView(
    context: Context,
    onDexPressed: () -> Unit
) : WView(context),
    WThemedView {

    private val separator = SeparatorBackgroundDrawable().apply {
        offsetStart = 20f.dp
        offsetEnd = 20f.dp
    }

    private val titleLabel = WCounterLabel(context).apply {
        id = generateViewId()
        setStyle(16f)
        setAmount(LocaleController.getString(R.string.Swap_Est_PricePer, listOf("1")))
    }

    private val valueLabel = WCounterLabel(context).apply {
        setStyle(16f)
    }

    private val bestRateLabel = WCounterLabel(context).apply {
        setStyle(12f, WFont.Bold)
        setGradientColor(
            intArrayOf(
                WColor.EarnGradientLeft.color,
                WColor.EarnGradientRight.color
            )
        )
        background = HighlightGradientBackgroundDrawable(
            false,
            4f.dp
        )
        setAmount(LocaleController.getString(R.string.DexAggregator_BestRate))
        setPadding(3.dp, 4.dp, 3.dp, 0)
    }

    private val dexLabel = WLabel(context).apply {
        setStyle(14f)
        setPadding(0, 0, 0, 1)
    }

    private val arrowDrawable = ContextCompat.getDrawable(
        context,
        org.mytonwallet.app_air.icons.R.drawable.ic_arrow_right_thin_24
    )!!

    private val arrowImage = AppCompatImageView(context).apply {
        setImageDrawable(arrowDrawable)
        alpha = 0.5f
    }

    private val dexView = LinearLayout(context).apply {
        orientation = LinearLayout.HORIZONTAL
        background = WRippleDrawable.create(4f.dp)
        gravity = Gravity.CENTER_VERTICAL
        addView(bestRateLabel, LayoutParams(WRAP_CONTENT, 18.dp))
        addView(dexLabel, LinearLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT).apply {
            leftMargin = 4.dp
        })
        addView(arrowImage)
        setOnClickListener {
            onDexPressed()
        }
        visibility = GONE
    }

    private val valueView = LinearLayout(context).apply {
        id = generateViewId()
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.END
        addView(valueLabel, LayoutParams(WRAP_CONTENT, 24.dp))
        addView(dexView, LayoutParams(WRAP_CONTENT, 24.dp))
    }

    init {
        layoutParams = ViewGroup.LayoutParams(MATCH_PARENT, 56.dp)
    }

    @SuppressLint("SetTextI18n")
    override fun setupViews() {
        super.setupViews()

        background = separator

        addView(titleLabel, LayoutParams(WRAP_CONTENT, 24.dp))
        addView(valueView, LayoutParams(WRAP_CONTENT, WRAP_CONTENT))
        setConstraints {
            toStart(titleLabel, 20f)
            toTop(titleLabel, 18f)
            toCenterY(valueView)
            toEnd(valueView, 16f)
        }

        updateTheme()
    }

    override fun updateTheme() {
        titleLabel.setTextColor(WColor.SecondaryText.color)
        valueLabel.setTextColor(WColor.PrimaryText.color)
        dexLabel.setTextColor(WColor.SecondaryText.color)
        arrowDrawable.setTint(WColor.SecondaryText.color)
    }

    private var dexVisibility = GONE
    fun setTitleAndValue(
        title: String,
        value: String,
        dex: String?,
        isBest: Boolean = false,
        modalAvailable: Boolean
    ) {
        titleLabel.setAmount(title)
        valueLabel.setAmount(value)
        if (dex != null)
            dexLabel.text = LocaleController.getStringBold(R.string.DexAggregator_Via, listOf(dex))
        dexVisibility = if (dex == null) GONE else VISIBLE
        bestRateLabel.visibility = if (modalAvailable && isBest) VISIBLE else GONE
        arrowImage.visibility = if (modalAvailable) VISIBLE else GONE
        if (dexView.visibility != dexVisibility) {
            if (dexVisibility == VISIBLE) {
                dexView.visibility = VISIBLE
                dexView.fadeIn { }
            } else {
                dexView.fadeOut {
                    if (dexVisibility == GONE)
                        dexView.visibility = GONE
                }
            }
            animateHeight(if (dex == null) 56.dp else 80.dp)
        }
    }

    fun clearValue() {
        valueLabel.setAmount("")
        dexVisibility = GONE
        dexView.fadeOut {
            if (dexVisibility == GONE)
                dexView.visibility = GONE
        }
        animateHeight(56.dp)
    }
}
