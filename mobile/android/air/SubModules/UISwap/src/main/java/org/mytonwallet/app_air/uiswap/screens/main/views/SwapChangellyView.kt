package org.mytonwallet.app_air.uiswap.screens.main.views

import android.content.Context
import android.text.method.LinkMovementMethod
import android.util.AttributeSet
import android.util.TypedValue
import android.widget.LinearLayout
import android.widget.LinearLayout.VERTICAL
import androidx.appcompat.widget.AppCompatTextView
import androidx.core.content.ContextCompat
import org.mytonwallet.app_air.icons.R
import org.mytonwallet.app_air.uicomponents.extensions.dp
import org.mytonwallet.app_air.uicomponents.extensions.setPaddingDp
import org.mytonwallet.app_air.uicomponents.helpers.WFont
import org.mytonwallet.app_air.uicomponents.helpers.typeface
import org.mytonwallet.app_air.uicomponents.widgets.ExpandableFrameLayout
import org.mytonwallet.app_air.uicomponents.widgets.WThemedView
import org.mytonwallet.app_air.uiinappbrowser.span.InAppBrowserUrlSpan
import org.mytonwallet.app_air.walletcontext.helpers.LocaleController
import org.mytonwallet.app_air.walletcontext.helpers.SpanHelpers
import org.mytonwallet.app_air.walletcontext.theme.WColor
import org.mytonwallet.app_air.walletcontext.theme.color

class SwapChangellyView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyle: Int = 0,
) : ExpandableFrameLayout(context, attrs, defStyle), WThemedView {

    private val linearLayout = LinearLayout(context).apply {
        setPaddingDp(20, 16, 20, 16)
        layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT)
        orientation = VERTICAL
    }
    private val titleTextView = AppCompatTextView(context).apply {
        setLineHeight(TypedValue.COMPLEX_UNIT_SP, 24f)
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
        typeface = WFont.Medium.typeface

    }
    private val infoTextView = AppCompatTextView(context).apply {
        setLineHeight(TypedValue.COMPLEX_UNIT_SP, 20f)
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
        typeface = WFont.Regular.typeface
    }
    private val titleLogoDrawable =
        ContextCompat.getDrawable(context, R.drawable.ic_changelly_logo_20)

    init {
        titleTextView.text = LocaleController.getStringSpannable(
            org.mytonwallet.app_air.walletcontext.R.string.Swap_Cross_Chain_Changelly, listOf(
                SpanHelpers.buildSpannableImage(titleLogoDrawable)
            )
        )

        infoTextView.text = LocaleController.getStringSpannable(
            org.mytonwallet.app_air.walletcontext.R.string.Swap_Cross_Chain_Changelly_Info, listOf(
                SpanHelpers.buildSpannable(
                    LocaleController.getString(org.mytonwallet.app_air.walletcontext.R.string.Swap_Cross_Chain_Changelly_Info_Terms),
                    InAppBrowserUrlSpan("https://changelly.com/terms-of-use", null)
                ),
                SpanHelpers.buildSpannable(
                    LocaleController.getString(org.mytonwallet.app_air.walletcontext.R.string.Swap_Cross_Chain_Changelly_Info_Privacy),
                    InAppBrowserUrlSpan("https://changelly.com/privacy-policy", null)
                ),
                SpanHelpers.buildSpannable(
                    LocaleController.getString(org.mytonwallet.app_air.walletcontext.R.string.Swap_Cross_Chain_Changelly_Info_AML),
                    InAppBrowserUrlSpan("https://changelly.com/aml-kyc", null)
                )
            )
        )
        infoTextView.movementMethod = LinkMovementMethod.getInstance()

        linearLayout.addView(titleTextView)
        linearLayout.addView(
            infoTextView,
            LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT).apply {
                topMargin = 4.dp
            })

        addView(linearLayout)

        updateTheme()
    }

    override fun updateTheme() {
        titleLogoDrawable?.setTint(WColor.PrimaryText.color)
        titleTextView.setTextColor(WColor.PrimaryText.color)

        infoTextView.setTextColor(WColor.PrimaryText.color)
        infoTextView.setLinkTextColor(WColor.Tint.color)
        infoTextView.highlightColor = WColor.tintRippleColor
    }
}
