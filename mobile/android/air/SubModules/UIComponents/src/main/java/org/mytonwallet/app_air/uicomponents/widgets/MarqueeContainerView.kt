package org.mytonwallet.app_air.uicomponents.widgets

import android.animation.ValueAnimator
import android.annotation.SuppressLint
import android.view.View
import android.view.ViewTreeObserver
import android.view.animation.LinearInterpolator
import android.widget.HorizontalScrollView

@SuppressLint("ViewConstructor")
class MarqueeContainerView(
    private val contentView: View
) : HorizontalScrollView(contentView.context) {

    private var marqueeAnimator: ValueAnimator? = null

    init {
        isHorizontalScrollBarEnabled = false
        overScrollMode = OVER_SCROLL_NEVER
        clipChildren = false

        contentView.let {
            it.layoutParams = LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT)
            removeAllViews()
            addView(it)

            it.viewTreeObserver.addOnGlobalLayoutListener(object :
                ViewTreeObserver.OnGlobalLayoutListener {
                override fun onGlobalLayout() {
                    it.viewTreeObserver.removeOnGlobalLayoutListener(this)
                    tryStartMarquee()
                }
            })
        }
    }

    private fun tryStartMarquee() {
        val child = contentView
        val scrollWidth = child.width
        val visibleWidth = width

        if (scrollWidth > visibleWidth) {
            startMarqueeAnimation(scrollWidth - visibleWidth)
        }
    }

    private fun startMarqueeAnimation(distance: Int) {
        stopMarqueeAnimation()

        marqueeAnimator = ValueAnimator.ofInt(0, distance).apply {
            duration = 5000L
            interpolator = LinearInterpolator()
            repeatCount = ValueAnimator.INFINITE
            repeatMode = ValueAnimator.RESTART

            addUpdateListener { animation ->
                val scrollPos = animation.animatedValue as Int
                scrollTo(scrollPos, 0)
            }
            start()
        }
    }

    fun stopMarqueeAnimation() {
        marqueeAnimator?.cancel()
        marqueeAnimator = null
        scrollTo(0, 0)
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        stopMarqueeAnimation()
    }
}
