package org.mytonwallet.app_air.uibrowser.viewControllers.exploreCategory.cells

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import androidx.constraintlayout.widget.ConstraintLayout.LayoutParams.MATCH_CONSTRAINT
import androidx.core.content.ContextCompat
import org.mytonwallet.app_air.uicomponents.extensions.dp
import org.mytonwallet.app_air.uicomponents.helpers.WFont
import org.mytonwallet.app_air.uicomponents.image.Content
import org.mytonwallet.app_air.uicomponents.image.WCustomImageView
import org.mytonwallet.app_air.uicomponents.widgets.WCell
import org.mytonwallet.app_air.uicomponents.widgets.WLabel
import org.mytonwallet.app_air.uicomponents.widgets.WThemedView
import org.mytonwallet.app_air.uicomponents.widgets.WView
import org.mytonwallet.app_air.uicomponents.widgets.addRippleEffect
import org.mytonwallet.app_air.uicomponents.widgets.setBackgroundColor
import org.mytonwallet.app_air.walletcontext.R
import org.mytonwallet.app_air.walletcontext.helpers.LocaleController
import org.mytonwallet.app_air.walletcontext.theme.ThemeManager
import org.mytonwallet.app_air.walletcontext.theme.ViewConstants
import org.mytonwallet.app_air.walletcontext.theme.WColor
import org.mytonwallet.app_air.walletcontext.theme.color
import org.mytonwallet.app_air.walletcore.models.MExploreSite

