package org.mytonwallet.app_air.uibrowser.viewControllers.explore.cells

import android.annotation.SuppressLint
import android.content.Context
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import androidx.constraintlayout.widget.ConstraintSet
import org.mytonwallet.app_air.uicomponents.extensions.dp
import org.mytonwallet.app_air.uicomponents.helpers.WFont
import org.mytonwallet.app_air.uicomponents.widgets.WBaseView
import org.mytonwallet.app_air.uicomponents.widgets.WCell
import org.mytonwallet.app_air.uicomponents.widgets.WLabel
import org.mytonwallet.app_air.uicomponents.widgets.WThemedView
import org.mytonwallet.app_air.uicomponents.widgets.setBackgroundColor
import org.mytonwallet.app_air.walletcontext.theme.ThemeManager
import org.mytonwallet.app_air.walletcontext.theme.WColor
import org.mytonwallet.app_air.walletcontext.theme.color

@SuppressLint("ViewConstructor")
class ExploreCategoryCenteredTitleCell(context: Context) :
    WCell(context, LayoutParams(MATCH_PARENT, WRAP_CONTENT)), WThemedView {
    private val titleLabel: WLabel by lazy {
        val lbl = WLabel(context)
        lbl.setStyle(17f, WFont.Medium)
        lbl.maxLines = 1
        lbl
    }

    private val leftLineView = WBaseView(context)
    private val rightLineView = WBaseView(context)

    init {
        addView(leftLineView, LayoutParams(64.dp, 2.dp).apply {
            rightMargin = 12.dp
        })
        addView(rightLineView, LayoutParams(64.dp, 2.dp).apply {
            leftMargin = 12.dp
        })
        addView(titleLabel, LayoutParams(WRAP_CONTENT, WRAP_CONTENT))
        setConstraints {
            toLeft(leftLineView)
            toCenterY(leftLineView)
            leftToRight(titleLabel, leftLineView)
            toCenterY(titleLabel)
            leftToRight(rightLineView, titleLabel)
            toRight(rightLineView)
            toCenterY(rightLineView)
            createHorizontalChain(
                ConstraintSet.PARENT_ID, ConstraintSet.LEFT,
                ConstraintSet.PARENT_ID, ConstraintSet.RIGHT,
                intArrayOf(leftLineView.id, titleLabel.id, rightLineView.id),
                null,
                ConstraintSet.CHAIN_PACKED
            )
        }
    }

    override fun updateTheme() {
        titleLabel.setTextColor(WColor.PrimaryText.color)
        val color = (if (ThemeManager.isDark) WColor.Separator else WColor.GroupedBackground).color
        leftLineView.setBackgroundColor(color, 1f)
        rightLineView.setBackgroundColor(color, 1f)
    }

    fun configure(title: String, topPadding: Int, bottomPadding: Int) {
        setPadding(0, topPadding, 0, bottomPadding)
        titleLabel.text = title
        updateTheme()
    }

}
