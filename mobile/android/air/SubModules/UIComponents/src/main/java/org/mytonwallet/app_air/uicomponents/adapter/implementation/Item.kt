package org.mytonwallet.app_air.uicomponents.adapter.implementation

import org.mytonwallet.app_air.uicomponents.adapter.BaseListItem
import org.mytonwallet.app_air.uicomponents.image.Content
import org.mytonwallet.app_air.walletcore.moshi.MApiSwapAsset

open class Item(
    type: Int,
    key: String? = null
) : BaseListItem(type, key) {
    enum class Type {
        LIST_TITLE,
        ICON_DUAL_LINE,
        ADDRESS,
        EXPANDABLE_TEXT,
        GAP;

        val value: Int
            get() = -1 - this.ordinal
    }

    data class IconDualLine(
        val image: Content?,
        val title: CharSequence?,
        val subtitle: CharSequence?,
        val allowSeparator: Boolean = false,
        val id: String? = null,
        val isSensitiveData: Boolean = false,
        override val clickable: Clickable? = null
    ) : Item(Type.ICON_DUAL_LINE.value, id), IClickable

    data class ListTitle(
        val title: String
    ) : Item(Type.LIST_TITLE.value, title)

    data class ExpandableText(
        val text: String
    ) : Item(Type.EXPANDABLE_TEXT.value, text)

    data class Address(
        val address: String,
    ) : Item(Type.ADDRESS.value)

    data object Gap : Item(Type.GAP.value)

    interface IClickable {
        val clickable: Clickable?
    }

    sealed class Clickable {
        data class Token(val token: MApiSwapAsset) : Clickable()
        data class Items(val items: List<BaseListItem>) : Clickable()
        data class Index(val index: Int) : Clickable()
    }
}
