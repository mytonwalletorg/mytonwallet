package org.mytonwallet.app_air.uicomponents.extensions

import android.graphics.drawable.GradientDrawable
import androidx.core.graphics.toColorInt
import org.mytonwallet.app_air.uicomponents.image.Content

fun GradientDrawable.setRounding(rounding: Content.Rounding) {
    when (rounding) {
        is Content.Rounding.Round -> {
            this.shape = GradientDrawable.OVAL
            this.cornerRadii = FloatArray(8) { 0f }
        }

        is Content.Rounding.Radius -> {
            this.shape = GradientDrawable.RECTANGLE
            this.cornerRadii = FloatArray(8) { rounding.radius }
        }

        else -> {}
    }
}

object GradientDrawables {
    private fun gradientDrawable(colors: IntArray): GradientDrawable {
        return GradientDrawable(
            GradientDrawable.Orientation.TOP_BOTTOM,
            colors
        ).apply {
            shape = GradientDrawable.OVAL
        }
    }

    val greenDrawable: GradientDrawable
        get() {
            return gradientDrawable(intArrayOf("#A0DE7E".toColorInt(), "#54CB68".toColorInt()))
        }
    val blueDrawable: GradientDrawable
        get() {
            return gradientDrawable(intArrayOf("#72D5FD".toColorInt(), "#2A9EF1".toColorInt()))
        }
    val purpleDrawable: GradientDrawable
        get() {
            return gradientDrawable(intArrayOf("#82B1FF".toColorInt(), "#665FFF".toColorInt()))
        }
    val grayDrawable: GradientDrawable
        get() {
            return gradientDrawable(intArrayOf("#AEB3BF".toColorInt(), "#848890".toColorInt()))
        }
    val redDrawable: GradientDrawable
        get() {
            return gradientDrawable(intArrayOf("#FF885E".toColorInt(), "#FF516A".toColorInt()))
        }

}
