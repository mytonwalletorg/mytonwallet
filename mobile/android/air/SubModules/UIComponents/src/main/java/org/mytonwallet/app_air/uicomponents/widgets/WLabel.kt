package org.mytonwallet.app_air.uicomponents.widgets

import android.animation.ValueAnimator
import android.content.Context
import android.util.TypedValue
import androidx.appcompat.widget.AppCompatTextView
import org.mytonwallet.app_air.uicomponents.helpers.WFont
import org.mytonwallet.app_air.uicomponents.helpers.typeface
import org.mytonwallet.app_air.walletcontext.R
import org.mytonwallet.app_air.walletcontext.helpers.LocaleController
import org.mytonwallet.app_air.walletcontext.theme.WColor
import org.mytonwallet.app_air.walletcontext.theme.color
import org.mytonwallet.app_air.walletcontext.utils.isSameDayAs
import org.mytonwallet.app_air.walletcontext.utils.isSameYearAs
import org.mytonwallet.app_air.walletcontext.utils.smartDecimalsCount
import org.mytonwallet.app_air.walletcontext.utils.toString
import java.math.BigInteger
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

open class WLabel(context: Context) : AppCompatTextView(context), WThemedView {
    init {
        if (id == NO_ID) {
            id = generateViewId()
        }
    }

    private val monthAndDayFormat by lazy {
        SimpleDateFormat("MMMM d", Locale.getDefault())
    }
    private val fullDateFormat by lazy {
        SimpleDateFormat("MMMM d, yyyy", Locale.getDefault())
    }

    fun setStyle(size: Float, font: WFont? = null) {
        typeface = (font ?: WFont.Regular).typeface
        setTextSize(TypedValue.COMPLEX_UNIT_SP, size)
    }

    fun setLineHeight(size: Float) {
        setLineHeight(TypedValue.COMPLEX_UNIT_SP, size)
    }

    fun setAmount(
        amount: BigInteger,
        decimals: Int,
        currency: String,
        currencyDecimals: Int,
        smartDecimals: Boolean,
        showPositiveSign: Boolean = false,
        forceCurrencyToRight: Boolean = false,
    ) {
        val newText = amount.toString(
            decimals = decimals,
            currency = currency,
            currencyDecimals = if (smartDecimals) amount.smartDecimalsCount(currencyDecimals) else currencyDecimals,
            showPositiveSign = showPositiveSign,
            forceCurrencyToRight = forceCurrencyToRight
        )
        if (text != newText)
            text = newText
    }

    fun setAmount(
        amount: Double?,
        decimals: Int,
        currency: String,
        currencyDecimals: Int,
        smartDecimals: Boolean,
        showPositiveSign: Boolean = false
    ) {
        text = amount?.toString(
            decimals = decimals,
            currency = currency,
            currencyDecimals = currencyDecimals,
            smartDecimals = smartDecimals,
            showPositiveSign = showPositiveSign
        )
    }

    fun setUserFriendlyDate(dt: Date) {
        val now = Date()
        if (now.isSameDayAs(dt)) {
            text = LocaleController.getString(R.string.Time_Today)
        } else {
            val sameYear = now.isSameYearAs(dt)
            text =
                if (sameYear) monthAndDayFormat.format(dt) else fullDateFormat.format(dt)
        }
    }

    private var themedColor: WColor? = null

    fun setTextColor(color: WColor?) {
        themedColor = color
        updateTheme()
    }

    override fun updateTheme() {
        themedColor?.let {
            setTextColor(it.color)
        }
    }

    fun animateTextColor(endColor: Int, duration: Long) {
        val colorAnimator = ValueAnimator.ofArgb(currentTextColor, endColor)
        colorAnimator.duration = duration
        colorAnimator.addUpdateListener { animator ->
            val animatedColor = animator.animatedValue as Int
            setTextColor(animatedColor)
        }
        colorAnimator.start()
    }
}
