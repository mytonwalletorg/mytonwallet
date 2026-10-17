package org.mytonwallet.app_air.uicomponents.widgets.suggestion

import android.content.Context
import android.graphics.Color
import android.view.Gravity
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import kotlin.math.roundToInt
import org.mytonwallet.app_air.uicomponents.drawable.WRippleDrawable
import org.mytonwallet.app_air.uicomponents.extensions.dp
import org.mytonwallet.app_air.uicomponents.widgets.WCell
import org.mytonwallet.app_air.uicomponents.widgets.WLabel
import org.mytonwallet.app_air.uicomponents.widgets.WThemedView
import org.mytonwallet.app_air.walletbasecontext.theme.WColor
import org.mytonwallet.app_air.walletbasecontext.theme.color
import org.mytonwallet.app_air.walletcontext.utils.colorWithAlpha

class WSuggestionCell(context: Context) :
    WCell(context, LayoutParams(WRAP_CONTENT, MATCH_PARENT)),
    WThemedView {

    private val ripple = WRippleDrawable.create(14f.dp)

    var onTap: ((text: String) -> Unit)? = null

    private var isPrimary = false

    private val titleLabel: WLabel by lazy {
        WLabel(context).apply {
            setStyle(17f)
            maxLines = 1
            gravity = Gravity.CENTER
            background = ripple
        }
    }

    init {
        addView(titleLabel, LayoutParams(WRAP_CONTENT, MATCH_PARENT))

        setConstraints {
            toCenterX(titleLabel)
            toCenterY(titleLabel, 6f)
        }

        setOnClickListener {
            onTap?.invoke(titleLabel.text.toString())
        }

        updateTheme()
    }

    override fun updateTheme() {
        applySelection()
    }

    fun configure(text: String, isPrimary: Boolean, minWidth: Int) {
        titleLabel.text = text
        this.isPrimary = isPrimary
        val horizontalPadding = if (isPrimary) 14.dp else 12.dp
        titleLabel.setPaddingRelative(horizontalPadding, 0, horizontalPadding, 0)
        titleLabel.minWidth =
            (minWidth - 28f.dp.roundToInt() + 2 * horizontalPadding).coerceAtLeast(0)
        val gap = if (isPrimary) 0 else 2.dp
        setPaddingRelative(gap, 0, gap, 0)
        applySelection()
    }

    private fun applySelection() {
        titleLabel.setTextColor(if (isPrimary) WColor.Tint.color else WColor.PrimaryText.color)
        ripple.rippleColor =
            if (isPrimary) WColor.TintRipple.color else WColor.BackgroundRipple.color
        ripple.backgroundColor =
            if (isPrimary) WColor.Tint.color.colorWithAlpha(25) else Color.TRANSPARENT
    }
}
