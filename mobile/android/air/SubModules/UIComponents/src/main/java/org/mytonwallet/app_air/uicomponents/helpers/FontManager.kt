package org.mytonwallet.app_air.uicomponents.helpers

import android.content.Context
import android.graphics.Typeface
import androidx.core.content.res.ResourcesCompat
import org.mytonwallet.app_air.uicomponents.R
import org.mytonwallet.app_air.walletcontext.globalStorage.WGlobalStorage

enum class WFont {
    Regular,
    Medium,
    Bold,
    SemiBold,

    NunitoSemiBold,
    NunitoExtraBold
}

enum class FontFamily(val familyName: String, val displayName: String) {
    ROBOTO("roboto", "Roboto"),
    OPENSANS("opensans", "Open Sans"),
    NOTOSANS("notosans", "Noto Sans"),
    NUNITOSANS("nunitosans", "Nunito Sans"),
    MISANS("misans", "Mi Sans");

    companion object {
        fun fromFamilyName(familyName: String?): FontFamily {
            return entries.firstOrNull { it.familyName == familyName } ?: MISANS
        }
    }
}

val WFont.typeface: Typeface
    get() {
        return when (this) {
            WFont.NunitoSemiBold -> FontManager.nunitoSemiBold
            WFont.NunitoExtraBold -> FontManager.nunitoExtraBold

            WFont.Regular -> FontManager.regular
            WFont.Medium -> FontManager.medium
            WFont.SemiBold -> FontManager.semiBold
            WFont.Bold -> FontManager.bold
        }
    }

object FontManager {
    lateinit var regular: Typeface
    lateinit var medium: Typeface
    lateinit var semiBold: Typeface
    lateinit var bold: Typeface

    lateinit var nunitoSemiBold: Typeface
    lateinit var nunitoExtraBold: Typeface

    fun init(context: Context) {
        val activeFont = FontFamily.fromFamilyName(WGlobalStorage.getActiveFont())

        when (activeFont) {
            FontFamily.ROBOTO -> {
                regular = ResourcesCompat.getFont(context, R.font.roboto_regular)!!
                medium = ResourcesCompat.getFont(context, R.font.roboto_medium)!!
                semiBold = ResourcesCompat.getFont(context, R.font.roboto_semi_bold)!!
                bold = ResourcesCompat.getFont(context, R.font.roboto_bold)!!
            }

            FontFamily.OPENSANS -> {
                regular = ResourcesCompat.getFont(context, R.font.opensans_regular)!!
                medium = ResourcesCompat.getFont(context, R.font.opensans_medium)!!
                semiBold = ResourcesCompat.getFont(context, R.font.opensans_semi_bold)!!
                bold = ResourcesCompat.getFont(context, R.font.opensans_bold)!!
            }

            FontFamily.NOTOSANS -> {
                regular = ResourcesCompat.getFont(context, R.font.notosans_regular)!!
                medium = ResourcesCompat.getFont(context, R.font.notosans_medium)!!
                semiBold = ResourcesCompat.getFont(context, R.font.notosans_semibold)!!
                bold = ResourcesCompat.getFont(context, R.font.notosans_bold)!!
            }

            FontFamily.NUNITOSANS -> {
                regular = ResourcesCompat.getFont(context, R.font.nunitosans_regular)!!
                medium = ResourcesCompat.getFont(context, R.font.nunitosans_medium)!!
                semiBold = ResourcesCompat.getFont(context, R.font.nunitosans_semibold)!!
                bold = ResourcesCompat.getFont(context, R.font.nunitosans_bold)!!
            }

            FontFamily.MISANS -> {
                regular = ResourcesCompat.getFont(context, R.font.misans_regular)!!
                medium = ResourcesCompat.getFont(context, R.font.misans_medium)!!
                semiBold = ResourcesCompat.getFont(context, R.font.misans_semibold)!!
                bold = ResourcesCompat.getFont(context, R.font.misans_bold)!!
            }

            else -> {
                // Default to Mi Sans if unknown font
                regular = ResourcesCompat.getFont(context, R.font.misans_regular)!!
                medium = ResourcesCompat.getFont(context, R.font.misans_medium)!!
                semiBold = ResourcesCompat.getFont(context, R.font.misans_semibold)!!
                bold = ResourcesCompat.getFont(context, R.font.misans_bold)!!
            }
        }

        nunitoSemiBold = ResourcesCompat.getFont(context, R.font.nunito_semi_bold)!!
        nunitoExtraBold = ResourcesCompat.getFont(context, R.font.nunito_extra_bold)!!
    }
}
