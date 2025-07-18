package org.mytonwallet.app_air.uicomponents.widgets

import android.content.Context
import android.view.View
import org.mytonwallet.app_air.uicomponents.drawable.SeparatorBackgroundDrawable

open class WBaseView(context: Context?) : View(context), WThemedView {
    init {
        id = generateViewId()
    }

    override fun updateTheme() {
        if (background is SeparatorBackgroundDrawable)
            background.invalidateSelf()
    }
}
