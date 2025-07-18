package org.mytonwallet.app_air.uicomponents.commonViews

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.drawable.Drawable
import android.graphics.drawable.GradientDrawable
import androidx.annotation.DrawableRes
import androidx.core.content.ContextCompat
import androidx.core.graphics.toColorInt
import androidx.core.view.setPadding
import com.facebook.drawee.drawable.ScalingUtils
import org.mytonwallet.app_air.uicomponents.R
import org.mytonwallet.app_air.uicomponents.extensions.GradientDrawables
import org.mytonwallet.app_air.uicomponents.extensions.dp
import org.mytonwallet.app_air.uicomponents.image.Content
import org.mytonwallet.app_air.uicomponents.image.WCustomImageView
import org.mytonwallet.app_air.uicomponents.widgets.WView
import org.mytonwallet.app_air.walletcontext.models.MRecentAddress
import org.mytonwallet.app_air.walletcontext.theme.ThemeManager
import org.mytonwallet.app_air.walletcontext.utils.gradientColors
import org.mytonwallet.app_air.walletcore.STAKE_SLUG
import org.mytonwallet.app_air.walletcore.TONCOIN_SLUG
import org.mytonwallet.app_air.walletcore.models.MAccount
import org.mytonwallet.app_air.walletcore.models.MToken
import org.mytonwallet.app_air.walletcore.models.MTokenBalance
import org.mytonwallet.app_air.walletcore.moshi.ApiSwapStatus
import org.mytonwallet.app_air.walletcore.moshi.ApiTransactionType
import org.mytonwallet.app_air.walletcore.moshi.MApiTransaction
import org.mytonwallet.app_air.walletcore.stores.TokenStore

