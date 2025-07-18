package org.mytonwallet.app_air.uicomponents.widgets.segmentedController

import android.content.Context
import android.view.ViewGroup
import org.mytonwallet.app_air.uicomponents.base.WViewController
import org.mytonwallet.app_air.uicomponents.widgets.WCell

class WSegmentedControllerPageCell(
    context: Context,
) : WCell(context) {

    override fun setupViews() {
        super.setupViews()

    }

    fun configure(viewController: WViewController) {
        if (viewController.view.parent == this)
            return

        if (viewController.view.parent != null)
            (viewController.view.parent as ViewGroup).removeView(viewController.view)
        if (childCount > 0)
            removeAllViews()
        addView(viewController.view)
        setConstraints {
            allEdges(viewController.view)
        }
    }

}
