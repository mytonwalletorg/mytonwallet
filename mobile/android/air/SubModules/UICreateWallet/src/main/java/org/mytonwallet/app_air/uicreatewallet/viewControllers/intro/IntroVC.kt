package org.mytonwallet.app_air.uicreatewallet.viewControllers.intro

import android.annotation.SuppressLint
import android.content.Context
import org.mytonwallet.app_air.ledger.screens.ledgerConnect.LedgerConnectVC
import org.mytonwallet.app_air.uicomponents.R
import org.mytonwallet.app_air.uicomponents.base.WViewController
import org.mytonwallet.app_air.uicomponents.commonViews.HeaderAndActionsView
import org.mytonwallet.app_air.uicreatewallet.viewControllers.importWallet.ImportWalletVC
import org.mytonwallet.app_air.uicreatewallet.viewControllers.walletCreated.WalletCreatedVC
import org.mytonwallet.app_air.uipasscode.viewControllers.passcodeConfirm.PasscodeConfirmVC
import org.mytonwallet.app_air.uipasscode.viewControllers.passcodeConfirm.PasscodeViewState
import org.mytonwallet.app_air.walletcontext.globalStorage.WGlobalStorage
import org.mytonwallet.app_air.walletcontext.helpers.LocaleController
import org.mytonwallet.app_air.walletcontext.theme.WColor
import org.mytonwallet.app_air.walletcontext.theme.color

@SuppressLint("ViewConstructor")
class IntroVC(
    context: Context,
    private val isFirstWallet: Boolean = true
) : WViewController(context), IntroVM.Delegate {
    private val introVM by lazy {
        IntroVM(this)
    }

    override val shouldDisplayTopBar = false

    private val centerView: HeaderAndActionsView by lazy {
        val v = HeaderAndActionsView(
            context,
            if (isFirstWallet) R.raw.animation_gem else null,
            if (isFirstWallet) null else org.mytonwallet.app_air.uisettings.R.drawable.ic_add,
            true,
            LocaleController.getString((if (isFirstWallet) org.mytonwallet.app_air.walletcontext.R.string.Intro_Title else org.mytonwallet.app_air.walletcontext.R.string.AddWallet_Title)),
            LocaleController.getString((if (isFirstWallet) org.mytonwallet.app_air.walletcontext.R.string.Intro_Text else org.mytonwallet.app_air.walletcontext.R.string.AddWallet_Text)),
            primaryActionTitle = LocaleController.getString(org.mytonwallet.app_air.walletcontext.R.string.Intro_CreateWallet),
            secondaryActionTitle = LocaleController.getString(org.mytonwallet.app_air.walletcontext.R.string.Intro_ImportExisting),
            trinaryActionTitle = LocaleController.getString(org.mytonwallet.app_air.walletcontext.R.string.Intro_ConnectLedger),
            primaryActionPressed = {
                view.lockView()
                centerView.primaryActionButton.isLoading = true
                introVM.createWallet()
            },
            secondaryActionPressed = {
                if (!WGlobalStorage.isPasscodeSet()) {
                    push(
                        ImportWalletVC(
                            context,
                            passedPasscode = null
                        )
                    )
                } else {
                    val passcodeConfirmVC = PasscodeConfirmVC(
                        context,
                        PasscodeViewState.Default(
                            LocaleController.getString(org.mytonwallet.app_air.walletcontext.R.string.Unlock_Wallet),
                            "",
                            LocaleController.getString(org.mytonwallet.app_air.walletcontext.R.string.Intro_ImportExisting),
                            showNavigationSeparator = false,
                            startWithBiometrics = true
                        ),
                        task = { passcode ->
                            navigationController?.push(
                                ImportWalletVC(context, passcode),
                                onCompletion = {
                                    navigationController?.removePrevViewControllerOnly()
                                })
                        }
                    )
                    push(passcodeConfirmVC)
                }
            },
            trinaryActionPressed = {
                push(LedgerConnectVC(context, LedgerConnectVC.Mode.AddAccount))
            },
            headerPadding = if (isFirstWallet) 0f else 14f
        )
        v
    }

    override fun setupViews() {
        super.setupViews()

        if (!isFirstWallet) {
            setupNavBar(true)
            navigationBar?.addCloseButton()
        } else {
            setTopBlur(visible = false, animated = false)
        }

        // Add center view
        view.addView(centerView)

        // Apply constraints to center the view
        view.setConstraints {
            allEdges(centerView)
        }

        updateTheme()
    }

    override fun updateTheme() {
        super.updateTheme()
        view.setBackgroundColor(WColor.Background.color)
    }

    override fun mnemonicGenerated(words: Array<String>) {
        view.unlockView()
        centerView.primaryActionButton.isLoading = false
        if (!WGlobalStorage.isPasscodeSet()) {
            push(WalletCreatedVC(context, words = words, true, null))
        } else {
            val passcodeConfirmVC = PasscodeConfirmVC(
                context,
                PasscodeViewState.Default(
                    LocaleController.getString(org.mytonwallet.app_air.walletcontext.R.string.Unlock_Wallet),
                    "",
                    LocaleController.getString(org.mytonwallet.app_air.walletcontext.R.string.Intro_CreateWallet),
                    showNavigationSeparator = false,
                    startWithBiometrics = true
                ),
                task = { passcode ->
                    navigationController?.push(
                        WalletCreatedVC(context, words = words, false, passcode),
                        onCompletion = {
                            navigationController?.removePrevViewControllerOnly()
                        })
                }
            )
            push(passcodeConfirmVC)
        }
    }
}
