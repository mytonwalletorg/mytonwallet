package org.mytonwallet.app_air.uicomponents.commonViews.cells

import android.content.Context
import android.graphics.Color
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import org.mytonwallet.app_air.uicomponents.commonViews.WEmptyView
import org.mytonwallet.app_air.uicomponents.extensions.dp
import org.mytonwallet.app_air.uicomponents.widgets.WCell
import org.mytonwallet.app_air.uicomponents.widgets.WThemedView
import org.mytonwallet.app_air.walletcontext.R
import org.mytonwallet.app_air.walletcontext.helpers.LocaleController

class EmptyCell(context: Context) : WCell(context), WThemedView {

    override fun setupViews() {
        super.setupViews()

        val emptyView = WEmptyView(
            context,
            LocaleController.getString(R.string.Home_WalletCreatedTitle),
            LocaleController.getString(R.string.Home_WalletCreated)
        )
        addView(emptyView, LayoutParams(WRAP_CONTENT, 120.dp))
        setConstraints {
            toTop(emptyView)
            toCenterX(emptyView)
        }

        updateTheme()
    }

    override fun updateTheme() {
        setBackgroundColor(Color.TRANSPARENT)
    }
}
