package org.mytonwallet.app_air.uicomponents.widgets.suggestion

import android.annotation.SuppressLint
import android.content.Context
import android.text.TextWatcher
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import androidx.core.view.updateLayoutParams
import androidx.core.widget.addTextChangedListener
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import java.lang.ref.WeakReference
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.mytonwallet.app_air.uicomponents.base.WRecyclerViewAdapter
import org.mytonwallet.app_air.uicomponents.extensions.dp
import org.mytonwallet.app_air.uicomponents.widgets.WCell
import org.mytonwallet.app_air.uicomponents.widgets.WRecyclerView
import org.mytonwallet.app_air.uicomponents.widgets.WThemedView
import org.mytonwallet.app_air.uicomponents.widgets.WView
import org.mytonwallet.app_air.uicomponents.widgets.WWordInput
import org.mytonwallet.app_air.uicomponents.widgets.setBackgroundColor
import org.mytonwallet.app_air.walletbasecontext.theme.WColor
import org.mytonwallet.app_air.walletbasecontext.theme.color
import org.mytonwallet.app_air.walletcontext.utils.IndexPath
import org.mytonwallet.app_air.walletcore.constants.PossibleWords
import org.mytonwallet.app_air.walletcore.helpers.findMnemonicMatches

@SuppressLint("ViewConstructor")
class WSuggestionView(context: Context, val onSuggest: (String) -> Unit) :
    WView(context),
    WRecyclerViewAdapter.WRecyclerViewDataSource,
    WThemedView {

    companion object {
        val SUGGEST_CELL = WCell.Type(1)
        private const val MAX_VISIBLE_SUGGESTIONS = 4
        private const val CARD_MARGIN = 8f
    }

    private val rvAdapter = WRecyclerViewAdapter(WeakReference(this), arrayOf(SUGGEST_CELL))
    private val coroutineScope = CoroutineScope(Dispatchers.Main)
    private var textWatcher: TextWatcher? = null
    private var attachedInput: WeakReference<WWordInput>? = null
    private var currentFilterJob: Job? = null

    private val cardView: WView by lazy {
        WView(context).apply {
            elevation = 4f.dp
        }
    }

    private val recyclerView: WRecyclerView by lazy {
        val rv = WRecyclerView(context)
        rv.adapter = rvAdapter
        val layoutManager = LinearLayoutManager(context, LinearLayoutManager.HORIZONTAL, false)
        layoutManager.isSmoothScrollbarEnabled = true
        rv.setLayoutManager(layoutManager)
        rv.setPaddingRelative(6.dp, 0, 6.dp, 0)
        rv.clipToPadding = false
        rv
    }

    override fun setupViews() {
        super.setupViews()

        visibility = INVISIBLE
        addView(cardView, LayoutParams(0, 0))
        cardView.addView(recyclerView, LayoutParams(0, MATCH_PARENT))
        setConstraints {
            toCenterX(cardView, CARD_MARGIN)
            toTop(cardView, CARD_MARGIN)
            toBottom(cardView, CARD_MARGIN)
        }
        cardView.setConstraints { allEdges(recyclerView) }

        updateTheme()
    }

    override fun updateTheme() {
        cardView.setBackgroundColor(
            WColor.Background.color,
            20f.dp,
            true
        )

        recyclerView.background = null
    }

    fun attachToWordInput(input: WWordInput?) {
        attachedInput?.get()?.textField?.removeTextChangedListener(textWatcher)

        textWatcher = null
        attachedInput = null

        if (input == null) {
            visibility = INVISIBLE
            currentFilterJob?.cancel()
            suggestions = emptyList()
            rvAdapter.reloadData()
            return
        }

        attachedInput = WeakReference(input)
        updateSuggestions(input.textField.text.toString())

        textWatcher = input.textField.addTextChangedListener(onTextChanged = { text, _, _, _ ->
            updateSuggestions(text?.toString().orEmpty())
        })
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        currentFilterJob?.cancel()
        currentFilterJob = null
        attachedInput?.get()?.textField?.removeTextChangedListener(textWatcher)
        attachedInput = null
        textWatcher = null
    }

    private fun updateSuggestions(keyword: String) {
        currentFilterJob?.cancel()

        if (keyword.isEmpty()) {
            suggestions = emptyList()
            rvAdapter.reloadData()
            visibility = INVISIBLE
            return
        }

        currentFilterJob = coroutineScope.launch {
            val filteredSuggestions = withContext(Dispatchers.IO) {
                PossibleWords.All.findMnemonicMatches(keyword)
            }

            if (attachedInput?.get()?.textField?.text?.toString() != keyword) {
                return@launch
            }

            suggestions = filteredSuggestions
            val contentWidth = if (suggestions.size == 1) WRAP_CONTENT else 0
            cardView.updateLayoutParams { width = contentWidth }
            recyclerView.updateLayoutParams { width = contentWidth }
            rvAdapter.reloadData()

            val shouldShow =
                suggestions.isNotEmpty() && (suggestions.size > 1 || keyword != suggestions[0])
            visibility = if (shouldShow) VISIBLE else INVISIBLE

            if (shouldShow) {
                recyclerView.post {
                    if (rvAdapter.itemCount > 0) recyclerView.scrollToPosition(0)
                }
            }
        }
    }

    private var suggestions = emptyList<String>()

    override fun recyclerViewNumberOfSections(rv: RecyclerView): Int = 1

    override fun recyclerViewNumberOfItems(rv: RecyclerView, section: Int): Int = suggestions.size

    override fun recyclerViewCellType(rv: RecyclerView, indexPath: IndexPath): WCell.Type =
        SUGGEST_CELL

    override fun recyclerViewCellView(rv: RecyclerView, cellType: WCell.Type): WCell {
        val cell = WSuggestionCell(context)
        cell.onTap = { it ->
            onSuggest(it)
        }
        return cell
    }

    override fun recyclerViewConfigureCell(
        rv: RecyclerView,
        cellHolder: WCell.Holder,
        indexPath: IndexPath
    ) {
        val cell = cellHolder.cell as WSuggestionCell
        val cellMinWidth = if (suggestions.size == 1) {
            0
        } else {
            val contentWidth = width - 2 * CARD_MARGIN.dp.toInt() -
                recyclerView.paddingStart - recyclerView.paddingEnd
            contentWidth / suggestions.size.coerceAtMost(MAX_VISIBLE_SUGGESTIONS)
        }
        cell.configure(suggestions[indexPath.row], indexPath.row == 0, cellMinWidth)
    }
}
