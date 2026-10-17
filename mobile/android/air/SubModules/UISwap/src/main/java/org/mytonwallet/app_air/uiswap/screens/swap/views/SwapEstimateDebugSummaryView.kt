package org.mytonwallet.app_air.uiswap.screens.swap.views

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Typeface
import android.util.TypedValue
import androidx.appcompat.widget.AppCompatTextView
import org.mytonwallet.app_air.uicomponents.extensions.dp
import org.mytonwallet.app_air.uicomponents.extensions.setPaddingDp
import org.mytonwallet.app_air.uicomponents.widgets.WThemedView
import org.mytonwallet.app_air.uicomponents.widgets.setBackgroundColor
import org.mytonwallet.app_air.walletbasecontext.theme.ViewConstants
import org.mytonwallet.app_air.walletbasecontext.theme.WColor
import org.mytonwallet.app_air.walletbasecontext.theme.color

@SuppressLint("ViewConstructor")
class SwapEstimateDebugSummaryView(context: Context) :
    AppCompatTextView(context),
    WThemedView {

    init {
        id = generateViewId()
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
        setLineHeight(TypedValue.COMPLEX_UNIT_SP, 16f)
        typeface = Typeface.MONOSPACE
        setPaddingDp(16, 12, 16, 12)
        updateTheme()
    }

    fun configure(summary: String) {
        text = summary
    }

    override fun updateTheme() {
        setTextColor(WColor.SecondaryText.color)
        setBackgroundColor(WColor.Background.color, ViewConstants.BLOCK_RADIUS.dp, true)
    }
}
