package org.mytonwallet.app_air.uicomponents.widgets

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.drawable.LayerDrawable
import android.text.InputType
import android.view.View.OnFocusChangeListener
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.view.inputmethod.EditorInfo
import androidx.appcompat.widget.AppCompatImageView
import androidx.core.view.isVisible
import androidx.core.widget.doOnTextChanged
import org.mytonwallet.app_air.uicomponents.extensions.dp
import org.mytonwallet.app_air.uicomponents.widgets.WEditText.Delegate
import org.mytonwallet.app_air.walletbasecontext.localization.LocaleController
import org.mytonwallet.app_air.walletbasecontext.theme.WColor
import org.mytonwallet.app_air.walletbasecontext.theme.color
import org.mytonwallet.app_air.walletbasecontext.utils.getDrawableCompat
import org.mytonwallet.app_air.walletcore.constants.PossibleWords
import org.mytonwallet.app_air.walletcore.helpers.PrivateKeyHelper
import org.mytonwallet.app_air.walletcore.helpers.findMnemonicMatches

@SuppressLint("SetTextI18n", "ViewConstructor")
class WWordInput(context: Context, number: Int, val delegate: Delegate) :
    WView(context, LayoutParams(0, 48.dp)),
    WThemedView {

    private val numberLabel: WLabel by lazy {
        val label = WLabel(context)
        label.text = "$number"
        label.textAlignment = TEXT_ALIGNMENT_CENTER
        label.setStyle(17F)
        label
    }

    var onFocusChanged: ((hasFocus: Boolean) -> Unit)? = null

    private val clearCircle = context.getDrawableCompat(
        org.mytonwallet.app_air.icons.R.drawable.ic_clear_24_circle
    )?.mutate()

    private val clearButton: AppCompatImageView by lazy {
        AppCompatImageView(context).apply {
            id = generateViewId()
            setImageDrawable(
                LayerDrawable(
                    listOfNotNull(
                        clearCircle,
                        context.getDrawableCompat(
                            org.mytonwallet.app_air.icons.R.drawable.ic_clear_24_cross
                        )
                    ).toTypedArray()
                )
            )
            setPadding(10.dp, 10.dp, 10.dp, 10.dp)
            contentDescription = LocaleController.getString("Clear")
            isVisible = false
            setOnClickListener { textField.setText("") }
        }
    }

    private var textFieldIsLocked = false
    val textField: WEditText by lazy {
        val textField = WEditText(context, delegate = delegate, multilinePaste = true)
        textField.setStyle(17F)
        textField.setSingleLine(true)
        textField.setMaxLines(1)
        textField.setImeOptions(EditorInfo.IME_ACTION_NEXT)
        textField.inputType =
            InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS or
            InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD
        textField.isAutoFillSupported = false

        textField.onFocusChangeListener = OnFocusChangeListener { _, hasFocus ->
            updateClearButton()
            onFocusChanged?.invoke(hasFocus)
        }
        textField.doOnTextChanged { _, _, _, _ ->
            updateClearButton()
            if (textFieldIsLocked) return@doOnTextChanged

            val currentText = textField.text?.toString().orEmpty()
            val normalizedText = currentText.lowercase()
            if (currentText == normalizedText) {
                return@doOnTextChanged
            }

            val currentSelection = textField.selectionStart
            textFieldIsLocked = true
            textField.setText(normalizedText)
            textField.setSelection(currentSelection)
            textFieldIsLocked = false
        }
        textField
    }

    override fun setupViews() {
        super.setupViews()

        addView(numberLabel)
        numberLabel.minWidth = 24.dp

        addView(textField, LayoutParams(0, WRAP_CONTENT))
        addView(clearButton, LayoutParams(44.dp, 44.dp))

        setConstraints {
            toStart(numberLabel, 20f)
            toCenterY(numberLabel)
            startToEnd(textField, numberLabel, 4f)
            endToStart(textField, clearButton)
            toCenterY(textField)
            toEnd(clearButton, 2f)
            toCenterY(clearButton)
        }

        setOnClickListener {
            textField.requestFocus()
            textField.showKeyboard()
        }

        updateTheme()
    }

    override fun updateTheme() {
        numberLabel.setTextColor(WColor.SecondaryText.color)
        clearCircle?.setTint(WColor.SecondaryText.color)
        setBackgroundColor(WColor.Background.color, 24f.dp)
    }

    private fun updateClearButton() {
        clearButton.isVisible = textField.hasFocus() && !textField.text.isNullOrEmpty()
    }

    fun checkValue() {
        val inputValue = textField.text.toString().trim().lowercase()
        if (PrivateKeyHelper.isValidPrivateKeyHex(inputValue)) {
            textField.textIsAcceptable = true
            return
        }
        if (inputValue.isNotEmpty() &&
            !PossibleWords.All.contains(
                inputValue
            )
        ) {
            val suggestion = PossibleWords.All.findMnemonicMatches(inputValue).firstOrNull()
            if (suggestion != null) {
                textField.setText(suggestion)
                textField.textIsAcceptable = true
            } else {
                textField.textIsAcceptable = false
            }
        } else {
            textField.textIsAcceptable = true
        }
    }
}
