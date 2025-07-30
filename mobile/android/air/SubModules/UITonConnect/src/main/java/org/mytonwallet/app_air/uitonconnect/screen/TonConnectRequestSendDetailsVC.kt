package org.mytonwallet.app_air.uitonconnect.screen

import android.annotation.SuppressLint
import android.content.Context
import android.view.View
import android.view.ViewGroup
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import org.mytonwallet.app_air.uicomponents.adapter.BaseListItem
import org.mytonwallet.app_air.uicomponents.adapter.implementation.CustomListDecorator
import org.mytonwallet.app_air.uicomponents.base.WViewController
import org.mytonwallet.app_air.walletcontext.R
import org.mytonwallet.app_air.walletcontext.helpers.LocaleController
import org.mytonwallet.app_air.walletcontext.theme.ViewConstants
import org.mytonwallet.app_air.walletcontext.theme.WColor
import org.mytonwallet.app_air.walletcontext.theme.color
import kotlin.math.max

@SuppressLint("ViewConstructor")
class TonConnectRequestSendDetailsVC(
    context: Context,
    private val items: List<BaseListItem>
) : WViewController(context) {
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

        setupNavBar(true)
        setNavTitle(LocaleController.getString(R.string.TransactionInfo_TransactionDetails), false)

        navigationBar?.addCloseButton()

        view.addView(recyclerView, ViewGroup.LayoutParams(MATCH_PARENT, 0))
        view.setConstraints {
            toCenterX(recyclerView, ViewConstants.HORIZONTAL_PADDINGS.toFloat())
            topToBottom(recyclerView, navigationBar!!)
            toBottom(recyclerView)
        }

        rvAdapter.submitList(items)
        updateTheme()
        insetsUpdated()
    }

    override fun updateTheme() {
        super.updateTheme()
        view.setBackgroundColor(WColor.SecondaryBackground.color)
    }

    override fun insetsUpdated() {
        super.insetsUpdated()
        val ime = (window?.imeInsets?.bottom ?: 0)
        val nav = (navigationController?.getSystemBars()?.bottom ?: 0)

        view.setConstraints({
            toBottomPx(recyclerView, max(ime, nav))
        })
    }
}
