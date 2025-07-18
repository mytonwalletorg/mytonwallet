package org.mytonwallet.app_air.uisend.send

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.os.Build
import android.text.Editable
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.TextPaint
import android.text.TextWatcher
import android.text.method.LinkMovementMethod
import android.text.style.ClickableSpan
import android.util.TypedValue
import android.view.View
import android.view.ViewGroup
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.ScrollView
import androidx.appcompat.widget.AppCompatEditText
import androidx.constraintlayout.widget.ConstraintLayout
import androidx.core.content.ContextCompat
import androidx.core.net.toUri
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import org.mytonwallet.app_air.sqscan.screen.QrScannerDialog
import org.mytonwallet.app_air.uicomponents.adapter.implementation.holders.ListTitleCell
import org.mytonwallet.app_air.uicomponents.base.WNavigationBar
import org.mytonwallet.app_air.uicomponents.base.WViewControllerWithModelStore
import org.mytonwallet.app_air.uicomponents.base.showAlert
import org.mytonwallet.app_air.uicomponents.commonViews.TokenAmountInputView
import org.mytonwallet.app_air.uicomponents.commonViews.feeDetailsDialog.FeeDetailsDialog
import org.mytonwallet.app_air.uicomponents.drawable.SeparatorBackgroundDrawable
import org.mytonwallet.app_air.uicomponents.extensions.collectFlow
import org.mytonwallet.app_air.uicomponents.extensions.dp
import org.mytonwallet.app_air.uicomponents.extensions.setPaddingDp
import org.mytonwallet.app_air.uicomponents.extensions.updateDotsTypeface
import org.mytonwallet.app_air.uicomponents.helpers.DieselAuthorizationHelpers
import org.mytonwallet.app_air.uicomponents.helpers.WFont
import org.mytonwallet.app_air.uicomponents.helpers.typeface
import org.mytonwallet.app_air.uicomponents.viewControllers.SendTokenVC
import org.mytonwallet.app_air.uicomponents.widgets.WButton
import org.mytonwallet.app_air.uicomponents.widgets.WView
import org.mytonwallet.app_air.uicomponents.widgets.dialog.WDialog
import org.mytonwallet.app_air.uicomponents.widgets.hideKeyboard
import org.mytonwallet.app_air.uicomponents.widgets.menu.WMenuPopup
import org.mytonwallet.app_air.uicomponents.widgets.setBackgroundColor
import org.mytonwallet.app_air.uisend.send.lauouts.AddressInputLayout
import org.mytonwallet.app_air.uisend.sent.SentVC
import org.mytonwallet.app_air.walletcontext.R
import org.mytonwallet.app_air.walletcontext.helpers.LocaleController
import org.mytonwallet.app_air.walletcontext.theme.ThemeManager
import org.mytonwallet.app_air.walletcontext.theme.ViewConstants
import org.mytonwallet.app_air.walletcontext.theme.WColor
import org.mytonwallet.app_air.walletcontext.theme.color
import org.mytonwallet.app_air.walletcontext.utils.CoinUtils
import org.mytonwallet.app_air.walletcontext.utils.VerticalImageSpan
import org.mytonwallet.app_air.walletcontext.utils.formatStartEndAddress
import org.mytonwallet.app_air.walletcore.JSWebViewBridge
import org.mytonwallet.app_air.walletcore.PRICELESS_TOKEN_HASHES
import org.mytonwallet.app_air.walletcore.STAKED_MYCOIN_SLUG
import org.mytonwallet.app_air.walletcore.STAKED_USDE_SLUG
import org.mytonwallet.app_air.walletcore.STAKE_SLUG
import org.mytonwallet.app_air.walletcore.TONCOIN_SLUG
import org.mytonwallet.app_air.walletcore.deeplink.Deeplink
import org.mytonwallet.app_air.walletcore.deeplink.DeeplinkParser
import org.mytonwallet.app_air.walletcore.stores.AccountStore
import org.mytonwallet.app_air.walletcore.stores.TokenStore
import java.math.BigInteger
import kotlin.math.max

