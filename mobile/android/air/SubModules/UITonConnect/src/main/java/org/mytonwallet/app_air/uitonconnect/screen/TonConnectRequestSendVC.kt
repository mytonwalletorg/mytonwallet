package org.mytonwallet.app_air.uitonconnect.screen

import android.annotation.SuppressLint
import android.content.Context
import android.view.View
import android.view.ViewGroup
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import androidx.lifecycle.ViewModelProvider
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import org.mytonwallet.app_air.ledger.screens.ledgerConnect.LedgerConnectVC
import org.mytonwallet.app_air.uicomponents.adapter.BaseListItem
import org.mytonwallet.app_air.uicomponents.adapter.implementation.CustomListAdapter
import org.mytonwallet.app_air.uicomponents.adapter.implementation.CustomListDecorator
import org.mytonwallet.app_air.uicomponents.base.WNavigationBar
import org.mytonwallet.app_air.uicomponents.base.WViewControllerWithModelStore
import org.mytonwallet.app_air.uicomponents.extensions.collectFlow
import org.mytonwallet.app_air.uicomponents.extensions.dp
import org.mytonwallet.app_air.uicomponents.widgets.WButton
import org.mytonwallet.app_air.uipasscode.viewControllers.passcodeConfirm.PasscodeConfirmVC
import org.mytonwallet.app_air.uipasscode.viewControllers.passcodeConfirm.PasscodeViewState
import org.mytonwallet.app_air.walletcontext.R
import org.mytonwallet.app_air.walletcontext.helpers.LocaleController
import org.mytonwallet.app_air.walletcontext.theme.ViewConstants
import org.mytonwallet.app_air.walletcontext.theme.WColor
import org.mytonwallet.app_air.walletcontext.theme.color
import org.mytonwallet.app_air.walletcore.moshi.api.ApiUpdate
import org.mytonwallet.app_air.walletcore.stores.AccountStore
import kotlin.math.max

@SuppressLint("ViewConstructor")
class TonConnectRequestSendVC(
    context: Context,
    private val update: ApiUpdate.ApiUpdateDappSendTransactions
) : WViewControllerWithModelStore(context), CustomListAdapter.ItemClickListener {

    override val shouldDisplayTopBar = true

    private val viewModel by lazy {
        ViewModelProvider(
            this,
            TonConnectRequestSendViewModel.Factory(update)
        )[TonConnectRequestSendViewModel::class.java]
    }

    private val confirmButtonView: WButton = WButton(context, WButton.Type.PRIMARY).apply {
        layoutParams = ViewGroup.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT)
        text = LocaleController.getString(R.string.DApp_Send_Confirm)
    }
    private val cancelButtonView: WButton =
        WButton(context, WButton.Type.Secondary(withBackground = true)).apply {
            layoutParams = ViewGroup.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT)
            text = LocaleController.getString(R.string.DApp_Send_Cancel)
        }
    private val rvAdapter = org.mytonwallet.app_air.uitonconnect.adapter.Adapter()

    private val recyclerView = RecyclerView(context).apply {
        id = View.generateViewId()
        adapter = rvAdapter
        addItemDecoration(CustomListDecorator())
        val layoutManager = LinearLayoutManager(context)
        layoutManager.isSmoothScrollbarEnabled = true
        setLayoutManager(layoutManager)
    }

    override fun setupViews() {
        super.setupViews()
        rvAdapter.setOnItemClickListener(this)

        setupNavBar(true)
        navigationBar?.addCloseButton()
        recyclerView.setPadding(
            ViewConstants.HORIZONTAL_PADDINGS.dp,
            (navigationController?.getSystemBars()?.top ?: 0) +
                WNavigationBar.DEFAULT_HEIGHT.dp,
            ViewConstants.HORIZONTAL_PADDINGS.dp,
            0
        )

        view.addView(recyclerView, ViewGroup.LayoutParams(MATCH_PARENT, MATCH_PARENT))
        view.addView(cancelButtonView)
        view.addView(confirmButtonView)

        view.setConstraints {
            toLeft(cancelButtonView, 20f)
            toRight(confirmButtonView, 20f)

            leftToRight(confirmButtonView, cancelButtonView, 6f)
            rightToLeft(cancelButtonView, confirmButtonView, 6f)
        }

        cancelButtonView.setOnClickListener {
            viewModel.cancel(update.promiseId, null)
        }

        confirmButtonView.setOnClickListener {
            if (AccountStore.activeAccount?.isHardware == true) {
                confirmHardware()
            } else {
                confirmPasscode()
            }
        }

        collectFlow(viewModel.eventsFlow, ::onEvent)
        collectFlow(viewModel.uiItemsFlow, rvAdapter::submitList)
        collectFlow(viewModel.uiStateFlow) {
            cancelButtonView.isLoading = it.cancelButtonIsLoading
        }

        updateTheme()
        insetsUpdated()
    }

    private fun onEvent(event: TonConnectRequestSendViewModel.Event) {
        when (event) {
            is TonConnectRequestSendViewModel.Event.Close -> pop()
            is TonConnectRequestSendViewModel.Event.Complete -> {
                val success = event.success
                navigationController?.window?.dismissLastNav()
                // todo show something
            }
        }
    }

    override fun updateTheme() {
        super.updateTheme()
        view.setBackgroundColor(WColor.SecondaryBackground.color)
    }

    override fun onItemClickItems(
        view: View,
        position: Int,
        item: BaseListItem,
        items: List<BaseListItem>
    ) {
        push(TonConnectRequestSendDetailsVC(context, items))
    }

    override fun insetsUpdated() {
        super.insetsUpdated()
        val ime = (window?.imeInsets?.bottom ?: 0)
        val nav = (navigationController?.getSystemBars()?.bottom ?: 0)

        view.setConstraints {
            toBottomPx(recyclerView, 90.dp + max(ime, nav))
            toBottomPx(cancelButtonView, 20.dp + max(ime, nav))
            toBottomPx(confirmButtonView, 20.dp + max(ime, nav))
        }
    }

    private fun confirmHardware() {
        val account = AccountStore.activeAccount!!
        val ledger = account.ledger ?: return
        val ledgerConnectVC = LedgerConnectVC(
            context,
            LedgerConnectVC.Mode.ConnectToSubmitTransfer(
                ledger.index,
                account.tonAddress!!,
                signData = LedgerConnectVC.SignData.SignDappTransfers(update),
                onDone = {
                    viewModel.notifyDone(true)
                }),
            headerView = confirmHeaderView
        )
        navigationController?.push(ledgerConnectVC)
    }

    private fun confirmPasscode() {
        val confirmActionVC = PasscodeConfirmVC(
            context,
            PasscodeViewState.CustomHeader(
                confirmHeaderView,
                showNavbarTitle = false
            ), task = { passcode ->
                viewModel.accept(update.promiseId, passcode)
            })
        push(confirmActionVC)
    }

    private val confirmHeaderView: View
        get() {
            return org.mytonwallet.app_air.uitonconnect.adapter.holder.CellHeaderSendRequest(
                context
            ).apply { configure(update.dapp) }
        }
}
