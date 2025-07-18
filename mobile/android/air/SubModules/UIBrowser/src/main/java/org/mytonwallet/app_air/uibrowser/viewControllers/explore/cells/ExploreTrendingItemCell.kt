package org.mytonwallet.app_air.uibrowser.viewControllers.explore.cells

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.view.ViewGroup
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import androidx.constraintlayout.widget.ConstraintLayout.LayoutParams.MATCH_CONSTRAINT
import org.mytonwallet.app_air.uicomponents.extensions.dp
import org.mytonwallet.app_air.uicomponents.helpers.WFont
import org.mytonwallet.app_air.uicomponents.image.Content
import org.mytonwallet.app_air.uicomponents.image.WCustomImageView
import org.mytonwallet.app_air.uicomponents.widgets.AlphaGradientLayout
import org.mytonwallet.app_air.uicomponents.widgets.WLabel
import org.mytonwallet.app_air.uicomponents.widgets.WThemedView
import org.mytonwallet.app_air.uicomponents.widgets.WView
import org.mytonwallet.app_air.uicomponents.widgets.setBackgroundColor
import org.mytonwallet.app_air.walletcontext.theme.WColor
import org.mytonwallet.app_air.walletcontext.theme.color
import org.mytonwallet.app_air.walletcontext.utils.colorWithAlpha
import org.mytonwallet.app_air.walletcore.models.MExploreSite


@SuppressLint("ViewConstructor")
class ExploreTrendingItemCell(
    context: Context,
    cellWidth: Int,
    val site: MExploreSite,
    private val onSiteTap: (site: MExploreSite) -> Unit,
) :
    WView(
        context,
        LayoutParams(
            if (site.extendedIcon.isNotBlank()) cellWidth * 2 else cellWidth,
            cellWidth
        )
    ),
    WThemedView {

    private val imageView = WCustomImageView(context).apply {
        defaultRounding = Content.Rounding.Radius(16f.dp)
        set(
            Content.ofUrl(
                site.extendedIcon.ifBlank { site.icon ?: "" }
            )
        )
    }

    private val titleLabel = WLabel(context).apply {
        setStyle(15f, WFont.SemiBold)
        text = site.name
        maxLines = 1
    }

    private val subtitleLabel = WLabel(context).apply {
        setStyle(12f, WFont.Medium)
        text = site.description
        maxLines = 2
    }

    private val bottomView = WView(context).apply {
        setBackgroundColor(Color.BLACK, 0f, 16f.dp, true)

        addView(titleLabel, ViewGroup.LayoutParams(0, WRAP_CONTENT))
        addView(subtitleLabel, ViewGroup.LayoutParams(0, WRAP_CONTENT))

        setConstraints {
            toTop(titleLabel, 16f)
            toCenterX(titleLabel, 12f)
            bottomToTop(titleLabel, subtitleLabel, 5f)
            toCenterX(subtitleLabel, 12f)
            toBottom(subtitleLabel, 12f)
        }
    }

    private val bottomContainer = AlphaGradientLayout(context, 24.dp).apply {
        id = generateViewId()
        addView(bottomView, ViewGroup.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
    }

    private val badgeLabel: WLabel by lazy {
        WLabel(context).apply {
            setStyle(12f, WFont.Medium)
            setPadding(2.dp, 0, 2.dp, 2)
            text = site.badgeText
        }
    }

    private val contentView = WView(context).apply {
        addView(imageView, ViewGroup.LayoutParams(MATCH_PARENT, MATCH_PARENT))
        addView(bottomContainer, ViewGroup.LayoutParams(MATCH_PARENT, MATCH_CONSTRAINT))

        setConstraints {
            allEdges(imageView)
            toCenterX(bottomContainer)
            toBottom(bottomContainer)
        }
    }

    override fun setupViews() {
        super.setupViews()

        setPadding(10.dp, 0.dp, 0.dp, 16.dp)
        addView(contentView, LayoutParams(MATCH_PARENT, MATCH_PARENT))
        if (site.withBorder) {
            contentView.setPadding(1.dp, 1.dp, 1.dp, 1.dp)
        }
        if (site.badgeText.isNotBlank())
            addView(badgeLabel, LayoutParams(WRAP_CONTENT, WRAP_CONTENT))
        setConstraints {
            toTop(contentView, 3f)
            toBottom(contentView)
            toStart(contentView)
            toEnd(contentView, 6f)
            if (site.badgeText.isNotBlank()) {
                toEnd(badgeLabel, 3f)
                toTop(badgeLabel, 0f)
            }
        }

        contentView.setOnClickListener {
            onSiteTap(site)
        }

        updateTheme()
    }

    override fun updateTheme() {
        titleLabel.setTextColor(Color.WHITE)
        subtitleLabel.setTextColor(Color.WHITE.colorWithAlpha(153))
        if (site.withBorder) {
            val border = GradientDrawable()
            border.setColor(WColor.Tint.color)
            border.setStroke(1, WColor.Tint.color)
            border.cornerRadius = 16f.dp
            contentView.background = border
        }
        if (site.badgeText.isNotBlank()) {
            badgeLabel.setBackgroundColor(WColor.Tint.color, 4f.dp, true)
            badgeLabel.setTextColor(WColor.TextOnTint.color)
        }
    }
}