@Deprecated("use WCustomImageView")
@SuppressLint("ViewConstructor")
class IconView(
    context: Context,
    val viewSize: Int = 48.dp,
    val chainSize: Int = 16.dp,
) : WView(context) {

    private val imageView: WCustomImageView by lazy {
        WCustomImageView(context).apply {
            chainSize = this@IconView.chainSize
        }
    }

    private val gradientDrawableCache = mutableMapOf<String, GradientDrawable>()
    private val transactionGradientCache = mutableMapOf<ApiTransactionType?, GradientDrawable>()
    private val swapGradientCache = mutableMapOf<MApiTransaction.UIStatus, GradientDrawable>()

    init {
        isFocusable = false
        isClickable = false

        addView(imageView, LayoutParams(viewSize, viewSize))

        setConstraints {
            toTop(imageView)
            toStart(imageView)
            toBottom(imageView)
        }

        updateTheme()
    }

    fun setSize(size: Int) {
        imageView.layoutParams.apply {
            width = size
            height = size
        }

        requestLayout()
    }

    fun updateTheme() {
    }

    fun config(account: MAccount, padding: Int = 10.dp) {
        val address = account.firstAddress ?: ""
        imageView.background = getCachedGradientDrawable(address.gradientColors)

        imageView.setPadding(padding)
        imageView.setImageDrawable(ContextCompat.getDrawable(context, R.drawable.ic_address))
    }

    fun config(transaction: MApiTransaction.Transaction) {
        val iconRes = transaction.type?.getIcon() ?: if (transaction.isIncoming) {
            org.mytonwallet.app_air.walletcontext.R.drawable.ic_act_received
        } else {
            org.mytonwallet.app_air.walletcontext.R.drawable.ic_act_sent
        }

        val subImageRes = if (transaction.isLocal()) {
            if (ThemeManager.isDark) {
                org.mytonwallet.app_air.walletcontext.R.drawable.ic_act_timer_dark
            } else {
                org.mytonwallet.app_air.walletcontext.R.drawable.ic_act_timer
            }
        } else 0

        imageView.set(
            Content(
                image = Content.Image.Res(iconRes),
                subImageRes = subImageRes,
                scaleType = ScalingUtils.ScaleType.FIT_X
            )
        )

        imageView.setPadding(viewSize / 4)
        imageView.background = getCachedTransactionGradientDrawable(transaction)
    }

    fun config(swap: MApiTransaction.Swap) {
        val subImageRes = if (swap.status == ApiSwapStatus.PENDING) {
            if (ThemeManager.isDark) {
                org.mytonwallet.app_air.walletcontext.R.drawable.ic_act_timer_dark
            } else {
                org.mytonwallet.app_air.walletcontext.R.drawable.ic_act_timer
            }
        } else 0

        imageView.set(
            Content(
                image = Content.Image.Res(
                    org.mytonwallet.app_air.walletcontext.R.drawable.ic_act_swap
                ),
                subImageRes = subImageRes
            )
        )

        imageView.setPadding(viewSize / 4)
        imageView.background = getCachedSwapGradientDrawable(swap)
    }

    fun config(
        walletToken: MTokenBalance,
        alwaysShowChain: Boolean = false,
        showPercentBadge: Boolean = false
    ) {
        imageView.setPadding(0)
        val token = TokenStore.getToken(walletToken.token)

        if (token != null) {
            val correctTokenToShow =
                if (token.slug == STAKE_SLUG)
                    TokenStore.getToken(TONCOIN_SLUG) ?: token else token
            imageView.set(Content.of(correctTokenToShow, alwaysShowChain, showPercentBadge))
        } else {
            imageView.clear()
        }
    }

    fun config(token: MToken?, alwaysShowChain: Boolean = true) {
        if (token != null) {
            imageView.set(Content.of(token, alwaysShowChain))
        } else {
            imageView.clear()
        }
    }

    fun config(address: MRecentAddress) {
        imageView.background = getCachedGradientDrawable(address.address.gradientColors)

        if (address.addressAlias.isNotEmpty()) {
            imageView.setImageDrawable(null)
        } else {
            imageView.setPadding(12.dp)
            imageView.setImageDrawable(
                ContextCompat.getDrawable(context, R.drawable.ic_address)
            )
        }
    }

    fun config(
        @DrawableRes iconDrawableRes: Int?,
        gradientStartColor: String?,
        gradientEndColor: String?,
    ) {
        imageView.setPadding(17.dp)

        iconDrawableRes?.let { res ->
            imageView.setImageDrawable(ContextCompat.getDrawable(context, res))
        }

        val startColor = gradientStartColor?.toColorInt() ?: 0
        val endColor = gradientEndColor?.toColorInt() ?: 0
        imageView.background = getCachedGradientDrawable(intArrayOf(startColor, endColor))
    }

    fun setImageDrawable(drawable: Drawable?, padding: Int = 0) {
        imageView.setPadding(padding)
        imageView.setImageDrawable(drawable)
        imageView.background = null
    }

    private fun getCachedGradientDrawable(colors: IntArray): GradientDrawable {
        val key = colors.contentHashCode().toString()
        return gradientDrawableCache.getOrPut(key) {
            GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, colors).apply {
                shape = GradientDrawable.OVAL
            }
        }
    }

    private fun getCachedTransactionGradientDrawable(transaction: MApiTransaction.Transaction): GradientDrawable {
        return transactionGradientCache.getOrPut(transaction.type) {
            getTransactionGradientDrawable(transaction.type, transaction.isIncoming)
        }
    }

    private fun getCachedSwapGradientDrawable(swap: MApiTransaction.Swap): GradientDrawable {
        val uiStatus = swap.cex?.status?.uiStatus ?: swap.status.uiStatus
        return swapGradientCache.getOrPut(uiStatus) {
            getSwapGradientDrawable(uiStatus)
        }
    }

    private fun getTransactionGradientDrawable(
        type: ApiTransactionType?,
        isIncoming: Boolean
    ): GradientDrawable {
        return when (type) {
            ApiTransactionType.STAKE -> GradientDrawables.purpleDrawable

            ApiTransactionType.UNSTAKE,
            ApiTransactionType.LIQUIDITY_WITHDRAW,
            ApiTransactionType.MINT,
            ApiTransactionType.EXCESS,
            ApiTransactionType.BOUNCED -> GradientDrawables.greenDrawable

            ApiTransactionType.CONTRACT_DEPLOY,
            ApiTransactionType.CALL_CONTRACT,
            ApiTransactionType.DNS_CHANGE_ADDRESS,
            ApiTransactionType.DNS_CHANGE_SITE,
            ApiTransactionType.DNS_CHANGE_SUBDOMAINS,
            ApiTransactionType.DNS_CHANGE_STORAGE,
            ApiTransactionType.DNS_DELETE,
            ApiTransactionType.DNS_RENEW -> GradientDrawables.grayDrawable

            ApiTransactionType.BURN -> GradientDrawables.redDrawable

            ApiTransactionType.UNSTAKE_REQUEST,
            ApiTransactionType.LIQUIDITY_DEPOSIT,
            ApiTransactionType.AUCTION_BID,
            ApiTransactionType.NFT_TRADE -> GradientDrawables.blueDrawable

            null -> if (isIncoming) {
                GradientDrawables.greenDrawable
            } else {
                GradientDrawables.blueDrawable
            }
        }
    }

    private fun getSwapGradientDrawable(uiStatus: MApiTransaction.UIStatus): GradientDrawable {
        return when (uiStatus) {
            MApiTransaction.UIStatus.HOLD -> GradientDrawables.grayDrawable
            MApiTransaction.UIStatus.PENDING,
            MApiTransaction.UIStatus.COMPLETED -> GradientDrawables.blueDrawable

            MApiTransaction.UIStatus.EXPIRED,
            MApiTransaction.UIStatus.FAILED -> GradientDrawables.redDrawable
        }
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        gradientDrawableCache.clear()
        transactionGradientCache.clear()
        swapGradientCache.clear()
    }
}