@SuppressLint("ViewConstructor")
class ExploreCategorySiteCell(
    context: Context,
    private val onSiteTap: (site: MExploreSite) -> Unit
) : WCell(context, LayoutParams(MATCH_PARENT, 76.dp)), WThemedView {

    private val img = WCustomImageView(context).apply {
        defaultRounding = Content.Rounding.Radius(12f.dp)
    }

    private val titleLabel = WLabel(context).apply {
        setStyle(15f, WFont.SemiBold)
        gravity = Gravity.LEFT
        compoundDrawablePadding = 4.dp
    }

    private val subtitleLabel = WLabel(context).apply {
        setStyle(12f, WFont.Medium)
        gravity = Gravity.LEFT
        maxLines = 2
    }

    private val badgeLabel: WLabel by lazy {
        WLabel(context).apply {
            setStyle(12f, WFont.Medium)
            setPadding(4.dp, 4.dp, 6.dp, 0)
            text = site?.badgeText
        }
    }

    private val openButton = WLabel(context).apply {
        setStyle(16f, WFont.SemiBold)
        text = LocaleController.getString(R.string.Explore_Open)
        gravity = Gravity.CENTER
        setTextColor(WColor.TextOnTint)
        setOnClickListener {
            site?.let {
                onSiteTap(it)
            }
        }
    }

    private val separator: WView by lazy {
        val v = WView(context)
        v
    }

    override fun setupViews() {
        super.setupViews()

        clipChildren = false

        addView(img, LayoutParams(48.dp, 48.dp))
        addView(titleLabel, LayoutParams(MATCH_CONSTRAINT, WRAP_CONTENT).apply {
            marginEnd = 8.dp
        })
        addView(subtitleLabel, LayoutParams(MATCH_CONSTRAINT, WRAP_CONTENT).apply {
            marginEnd = 8.dp
        })
        addView(openButton, LayoutParams(WRAP_CONTENT, 32.dp))
        addView(separator, LayoutParams(0, 1))

        if (site?.badgeText?.isNotBlank() == true)
            addView(badgeLabel, LayoutParams(WRAP_CONTENT, WRAP_CONTENT))

        setConstraints {
            toStart(img, 14f)
            toCenterY(img)
            toTop(titleLabel, 12f)
            startToEnd(titleLabel, img, 12f)
            endToStart(titleLabel, openButton)
            setHorizontalBias(titleLabel.id, 0f)
            startToEnd(subtitleLabel, img, 12f)
            topToBottom(subtitleLabel, titleLabel)
            endToStart(subtitleLabel, openButton)
            toBottom(separator)
            toCenterX(separator, 16f)
            if (site?.badgeText?.isNotBlank() == true) {
                toTop(badgeLabel, -4f)
                toEnd(badgeLabel, -4f)
            }
            toCenterY(openButton)
            toEnd(openButton, 20f)
        }

        setOnClickListener {
            site?.let {
                onSiteTap(it)
            }
        }
        updateTheme()
    }

    private var site: MExploreSite? = null
    private var isFirst = false
    private var isLast = false
    fun configure(site: MExploreSite, isFirst: Boolean, isLast: Boolean) {
        this.site = site
        this.isFirst = isFirst
        this.isLast = isLast
        img.set(Content.ofUrl(site.icon ?: ""))
        titleLabel.text = site.name
        subtitleLabel.text = site.description
        separator.visibility = if (isLast) INVISIBLE else VISIBLE
        updateTheme()
    }

    override fun updateTheme() {
        setBackgroundColor(
            WColor.Background.color,
            if (isFirst) ViewConstants.TOP_RADIUS.dp else 0f,
            if (isLast) ViewConstants.BIG_RADIUS.dp else 0f
        )
        addRippleEffect(WColor.SecondaryBackground.color)
        titleLabel.setTextColor(WColor.PrimaryText.color)
        subtitleLabel.setTextColor(WColor.SecondaryText.color)
        if (site?.withBorder == true) {
            val border = GradientDrawable()
            border.setColor(WColor.Background.color)
            border.setStroke(1, WColor.Tint.color)
            val radii = FloatArray(8) { 0f }
            when {
                isFirst && isLast -> {
                    radii.fill(ViewConstants.BIG_RADIUS.dp)
                }

                isFirst -> {
                    radii[0] = ViewConstants.BIG_RADIUS.dp
                    radii[1] = ViewConstants.BIG_RADIUS.dp
                    radii[2] = ViewConstants.BIG_RADIUS.dp
                    radii[3] = ViewConstants.BIG_RADIUS.dp
                }

                isLast -> {
                    radii[4] = ViewConstants.BIG_RADIUS.dp
                    radii[5] = ViewConstants.BIG_RADIUS.dp
                    radii[6] = ViewConstants.BIG_RADIUS.dp
                    radii[7] = ViewConstants.BIG_RADIUS.dp
                }
            }
            border.cornerRadii = radii
            background = border
            separator.setBackgroundColor(Color.TRANSPARENT)
        } else {
            separator.setBackgroundColor(WColor.Separator.color)
        }
        if (site?.badgeText?.isNotBlank() == true) {
            val isCorneredFirstItem =
                isFirst && ThemeManager.uiMode.hasRoundedCorners
            badgeLabel.setBackgroundColor(WColor.Tint.color, 4f.dp, true)
            badgeLabel.setTextColor(WColor.TextOnTint.color)
            badgeLabel.setPadding(
                4.dp,
                if (isCorneredFirstItem) 6.dp else 4.dp,
                if (isCorneredFirstItem) 14.dp else 6.dp,
                0
            )
        }
        if (site?.isTelegram == true) {
            val drawable = ContextCompat.getDrawable(
                context,
                org.mytonwallet.app_air.icons.R.drawable.ic_telegram
            )
            drawable?.setTint(WColor.TextOnTint.color)
            openButton.setCompoundDrawablesWithIntrinsicBounds(
                drawable,
                null,
                null,
                null
            )
            openButton.compoundDrawablePadding = 5.dp
            openButton.setPadding(9.dp, 0, 12.dp, 0)
        } else {
            openButton.setCompoundDrawablesWithIntrinsicBounds(null, null, null, null)
            openButton.setPadding(12.dp, 0, 12.dp, 0)
        }
        openButton.setBackgroundColor(WColor.Tint.color, 16f.dp)
        openButton.addRippleEffect(WColor.TintRipple.color, 16f.dp)
    }

}
