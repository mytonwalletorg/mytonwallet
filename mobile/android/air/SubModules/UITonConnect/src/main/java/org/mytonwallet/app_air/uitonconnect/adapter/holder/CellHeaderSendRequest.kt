package org.mytonwallet.app_air.uitonconnect.adapter.holder

import android.content.Context
import android.text.TextUtils
import android.util.TypedValue
import android.view.Gravity
import android.view.ViewGroup
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.LinearLayout
import androidx.appcompat.widget.AppCompatTextView
import org.mytonwallet.app_air.uicomponents.adapter.BaseListHolder
import org.mytonwallet.app_air.uicomponents.extensions.dp
import org.mytonwallet.app_air.uicomponents.extensions.setPaddingDp
import org.mytonwallet.app_air.uicomponents.helpers.WFont
import org.mytonwallet.app_air.uicomponents.helpers.typeface
import org.mytonwallet.app_air.uicomponents.image.Content
import org.mytonwallet.app_air.uicomponents.image.WCustomImageView
import org.mytonwallet.app_air.uicomponents.widgets.WThemedView
import org.mytonwallet.app_air.uitonconnect.adapter.TonConnectItem
import org.mytonwallet.app_air.walletcontext.R
import org.mytonwallet.app_air.walletcontext.helpers.LocaleController
import org.mytonwallet.app_air.walletcontext.theme.WColor
import org.mytonwallet.app_air.walletcontext.theme.color
import org.mytonwallet.app_air.walletcore.moshi.ApiDapp

class CellHeaderSendRequest(context: Context) : LinearLayout(context), WThemedView {
    private val imageView = WCustomImageView(context).apply {
        defaultRounding = Content.Rounding.Radius(20f.dp)
    }

    private val titleTextView = AppCompatTextView(context).apply {
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 28f)
        setLineHeight(TypedValue.COMPLEX_UNIT_SP, 36f)
        ellipsize = TextUtils.TruncateAt.END
        gravity = Gravity.CENTER
        typeface = WFont.Medium.typeface
        maxLines = 1
        text = LocaleController.getString(R.string.DApp_SendTransactionAsk)
    }

    private val linkTextView = AppCompatTextView(context).apply {
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
        setLineHeight(TypedValue.COMPLEX_UNIT_SP, 24f)
        ellipsize = TextUtils.TruncateAt.END
        gravity = Gravity.CENTER
        typeface = WFont.Regular.typeface
        maxLines = 1
    }

    init {
        setPaddingDp(20, 14, 20, 24)
        orientation = VERTICAL

        addView(imageView, LayoutParams(80.dp, 80.dp).apply { gravity = Gravity.CENTER })
        addView(titleTextView, LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = 24.dp })
        addView(linkTextView, LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = 12.dp })
        updateTheme()
    }

    fun configure(dApp: ApiDapp) {
        linkTextView.text = dApp.host
        imageView.set(Content.ofUrl(dApp.iconUrl))
    }

    override fun updateTheme() {
        titleTextView.setTextColor(WColor.PrimaryText.color)
        linkTextView.setTextColor(WColor.Tint.color)
    }

    class Holder(parent: ViewGroup) : BaseListHolder<TonConnectItem.SendRequestHeader>(
        CellHeaderSendRequest(parent.context).apply {
            layoutParams = ViewGroup.LayoutParams(
                MATCH_PARENT,
                WRAP_CONTENT
            )
        }) {
        private val view: CellHeaderSendRequest = itemView as CellHeaderSendRequest
        override fun onBind(item: TonConnectItem.SendRequestHeader) {
            view.configure(item.app)
        }
    }
}
