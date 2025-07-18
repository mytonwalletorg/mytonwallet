package org.mytonwallet.app_air.walletcontext.helpers

import android.graphics.Typeface
import android.text.Spannable
import android.text.SpannableStringBuilder
import android.text.style.StyleSpan
import androidx.annotation.StringRes

object LocaleController {
    fun getString(@StringRes res: Int): String {
        return ApplicationContextHolder.applicationContext.getString(res)
    }

    fun getString(@StringRes res: Int, values: List<String>): String {
        var result = getString(res)
        values.forEachIndexed { index, value ->
            result = result.replace("%${index + 1}\$@", value)
        }
        return result
    }

    fun getStringBold(@StringRes res: Int, values: List<String>): SpannableStringBuilder {
        val builder = SpannableStringBuilder()

        getString(res).split(Regex("%\\d+\\$@")).forEachIndexed { index, str ->
            builder.append(str)
            if (values.size > index) {
                val start = builder.length
                builder.append(values[index])
                builder.setSpan(
                    StyleSpan(Typeface.BOLD),
                    start,
                    builder.length,
                    Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
                )
            }
        }

        return builder
    }

    fun getStringSpannable(@StringRes res: Int, values: List<CharSequence>): CharSequence {
        var result = SpannableStringBuilder(getString(res))
        values.forEachIndexed { index, value ->
            val toReplace = "%${index + 1}\$@"
            val i = result.indexOf(toReplace)
            if (i != -1) {
                result = result.replace(i, i + toReplace.length, value)
            }
        }
        return result
    }
}
