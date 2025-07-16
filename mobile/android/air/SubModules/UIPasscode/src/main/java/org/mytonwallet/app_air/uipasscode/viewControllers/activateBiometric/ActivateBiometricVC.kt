package org.mytonwallet.app_air.uipasscode.viewControllers.activateBiometric

import android.annotation.SuppressLint
import android.content.Context
import org.mytonwallet.app_air.uicomponents.base.WViewController
import org.mytonwallet.app_air.uicomponents.commonViews.HeaderAndActionsView
import org.mytonwallet.app_air.uipasscode.R
import org.mytonwallet.app_air.walletcontext.helpers.BiometricHelpers
import org.mytonwallet.app_air.walletcontext.helpers.LocaleController
import org.mytonwallet.app_air.walletcontext.theme.WColor
import org.mytonwallet.app_air.walletcontext.theme.color
import org.mytonwallet.app_air.walletcore.models.MBridgeError

@SuppressLint("ViewConstructor")
class ActivateBiometricVC(context: Context, onCompletion: (activated: Boolean) -> Unit) :
    WViewController(context) {

    override val shouldDisplayTopBar = false

    private val centerView: HeaderAndActionsView by lazy {
        val v = HeaderAndActionsView(
            context,
            null,
            R.drawable.ic_fingerprint,
            false,
            LocaleController.getString(org.mytonwallet.app_air.walletcontext.R.string.Biometric_Authentication),
            LocaleController.getString(org.mytonwallet.app_air.walletcontext.R.string.Biometric_Reason),
            LocaleController.getString(org.mytonwallet.app_air.walletcontext.R.string.Biometric_Enable),
            LocaleController.getString(org.mytonwallet.app_air.walletcontext.R.string.Biometric_Skip),
            primaryActionPressed = {
                BiometricHelpers.authenticate(
                    window!!,
                    LocaleController.getString(org.mytonwallet.app_air.walletcontext.R.string.Biometric_Authentication),
                    subtitle = null,
                    description = null,
                    cancel = null,
                    onSuccess = {
                        centerView.primaryActionButton.isLoading = true
                        view.lockView()
                        onCompletion(true)
                    },
                    onCanceled = {}
                )
            },
            secondaryActionPressed = {
                centerView.secondaryActionButton.isLoading = true
                view.lockView()
                onCompletion(false)
            }
        )
        v
    }

    override fun setupViews() {
        super.setupViews()

        setupNavBar(true)
        setTopBlur(visible = false, animated = false)

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

    override fun showError(error: MBridgeError?) {
        super.showError(error)
        centerView.primaryActionButton.isLoading = false
        centerView.secondaryActionButton.isLoading = false
        view.unlockView()
    }
}
