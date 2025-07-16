package org.mytonwallet.app_air.uicomponents.helpers

import android.graphics.Rect
import android.view.View
import androidx.recyclerview.widget.RecyclerView

class PositionBasedItemDecoration(
    private val spacingProvider: (position: Int) -> Rect
) : RecyclerView.ItemDecoration() {

    override fun getItemOffsets(
        outRect: Rect,
        view: View,
        parent: RecyclerView,
        state: RecyclerView.State
    ) {
        val position = parent.getChildAdapterPosition(view)
        if (position == RecyclerView.NO_POSITION) return

        val spacing = spacingProvider(position)
        outRect.set(spacing.left, spacing.top, spacing.right, spacing.bottom)
    }
}
