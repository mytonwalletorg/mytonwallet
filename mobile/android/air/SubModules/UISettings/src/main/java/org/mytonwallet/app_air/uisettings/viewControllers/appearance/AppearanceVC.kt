package org.mytonwallet.app_air.uisettings.viewControllers.appearance

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ValueAnimator
import android.content.Context
import android.os.Build
import android.view.View.generateViewId
import android.view.ViewGroup
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.view.animation.AccelerateDecelerateInterpolator
import android.widget.ScrollView
import androidx.constraintlayout.widget.ConstraintLayout
import androidx.core.content.ContextCompat
import org.mytonwallet.app_air.uicomponents.AnimationConstants
import org.mytonwallet.app_air.uicomponents.base.WViewController
import org.mytonwallet.app_air.uicomponents.commonViews.KeyValueRowView
import org.mytonwallet.app_air.uicomponents.commonViews.cells.SwitchCell
import org.mytonwallet.app_air.uicomponents.extensions.dp
import org.mytonwallet.app_air.uicomponents.helpers.FontFamily
import org.mytonwallet.app_air.uicomponents.helpers.FontManager
import org.mytonwallet.app_air.uicomponents.widgets.WBaseView
import org.mytonwallet.app_air.uicomponents.widgets.WEditableItemView
import org.mytonwallet.app_air.uicomponents.widgets.WView
import org.mytonwallet.app_air.uicomponents.widgets.menu.WMenuPopup
import org.mytonwallet.app_air.uicomponents.widgets.setBackgroundColor
import org.mytonwallet.app_air.uisettings.viewControllers.appearance.views.theme.AppearanceAppThemeView
import org.mytonwallet.app_air.walletcontext.R
import org.mytonwallet.app_air.walletcontext.WalletContextManager
import org.mytonwallet.app_air.walletcontext.globalStorage.WGlobalStorage
import org.mytonwallet.app_air.walletcontext.helpers.LocaleController
import org.mytonwallet.app_air.walletcontext.theme.ThemeManager
import org.mytonwallet.app_air.walletcontext.theme.ViewConstants
import org.mytonwallet.app_air.walletcontext.theme.WColor
import org.mytonwallet.app_air.walletcontext.theme.color

class AppearanceVC(context: Context) : WViewController(context) {

    override val shouldDisplayBottomBar = true

    private val appThemeView: AppearanceAppThemeView by lazy {
        val v = AppearanceAppThemeView(context)
        v
    }

    private val spacer1: WBaseView by lazy {
        val v = WBaseView(context)
        v
    }

    private val currentFont = FontFamily.fromFamilyName(WGlobalStorage.getActiveFont())
    private val appFontDropdownView = WEditableItemView(context).apply {
        id = generateViewId()
        drawable = ContextCompat.getDrawable(
            context,
            org.mytonwallet.app_air.icons.R.drawable.ic_arrows_18
        )
        setText(currentFont.displayName)
    }
    private val appFontView: KeyValueRowView by lazy {
        KeyValueRowView(
            context,
            LocaleController.getString(R.string.Appearance_AppFont),
            "",
            KeyValueRowView.Mode.PRIMARY,
            isLast = true,
        ).apply {
            setValueView(appFontDropdownView)
            setOnClickListener {
                WMenuPopup.present(
                    appFontDropdownView,
                    listOf(
                        FontFamily.ROBOTO,
                        FontFamily.OPENSANS,
                        FontFamily.NOTOSANS,
                        FontFamily.NUNITOSANS,
                        FontFamily.MISANS
                    ).map {
                        WMenuPopup.Item(
                            null,
                            it.displayName,
                            false
                        ) {
                            if (currentFont != it) {
                                WGlobalStorage.setActiveFont(it.familyName)
                                FontManager.init(context)
                                appFontDropdownView.setText(it.displayName)
                                // Font changes require app restart to refresh all cached typefaces
                                WalletContextManager.delegate?.restartApp()
                            }
                        }
                    },
                    popupWidth = 130.dp,
                    aboveView = false
                )
            }
        }
    }

    private val spacer2: WBaseView by lazy {
        val v = WBaseView(context)
        v
    }

    /*private val appIconView: AppearanceAppIconView by lazy {
        val v = AppearanceAppIconView(window!!.applicationContext)
        v
    }

    private val spacer2: WBaseView by lazy {
        val v = WBaseView(context)
        v
    }*/

    private var radiusAnimator: ValueAnimator? = null
    private val roundedToolbarsRow = SwitchCell(
        context,
        title = LocaleController.getString(R.string.Appearance_RoundedToolbars),
        isChecked = ThemeManager.uiMode == ThemeManager.UIMode.BIG_RADIUS,
        isFirst = true,
        onChange = { isChecked ->
            val uiMode = if (isChecked) {
                ThemeManager.UIMode.BIG_RADIUS
            } else {
                ThemeManager.UIMode.COMPOUND
            }
            val prevBarRounds = topReversedCornerView?.cornerRadius ?: 0f
            WGlobalStorage.setActiveUiMode(uiMode)
            ThemeManager.uiMode = uiMode
            WalletContextManager.delegate?.themeChanged()
            topReversedCornerView?.animateRadius(
                prevBarRounds,
                ViewConstants.BAR_ROUNDS.dp
            )
            radiusAnimator?.cancel()
            radiusAnimator = ValueAnimator.ofFloat(prevBarRounds, ViewConstants.BAR_ROUNDS.dp)
                .apply {
                    duration = AnimationConstants.QUICK_ANIMATION
                    interpolator = AccelerateDecelerateInterpolator()

                    addUpdateListener { animator ->
                        val radius = animator.animatedValue as Float
                        appThemeView.setBackgroundColor(
                            WColor.Background.color,
                            radius,
                            ViewConstants.BIG_RADIUS.dp,
                        )
                    }

                    addListener(object : AnimatorListenerAdapter() {
                        override fun onAnimationEnd(animation: Animator) {
                            radiusAnimator = null
                        }
                    })

                    start()
                }
        }
    )

