package org.mytonwallet.app_air.uicomponents.extensions

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.view.animation.AccelerateDecelerateInterpolator
import androidx.core.graphics.ColorUtils
import androidx.core.graphics.createBitmap
import androidx.core.graphics.drawable.toDrawable
import org.mytonwallet.app_air.uicomponents.AnimationConstants

fun Drawable.animateTintColor(
    fromColor: Int,
    toColor: Int,
    duration: Long = AnimationConstants.QUICK_ANIMATION
) {
    ValueAnimator.ofFloat(0f, 1f).apply {
        this.duration = duration
        this.interpolator = AccelerateDecelerateInterpolator()
        addUpdateListener { animator ->
            val fraction = animator.animatedValue as Float
            val color = ColorUtils.blendARGB(fromColor, toColor, fraction)
            setTint(color)
        }
        start()
    }
}

fun Drawable.resize(
    context: Context,
    widthPx: Int,
    heightPx: Int,
    tintColor: Int? = null
): BitmapDrawable {
    val bitmap = createBitmap(widthPx, heightPx)
    val canvas = Canvas(bitmap)

    setBounds(0, 0, widthPx, heightPx)
    tintColor?.let { setTint(it) }
    draw(canvas)

    return bitmap.toDrawable(context.resources)
}
