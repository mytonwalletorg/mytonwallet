package org.mytonwallet.app_air.uireceive

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Shader
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.LinearLayout
import androidx.constraintlayout.widget.ConstraintLayout.LayoutParams
import org.mytonwallet.app_air.uicomponents.base.WNavigationBar
import org.mytonwallet.app_air.uicomponents.base.WViewController
import org.mytonwallet.app_air.uicomponents.extensions.dp
import org.mytonwallet.app_air.uicomponents.helpers.WFont
import org.mytonwallet.app_air.uicomponents.helpers.typeface
import org.mytonwallet.app_air.uicomponents.widgets.CopyTextView
import org.mytonwallet.app_air.uicomponents.widgets.WImageView
import org.mytonwallet.app_air.uicomponents.widgets.WLabel
import org.mytonwallet.app_air.uicomponents.widgets.WQRCodeView
import org.mytonwallet.app_air.uicomponents.widgets.WView
import org.mytonwallet.app_air.uicomponents.widgets.fadeIn
import org.mytonwallet.app_air.walletcontext.helpers.AddressHelpers
import org.mytonwallet.app_air.walletcontext.helpers.LocaleController
import org.mytonwallet.app_air.walletcontext.theme.WColor
import org.mytonwallet.app_air.walletcontext.theme.color
import org.mytonwallet.app_air.walletcore.models.MBlockchain
import org.mytonwallet.app_air.walletcore.stores.AccountStore

@SuppressLint("ViewConstructor")
class QRCodeVC(
    context: Context,
    val chain: MBlockchain,
) : WViewController(context) {

    override val shouldDisplayTopBar = false

    private val tonIcon = MBlockchain.ton.icon
    private val walletAddressTon = AccountStore.activeAccount?.tonAddress!!
    private val tronIcon = MBlockchain.tron.icon
    private val walletAddressTron = AccountStore.activeAccount?.tronAddress

    override var title: String?
        get() = when (chain) {
            MBlockchain.ton -> "TON"
            MBlockchain.tron -> "TRON"
            else -> ""
        }
        set(value) {}

    val walletAddress: String
        get() {
            return when (chain) {
                MBlockchain.ton -> walletAddressTon
                MBlockchain.tron -> walletAddressTron!!
                else -> ""
            }
        }
    internal val qrCodeView: WQRCodeView by lazy {
        val size = 252.dp
        val v = WQRCodeView(
            context,
            when (chain) {
                MBlockchain.ton -> AddressHelpers.walletInvoiceUrl(walletAddressTon)
                MBlockchain.tron -> walletAddressTron!!
                else -> ""
            },
            size,
            size,
            when (chain) {
                MBlockchain.ton -> tonIcon
                MBlockchain.tron -> tronIcon
                else -> 0
            },
            64.dp,
            chain.gradientColors?.let {
                LinearGradient(
                    0f, 0f, size.toFloat(), size.toFloat(),
                    it,
                    null,
                    Shader.TileMode.CLAMP
                )
            }
        ).apply {
            setPadding(1, 1, 1, 1)
            generate {
                view.fadeIn()
            }
        }
        v
    }

    val ornamentView = WImageView(context).apply {
        alpha = 0.5f
    }

    init {
        view.alpha = 0f
    }

    private val addressLabel = CopyTextView(context).apply {
        id = View.generateViewId()

        setLineHeight(TypedValue.COMPLEX_UNIT_SP, 22f)
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
        gravity = Gravity.LEFT
        typeface = WFont.Regular.typeface
        layoutParams = LinearLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT)

        includeFontPadding = false
        clipLabel = "Address"
        clipToast =
            LocaleController.getString(org.mytonwallet.app_air.walletcontext.R.string.Receive_AddressCopied)
        setText(walletAddress, walletAddress)
    }

    private val titleLabel: WLabel by lazy {
        val lbl = WLabel(context)
        lbl.setStyle(16f, WFont.Medium)
        lbl.text = LocaleController.getString(
            org.mytonwallet.app_air.walletcontext.R.string.Receive_YourAddress,
            listOf(title ?: "")
        )
        lbl
    }

    private val warningLabel: WLabel by lazy {
        val lbl = WLabel(context)
        lbl.setStyle(14f, WFont.Regular)
        lbl.text = when (chain) {
            MBlockchain.ton -> LocaleController.getString(
                org.mytonwallet.app_air.walletcontext.R.string.Receive_Warning_Ton
            )

            MBlockchain.tron -> LocaleController.getString(
                org.mytonwallet.app_air.walletcontext.R.string.Receive_Warning_Tron
            )

            else -> ""
        }
        lbl
    }

    val addressView = WView(context).apply {
        setPadding(20.dp, 16.dp, 20.dp, 16.dp)

        addView(titleLabel, LayoutParams(LayoutParams.MATCH_CONSTRAINT, LayoutParams.WRAP_CONTENT))
        addView(
            addressLabel,
            LayoutParams(LayoutParams.MATCH_CONSTRAINT, LayoutParams.WRAP_CONTENT)
        )
        addView(
            warningLabel,
            LayoutParams(LayoutParams.MATCH_CONSTRAINT, LayoutParams.WRAP_CONTENT)
        )

        setConstraints {
            toTop(titleLabel)
            toCenterX(titleLabel)
            topToBottom(addressLabel, titleLabel, 8f.dp)
            toCenterX(addressLabel)
            topToBottom(warningLabel, addressLabel, 8f.dp)
            toCenterX(warningLabel)
        }
    }

    override fun setupViews() {
        super.setupViews()

        view.addView(
            ornamentView,
            LayoutParams(LayoutParams.MATCH_CONSTRAINT, LayoutParams.MATCH_CONSTRAINT)
        )
        view.addView(
            qrCodeView,
            LayoutParams(230.dp, 230.dp)
        )
        view.addView(
            addressView,
            LayoutParams(LayoutParams.MATCH_CONSTRAINT, LayoutParams.WRAP_CONTENT)
        )

        view.setConstraints {
            toCenterX(qrCodeView)
            centerYToCenterY(ornamentView, qrCodeView, 16f.dp)
            toCenterX(ornamentView)
            topToBottom(addressView, qrCodeView, 40f)
            toCenterX(addressView)
        }

        updateTheme()
    }

    override fun updateTheme() {
        super.updateTheme()

        view.setBackgroundColor(Color.TRANSPARENT)
        view.setConstraints {
            toTopPx(
                qrCodeView, (navigationController?.getSystemBars()?.top ?: 0) +
                    WNavigationBar.DEFAULT_HEIGHT.dp + 16.dp
            )
        }
        addressLabel.setTextColor(WColor.PrimaryText.color)
        titleLabel.setTextColor(WColor.PrimaryText.color)
        warningLabel.setTextColor(WColor.SecondaryText.color)
        addressView.setBackgroundColor(WColor.Background.color)

        if (chain == MBlockchain.ton) {
            ornamentView.loadRes(R.drawable.receive_ornament_ton_light)
        } else if (chain == MBlockchain.tron) {
            ornamentView.loadRes(R.drawable.receive_ornament_tron_light)
        }
        ornamentView.hierarchy.actualImageScaleType =
            com.facebook.drawee.drawable.ScalingUtils.ScaleType.CENTER_INSIDE
    }

    fun getHeight(): Int {
        return (addressView.y + addressView.height).toInt()
    }

    fun getTransparentHeight(): Int {
        return 270.dp
    }

}