@SuppressLint("ViewConstructor")
class SendStartInputVC(
    context: Context,
    private val initialTokenSlug: String? = null,
    private val initialValues: InitialValues? = null,
) : WViewControllerWithModelStore(context) {
    private val viewModel by lazy { ViewModelProvider(this)[SendViewModel::class.java] }

    data class InitialValues(val address: String?, val amount: String?, val comment: String?)

    private val topGapView = View(context).apply {
        id = View.generateViewId()
    }

    private val title1 = ListTitleCell(context).apply {
        id = View.generateViewId()
        text = LocaleController.getString(R.string.SendTo_SendTo)
    }

    private val amountInputView by lazy {
        TokenAmountInputView(context).apply {
            id = View.generateViewId()
        }
    }
    private val addressInputView by lazy {
        AddressInputLayout(context).apply {
            id = View.generateViewId()
        }
    }

    private val title2 = ListTitleCell(context).apply {
        id = View.generateViewId()
        movementMethod = LinkMovementMethod.getInstance()
        highlightColor = Color.TRANSPARENT
    }

    private val commentInputView by lazy {
        AppCompatEditText(context).apply {
            id = View.generateViewId()
            background = null
            hint = LocaleController.getString(R.string.SendTo_AddMessageIfNeeded)
            typeface = WFont.Regular.typeface
            layoutParams =
                ViewGroup.LayoutParams(MATCH_PARENT, WRAP_CONTENT)
            setPaddingDp(20, 8, 20, 20)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                setLineHeight(TypedValue.COMPLEX_UNIT_SP, 24f)
            }
        }
    }
    private val contentLayout by lazy {
        WView(context).apply {
            addView(
                topGapView,
                ConstraintLayout.LayoutParams(
                    MATCH_PARENT,
                    (navigationController?.getSystemBars()?.top ?: 0) +
                        WNavigationBar.DEFAULT_HEIGHT.dp
                )
            )
            addView(title1)
            addView(
                addressInputView,
                ConstraintLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT)
            )
            addView(
                amountInputView,
                ConstraintLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT)
            )
            addView(title2)
            addView(
                commentInputView,
                ConstraintLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT)
            )
            setConstraints {
                toTop(topGapView)
                topToBottom(title1, topGapView)
                topToBottom(addressInputView, title1)
                topToBottom(amountInputView, addressInputView, ViewConstants.GAP.toFloat())
                topToBottom(title2, amountInputView, ViewConstants.GAP.toFloat())
                topToBottom(commentInputView, title2)
                toBottom(commentInputView)
            }
        }
    }

    private val scrollView by lazy {
        ScrollView(context).apply {
            addView(
                contentLayout,
                ViewGroup.LayoutParams(MATCH_PARENT, WRAP_CONTENT)
            )
            id = View.generateViewId()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                setOnScrollChangeListener { _, _, scrollY, _, _ ->
                    updateBlurViews(scrollView = this, computedOffset = scrollY)
                }
            }
            overScrollMode = ScrollView.OVER_SCROLL_ALWAYS
        }
    }

    private val continueButton by lazy {
        WButton(context).apply {
            id = View.generateViewId()
        }
    }

    private val onInputCommentTextWatcher = object : TextWatcher {
        override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
        override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
            viewModel.onInputComment(s?.toString() ?: "")
        }

        override fun afterTextChanged(s: Editable?) {}
    }

    private val onInputDestinationTextWatcher = object : TextWatcher {
        override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
        override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
            viewModel.onInputDestination(s?.toString() ?: "")
        }

        override fun afterTextChanged(s: Editable?) {}
    }

    private val onAmountTextWatcher = object : TextWatcher {
        override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
        override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
            viewModel.onInputAmount(s?.toString() ?: "")
        }

        override fun afterTextChanged(s: Editable?) {}
    }

    override fun setupViews() {
        super.setupViews()
        setNavTitle(LocaleController.getString(R.string.Home_Send))
        setupNavBar(true)
        navigationBar?.addCloseButton()

        view.addView(scrollView, ViewGroup.LayoutParams(MATCH_PARENT, 0))
        view.addView(continueButton, ViewGroup.LayoutParams(MATCH_PARENT, 50.dp))
        view.setConstraints {
            toCenterX(scrollView)
            toTop(scrollView)
            bottomToTop(scrollView, continueButton, 20f)
            toCenterX(continueButton, 20f)
            toBottomPx(
                continueButton, 20.dp + max(
                    (navigationController?.getSystemBars()?.bottom ?: 0),
                    (window?.imeInsets?.bottom ?: 0)
                )
            )
        }

        initialTokenSlug?.let {
            viewModel.onInputToken(it)
            showServiceTokenWarningIfRequired()
        }

        continueButton.setOnClickListener {
            if (viewModel.shouldAuthorizeDiesel()) {
                DieselAuthorizationHelpers.authorizeDiesel(context)
                return@setOnClickListener
            }
            viewModel.getConfirmationPageConfig()?.let { config ->
                val vc = SendConfirmVC(
                    context,
                    config,
                    viewModel.getTransferOptions(config, ""),
                    viewModel.getTokenSlug()
                )
                vc.setNextTask { passcode ->
                    lifecycleScope.launch {
                        if (AccountStore.activeAccount?.isHardware == true) {
                            // Sent using LedgerConnect
                            push(
                                SentVC(
                                    context,
                                    LocaleController.getString(R.string.SendComplete_Title),
                                    "-${config.request.amountEquivalent.getFmt(false)}",
                                    SpannableStringBuilder(
                                        config.request.amountEquivalent.getFmt(
                                            true
                                        )
                                    ),
                                    SpannableStringBuilder(
                                        LocaleController.getString(
                                            R.string.SendComplete_Message, listOf(
                                                config.resolvedAddress?.formatStartEndAddress()
                                                    ?: ""
                                            )
                                        )
                                    ).apply {
                                        updateDotsTypeface()
                                    }
                                ),
                                onCompletion = { navigationController?.removePrevViewControllers() })
                        } else {
                            // Send with passcode
                            try {
                                viewModel.callSend(config, passcode!!)
                                push(
                                    SentVC(
                                        context,
                                        LocaleController.getString(R.string.SendComplete_Title),
                                        "-${config.request.amountEquivalent.getFmt(false)}",
                                        SpannableStringBuilder(
                                            config.request.amountEquivalent.getFmt(
                                                true
                                            )
                                        ),
                                        SpannableStringBuilder(
                                            LocaleController.getString(
                                                R.string.SendComplete_Message, listOf(
                                                    config.resolvedAddress?.formatStartEndAddress()
                                                        ?: ""
                                                )
                                            )
                                        ).apply {
                                            updateDotsTypeface()
                                        }
                                    ),
                                    onCompletion = { navigationController?.removePrevViewControllers() })
                            } catch (e: JSWebViewBridge.ApiError) {
                                navigationController?.viewControllers[navigationController!!.viewControllers.size - 2]?.showError(
                                    e.parsed
                                )
                                navigationController?.pop(true)
                            }
                        }
                    }
                }
                view.hideKeyboard()
                push(vc)
            }
        }

        addressInputView.editTextView.addTextChangedListener(onInputDestinationTextWatcher)
        addressInputView.qrScanImageView.setOnClickListener {
            QrScannerDialog.build(context) {
                val deeplink = DeeplinkParser.parse(it.toUri())
                addressInputView.editTextView.setText(
                    if (deeplink is Deeplink.Invoice) deeplink.address else it
                )
            }.show()
        }

        commentInputView.addTextChangedListener(onInputCommentTextWatcher)

        amountInputView.doOnMaxButtonClick(viewModel::onInputMaxButton)
        amountInputView.doOnEquivalentButtonClick(viewModel::onInputToggleFiatMode)
        amountInputView.doOnFeeButtonClick {
            lateinit var dialogRef: WDialog
            dialogRef = FeeDetailsDialog.create(
                context,
                TokenStore.getToken(viewModel.inputStateFlow.value.tokenSlug)!!,
                viewModel.getConfirmationPageConfig()!!.explainedFee!!
            ) {
                dialogRef.dismiss()
            }
            dialogRef.presentOn(this)
        }
        amountInputView.amountEditText.addTextChangedListener(onAmountTextWatcher)
        amountInputView.tokenSelectorView.setOnClickListener {
            push(SendTokenVC(context).apply {
                setOnAssetSelectListener {
                    viewModel.onInputToken(it.slug)
                    showServiceTokenWarningIfRequired()
                }
            })
        }

        collectFlow(viewModel.inputStateFlow) {
            if (amountInputView.amountEditText.text.toString() != it.amount) {
                amountInputView.amountEditText.setText(it.amount)
            }
        }

        collectFlow(viewModel.uiStateFlow) {
            amountInputView.set(
                it.uiInput,
                (viewModel.getConfirmationPageConfig()?.explainedFee?.excessFee
                    ?: BigInteger.ZERO) > BigInteger.ZERO
            )
            continueButton.isLoading = it.uiButton.status.isLoading
            if (!it.uiButton.status.isLoading) {
                continueButton.isEnabled = it.uiButton.status.isEnabled
                continueButton.isError = it.uiButton.status.isError
                continueButton.text = it.uiButton.title
            }
        }

        updateTheme()
        setInitialValues()
    }

    override fun updateTheme() {
        super.updateTheme()
        view.setBackgroundColor(WColor.SecondaryBackground.color)
        title1.setBackgroundColor(WColor.Background.color, ViewConstants.TOP_RADIUS.dp, 0f)
        title2.setBackgroundColor(
            WColor.Background.color,
            ViewConstants.BIG_RADIUS.dp,
            0f,
        )
        if (ThemeManager.uiMode.hasRoundedCorners) {
            addressInputView.setBackgroundColor(
                WColor.Background.color,
                0f,
                ViewConstants.BIG_RADIUS.dp
            )
            commentInputView.setBackgroundColor(
                WColor.Background.color,
                0f,
                ViewConstants.BIG_RADIUS.dp
            )
        } else {
            addressInputView.background = SeparatorBackgroundDrawable().apply {
                backgroundWColor = WColor.Background
            }
            commentInputView.background = SeparatorBackgroundDrawable().apply {
                backgroundWColor = WColor.Background
            }
        }
        commentInputView.setTextColor(WColor.PrimaryText.color)
        commentInputView.setHintTextColor(WColor.SecondaryText.color)

        updateCommentTitleLabel()
    }

    private fun updateCommentTitleLabel() {
        title2.apply {
            if (AccountStore.activeAccount?.supportsCommentEncryption == false) {
                text = LocaleController.getString(R.string.SendTo_CommentOrMemo)
                return@apply
            }
            val txt =
                LocaleController.getString(if (viewModel.getShouldEncrypt()) R.string.SendTo_EncryptedComment else R.string.SendTo_CommentOrMemo) + " "
            val ss = SpannableStringBuilder(txt)
            ContextCompat.getDrawable(
                context,
                org.mytonwallet.app_air.icons.R.drawable.ic_arrow_bottom_8
            )?.let { drawable ->
                drawable.mutate()
                drawable.setTint(WColor.PrimaryText.color)
                val width = 8.dp
                val height = 4.dp
                drawable.setBounds(0, 0, width, height)
                val imageSpan = VerticalImageSpan(drawable)
                ss.append(" ", imageSpan, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            }
            val clickableSpan: ClickableSpan = object : ClickableSpan() {
                override fun onClick(textView: View) {
                    WMenuPopup.present(
                        this@apply,
                        listOf(
                            WMenuPopup.Item(
                                null,
                                LocaleController.getString(R.string.SendTo_CommentOrMemo),
                                false,
                            ) {
                                viewModel.onShouldEncrypt(false)
                                updateCommentTitleLabel()
                            },
                            WMenuPopup.Item(
                                null,
                                LocaleController.getString(R.string.SendTo_EncryptedComment),
                                false,
                            ) {
                                viewModel.onShouldEncrypt(true)
                                updateCommentTitleLabel()
                            }),
                        offset = 20.dp,
                        popupWidth = 180.dp,
                        aboveView = false
                    )
                }

                override fun updateDrawState(ds: TextPaint) {
                    super.updateDrawState(ds)
                    ds.setColor(WColor.PrimaryText.color);
                    ds.isUnderlineText = false
                }
            }
            ss.setSpan(clickableSpan, 0, txt.length + 1, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            text = ss
        }
    }

    private fun setInitialValues() {
        initialValues?.let {
            it.address?.let { address ->
                addressInputView.editTextView.setText(address)
            }
            it.amount?.let { amountBigDecimalString ->
                val token = TokenStore.getToken(initialTokenSlug ?: TONCOIN_SLUG)
                token?.let {
                    CoinUtils.fromDecimal(amountBigDecimalString, token.decimals)
                        ?.let { amountBigInt ->
                            val amountToSet = CoinUtils.toBigDecimal(
                                amountBigInt,
                                token.decimals
                            ).stripTrailingZeros().toPlainString()
                            viewModel.onInputAmount(amountToSet)
                        }
                }
            }
            it.comment?.let { comment ->
                commentInputView.setText(comment)
            }
        }
    }

    override fun insetsUpdated() {
        super.insetsUpdated()
        scrollView.setPadding(
            ViewConstants.HORIZONTAL_PADDINGS.dp,
            0,
            ViewConstants.HORIZONTAL_PADDINGS.dp,
            0
        )
        view.setConstraints {
            toBottomPx(
                continueButton, 20.dp + max(
                    (navigationController?.getSystemBars()?.bottom ?: 0),
                    (window?.imeInsets?.bottom ?: 0)
                )
            )
        }
    }

    private fun showServiceTokenWarningIfRequired() {
        val token = TokenStore.getToken(viewModel.inputStateFlow.value.tokenSlug)
        if (token?.isLpToken == true ||
            listOf(
                STAKE_SLUG,
                STAKED_MYCOIN_SLUG,
                STAKED_USDE_SLUG
            ).contains(viewModel.inputStateFlow.value.tokenSlug) ||
            PRICELESS_TOKEN_HASHES.contains(viewModel.inputStateFlow.value.tokenCodeHash)
        )
            showAlert(
                LocaleController.getString(R.string.SendAmount_Warning),
                LocaleController.getString(R.string.SendAmount_SendingImportantToken),
                primaryIsDanger = true
            )
    }

    override fun onDestroy() {
        super.onDestroy()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            scrollView.setOnScrollChangeListener(null)
        }
        addressInputView.qrScanImageView.setOnClickListener(null)
        addressInputView.editTextView.removeTextChangedListener(onInputDestinationTextWatcher)
        amountInputView.tokenSelectorView.setOnClickListener(null)
        amountInputView.doOnEquivalentButtonClick(null)
        amountInputView.doOnFeeButtonClick(null)
        amountInputView.doOnMaxButtonClick(null)
        amountInputView.amountEditText.removeTextChangedListener(onAmountTextWatcher)
        commentInputView.removeTextChangedListener(onInputCommentTextWatcher)
        continueButton.setOnClickListener(null)
    }
}