    private var sideGuttersAnimator: ValueAnimator? = null
    private val sideGuttersRow = SwitchCell(
        context,
        title = LocaleController.getString(R.string.Appearance_SideGutters),
        isChecked = ViewConstants.HORIZONTAL_PADDINGS > 0,
        onChange = { isChecked ->
            WGlobalStorage.setAreSideGuttersActive(isChecked)
            ViewConstants.HORIZONTAL_PADDINGS = if (isChecked) 10 else 0
            sideGuttersAnimator?.cancel()
            sideGuttersAnimator =
                ValueAnimator.ofInt(scrollView.paddingLeft, ViewConstants.HORIZONTAL_PADDINGS.dp)
                    .apply {
                        duration = AnimationConstants.QUICK_ANIMATION
                        interpolator = AccelerateDecelerateInterpolator()

                        addUpdateListener { animator ->
                            val padding = animator.animatedValue as Int
                            scrollView.setPadding(padding, 0, padding, 0)
                            topReversedCornerView?.setHorizontalPadding(padding.toFloat())
                            bottomReversedCornerView?.setHorizontalPadding(padding.toFloat())
                        }

                        addListener(object : AnimatorListenerAdapter() {
                            override fun onAnimationEnd(animation: Animator) {
                                sideGuttersAnimator = null
                            }
                        })

                        start()
                    }
        }
    )

    private val animationsRow = SwitchCell(
        context,
        title = LocaleController.getString(R.string.Appearance_Animations),
        isChecked = WGlobalStorage.getAreAnimationsActive(),
        onChange = { isChecked ->
            WGlobalStorage.setAreAnimationsActive(isChecked)
        }
    )

    private val soundsRow = SwitchCell(
        context,
        title = LocaleController.getString(R.string.Appearance_Sounds),
        isChecked = WGlobalStorage.getAreSoundsActive(),
        isLast = true,
        onChange = { isChecked ->
            WGlobalStorage.setAreSoundsActive(isChecked)
        })

    private val scrollingContentView: WView by lazy {
        val v = WView(context)
        v.addView(appThemeView, ViewGroup.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
        v.addView(spacer1, ViewGroup.LayoutParams(MATCH_PARENT, ViewConstants.GAP.dp))
        v.addView(appFontView, ConstraintLayout.LayoutParams(0, 56.dp))
        v.addView(spacer2, ViewGroup.LayoutParams(MATCH_PARENT, ViewConstants.GAP.dp))
        v.addView(roundedToolbarsRow, ConstraintLayout.LayoutParams(0, 56.dp))
        v.addView(sideGuttersRow, ConstraintLayout.LayoutParams(0, 56.dp))
        v.addView(animationsRow, ConstraintLayout.LayoutParams(0, 56.dp))
        v.addView(soundsRow, ConstraintLayout.LayoutParams(0, 56.dp))
        v.setConstraints {
            toTop(appThemeView)
            toCenterX(appThemeView)
            topToBottom(spacer1, appThemeView)
            topToBottom(appFontView, spacer1)
            toCenterX(appFontView)
            topToBottom(spacer2, appFontView)
            topToBottom(roundedToolbarsRow, spacer2)
            toCenterX(roundedToolbarsRow)
            topToBottom(sideGuttersRow, roundedToolbarsRow)
            toCenterX(sideGuttersRow)
            topToBottom(animationsRow, sideGuttersRow)
            toCenterX(animationsRow)
            topToBottom(soundsRow, animationsRow)
            toCenterX(soundsRow)
            toBottomPx(soundsRow, (navigationController?.getSystemBars()?.bottom ?: 0))
        }
        v
    }

    private val scrollView: ScrollView by lazy {
        ScrollView(context).apply {
            id = generateViewId()
            addView(scrollingContentView, ConstraintLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                setOnScrollChangeListener { _, _, scrollY, _, _ ->
                    updateBlurViews(scrollView = this, computedOffset = scrollY)
                }
            }
            overScrollMode = ScrollView.OVER_SCROLL_ALWAYS
            setPadding(
                ViewConstants.HORIZONTAL_PADDINGS.dp,
                0,
                ViewConstants.HORIZONTAL_PADDINGS.dp,
                0
            )
        }
    }

    override fun setupViews() {
        super.setupViews()

        setNavTitle(LocaleController.getString(R.string.Appearance_Title))
        setupNavBar(true)

        view.addView(scrollView, ConstraintLayout.LayoutParams(MATCH_PARENT, 0))
        view.setConstraints {
            topToBottom(scrollView, navigationBar!!)
            toCenterX(scrollView)
            toBottom(scrollView)
        }

        updateTheme()
    }

    override fun viewDidAppear() {
        super.viewDidAppear()
        updateBlurViews(scrollView, 0)
    }

    override fun updateTheme() {
        super.updateTheme()

        appFontView.setBackgroundColor(WColor.Background.color, ViewConstants.BIG_RADIUS.dp)

        if (ThemeManager.uiMode.hasRoundedCorners) {
            view.setBackgroundColor(WColor.SecondaryBackground.color)
        } else {
            view.setBackgroundColor(WColor.SecondaryBackground.color)
            val spacerBackground = WColor.SecondaryBackground.color
            spacer1.setBackgroundColor(spacerBackground)
            spacer2.setBackgroundColor(spacerBackground)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            scrollView.setOnScrollChangeListener(null)
        }
        animationsRow.setOnClickListener(null)
        soundsRow.setOnClickListener(null)
    }
}
