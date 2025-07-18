package org.mytonwallet.app_air.uicomponents.adapter.implementation.holders

import android.content.Context
import android.util.AttributeSet
import android.util.TypedValue
import android.view.ViewGroup
import androidx.appcompat.widget.AppCompatTextView
import org.mytonwallet.app_air.uicomponents.adapter.BaseListHolder
import org.mytonwallet.app_air.uicomponents.adapter.implementation.Item
import org.mytonwallet.app_air.uicomponents.extensions.dp
import org.mytonwallet.app_air.uicomponents.extensions.setPaddingDp
import org.mytonwallet.app_air.uicomponents.helpers.WFont
import org.mytonwallet.app_air.uicomponents.helpers.typeface
import org.mytonwallet.app_air.uicomponents.widgets.WThemedView
import org.mytonwallet.app_air.walletcontext.theme.WColor
import org.mytonwallet.app_air.walletcontext.theme.color

class ListTitleCell @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyle: Int = 0,
) : AppCompatTextView(context, attrs, defStyle), WThemedView {
    init {
        setPaddingDp(20, 16, 20, 8)
        layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 48.dp)
        isSingleLine = true
        maxLines = 1
        typeface = WFont.Medium.typeface
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
        setLineHeight(TypedValue.COMPLEX_UNIT_SP, 24f)
        updateTheme()
    }

    override fun updateTheme() {
        setTextColor(WColor.PrimaryText.color)
    }

    class Holder(parent: ViewGroup) :
        BaseListHolder<Item.ListTitle>(ListTitleCell(parent.context)) {
        private val view: AppCompatTextView = itemView as ListTitleCell
        override fun onBind(item: Item.ListTitle) {
            view.text = item.title
        }
    }
}
