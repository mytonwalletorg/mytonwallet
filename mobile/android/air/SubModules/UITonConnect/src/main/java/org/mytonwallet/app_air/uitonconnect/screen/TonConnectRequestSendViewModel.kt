package org.mytonwallet.app_air.uitonconnect.screen

import android.text.SpannableStringBuilder
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import org.mytonwallet.app_air.uicomponents.adapter.BaseListItem
import org.mytonwallet.app_air.uicomponents.adapter.implementation.Item
import org.mytonwallet.app_air.uicomponents.extensions.dp
import org.mytonwallet.app_air.uicomponents.extensions.updateDotsTypeface
import org.mytonwallet.app_air.uicomponents.helpers.FakeLoading
import org.mytonwallet.app_air.uicomponents.helpers.spans.WForegroundColorSpan
import org.mytonwallet.app_air.uicomponents.image.Content
import org.mytonwallet.app_air.uitonconnect.adapter.TonConnectItem
import org.mytonwallet.app_air.walletcontext.R
import org.mytonwallet.app_air.walletcontext.helpers.LocaleController
import org.mytonwallet.app_air.walletcontext.theme.WColor
import org.mytonwallet.app_air.walletcontext.utils.CoinUtils
import org.mytonwallet.app_air.walletcontext.utils.formatStartEndAddress
import org.mytonwallet.app_air.walletcontext.utils.smartDecimalsCount
import org.mytonwallet.app_air.walletcontext.utils.toString
import org.mytonwallet.app_air.walletcore.JSWebViewBridge
import org.mytonwallet.app_air.walletcore.TONCOIN_SLUG
import org.mytonwallet.app_air.walletcore.WalletCore
import org.mytonwallet.app_air.walletcore.helpers.DappFeeHelpers
import org.mytonwallet.app_air.walletcore.models.MBaseCurrency
import org.mytonwallet.app_air.walletcore.models.MBlockchain
import org.mytonwallet.app_air.walletcore.moshi.ApiDappTransfer
import org.mytonwallet.app_air.walletcore.moshi.ApiParsedPayload
import org.mytonwallet.app_air.walletcore.moshi.ApiTokenWithPrice
import org.mytonwallet.app_air.walletcore.moshi.api.ApiMethod
import org.mytonwallet.app_air.walletcore.moshi.api.ApiUpdate
import org.mytonwallet.app_air.walletcore.stores.TokenStore
import org.mytonwallet.app_air.walletcore.toAmountString
import java.math.BigDecimal
import java.math.BigInteger

class TonConnectRequestSendViewModel private constructor(
    private val update: ApiUpdate.ApiUpdateDappSendTransactions
) : ViewModel() {
    private val transactionTokenSlugs =
        update.transactions.map { it.payload?.payloadTokenSlug ?: "toncoin" }
    private val tokensMapFlow = TokenStore.tokensFlow.map { tokens ->
        Tokens(
            currency = tokens?.baseCurrency ?: MBaseCurrency.USD,
            tokens = tokens?.tokens,
            list = transactionTokenSlugs.map {
                val t = tokens?.tokens?.get(it)
                Token(
                    slug = it,
                    token = t,
                    isUnknown = t == null && !tokens?.tokens.isNullOrEmpty()
                )
            }
        )

    }.distinctUntilChanged()
    val uiItemsFlow = tokensMapFlow.map(this::buildUiItems)

    private data class Tokens(
        val currency: MBaseCurrency,
        val tokens: Map<String, ApiTokenWithPrice>?,
        val list: List<Token>
    )

    private data class Token(
        val slug: String,
        val token: ApiTokenWithPrice?,
        val isUnknown: Boolean,
    ) {
        val icon = token?.let { Content.of(it) }
            ?: (if (slug == "toncoin" || isUnknown) Content.chain(MBlockchain.ton) else null)
    }

    data class UiState(
        val cancelButtonIsLoading: Boolean
    ) {
        val isLocked = cancelButtonIsLoading
    }


    private val _uiStateFlow = MutableStateFlow(UiState(cancelButtonIsLoading = false))
    val uiStateFlow = _uiStateFlow.asStateFlow()


    fun cancel(promiseId: String, reason: String?) {
        assert(promiseId)
        if (_uiStateFlow.value.isLocked) {
            return
        }

        _uiStateFlow.value = _uiStateFlow.value.copy(cancelButtonIsLoading = true)
        viewModelScope.launch {
            val t = FakeLoading.init()
            try {
                WalletCore.call(
                    ApiMethod.DApp.CancelDappRequest(
                        promiseId = update.promiseId,
                        reason = reason
                    )
                )
                FakeLoading.start(500, t)
            } catch (_: JSWebViewBridge.ApiError) {
                // todo: show error
            }
            _eventsFlow.tryEmit(Event.Close)
            _uiStateFlow.value = _uiStateFlow.value.copy(cancelButtonIsLoading = false)
        }
    }

    fun accept(promiseId: String, password: String) {
        assert(promiseId)
        if (_uiStateFlow.value.isLocked) {
            return
        }

        viewModelScope.launch {
            try {
                WalletCore.call(
                    ApiMethod.DApp.ConfirmDappRequest(
                        promiseId = update.promiseId,
                        password = password
                    )
                )
                notifyDone(true)
            } catch (_: JSWebViewBridge.ApiError) {
                notifyDone(false)
            }
        }
    }

    fun notifyDone(success: Boolean) {
        _eventsFlow.tryEmit(Event.Complete(success))
    }

    private fun assert(promiseId: String) {
        if (update.promiseId != promiseId) {
            // Theoretically unreachable code. Just for safety.
            throw IllegalStateException("PromiseId do not match")
        }
    }

    sealed class Event {
        data object Close : Event()
        data class Complete(
            val success: Boolean
        ) : Event()
    }

    private val _eventsFlow =
        MutableSharedFlow<Event>(replay = 1, onBufferOverflow = BufferOverflow.DROP_OLDEST)
    val eventsFlow = _eventsFlow.asSharedFlow()

    private fun buildUiItems(tokens: Tokens): List<BaseListItem> {
        val uiItems = mutableListOf(
            TonConnectItem.SendRequestHeader(update.dapp),
            Item.Gap
        )

        if (update.transactions.size == 1) {
            uiItems.addAll(
                buildUiItemsSingleTransaction(
                    //update,
                    update.transactions[0],
                    tokens,
                    0
                )
            )
        } else {
            uiItems.addAll(buildUiItemsListTransactions(update, tokens))
        }

        return uiItems
    }


    @Suppress("UNCHECKED_CAST")
    class Factory(private val update: ApiUpdate.ApiUpdateDappSendTransactions) :
        ViewModelProvider.Factory {
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            if (modelClass.isAssignableFrom(TonConnectRequestSendViewModel::class.java)) {
                return TonConnectRequestSendViewModel(update) as T
            }
            throw IllegalArgumentException("Unknown ViewModel class")
        }
    }

    companion object {
        private fun buildUiItemsListTransactions(
            update: ApiUpdate.ApiUpdateDappSendTransactions,
            tokens: Tokens
        ): List<BaseListItem> {
            val uiItems = mutableListOf<BaseListItem>()
            uiItems.add(
                Item.ListTitle(
                    LocaleController.getString(
                        R.string.DApp_Send_TransactionsX, listOf(
                            update.transactions.size.toString()
                        )
                    )
                )
            )

            var price = BigDecimal.ZERO

            for (a in 0..<update.transactions.size) {
                val transaction = update.transactions[a]
                val token = tokens.list[a]
                val nativeToken = tokens.tokens?.get(token.token?.mBlockchain?.nativeSlug)
                val tokenIcon = token.icon
                val tokenToShow = if (token.isUnknown) {
                    TokenStore.swapAssetsMap?.get("toncoin")
                } else {
                    token.token
                }
                val payload = transaction.payload

                val receivingAddress = when (payload) {
                    is ApiParsedPayload.ApiTokensTransferPayload -> payload.destination
                    is ApiParsedPayload.ApiTokensTransferNonStandardPayload -> payload.destination
                    is ApiParsedPayload.ApiTokensBurnPayload -> payload.address
                    is ApiParsedPayload.ApiNftTransferPayload -> payload.newOwner
                    else -> transaction.toAddress
                }

                val amount = if (payload?.payloadIsToken == true && !token.isUnknown) {
                    transaction.payload?.payloadTokenAmount ?: BigInteger.ZERO
                } else transaction.amount

                val fee = if (payload?.payloadIsToken == true && !token.isUnknown) {
                    transaction.amount
                } else BigInteger.ZERO

                token.token?.let { t ->
                    price += amount.toBigDecimal(t.decimals) * BigDecimal.valueOf(
                        t.price ?: 0.0
                    )
                }
                nativeToken?.let { t ->
                    price += fee.toBigDecimal(t.decimals) * BigDecimal.valueOf(
                        t.price ?: 0.0
                    )
                }

                val subtitle = SpannableStringBuilder(
                    LocaleController.getString(
                        R.string.DApp_Send_ToX, listOf(
                            receivingAddress.formatStartEndAddress()
                        )
                    )
                ).apply {
                    updateDotsTypeface()
                }
                if (fee > BigInteger.ZERO) {
                    subtitle.append(" (")
                    subtitle.append(
                        DappFeeHelpers.calculateDappTransferFee(
                            transaction.networkFee,
                            BigInteger.ZERO
                        ),
                    )
                    subtitle.append(')')
                }

                uiItems.add(
                    Item.IconDualLine(
                        image = tokenIcon,
                        title = tokenToShow?.let {
                            CoinUtils.setSpanToSymbolPart(
                                SpannableStringBuilder(amount.toAmountString(it)),
                                WForegroundColorSpan(WColor.SecondaryText)
                            )
                        },
                        subtitle = subtitle,
                        clickable = Item.Clickable.Items(
                            buildUiItemsSingleTransaction(
                                //update,
                                transaction,
                                tokens,
                                a
                            )
                        )
                    )
                )
            }
            uiItems.addAll(
                listOf(
                    Item.Gap
                )
            )


            val totalCurrencyFmt = SpannableStringBuilder(
                CoinUtils.fromDecimal(price, tokens.currency.decimalsCount)?.let {
                    it.toString(
                        currency = tokens.currency.currencySymbol,
                        decimals = tokens.currency.decimalsCount,
                        currencyDecimals = it.smartDecimalsCount(tokens.currency.decimalsCount),
                        showPositiveSign = false
                    )
                } ?: "")
            CoinUtils.setSpanToSymbolPart(
                totalCurrencyFmt,
                WForegroundColorSpan(WColor.SecondaryText)
            )

            uiItems.addAll(
                listOf(
                    Item.ListTitle(
                        LocaleController.getString(
                            R.string.DApp_AppTotalAmountInX,
                            listOf(tokens.currency.currencySymbol)
                        )
                    ),
                    TonConnectItem.CurrencyAmount(totalCurrencyFmt)
                )
            )


            return uiItems
        }

        private fun buildUiItemsSingleTransaction(
            transaction: ApiDappTransfer,
            tokens: Tokens,
            index: Int
        ): List<BaseListItem> {
            val token = tokens.list[index]
            val uiItems = mutableListOf<BaseListItem>()
            val tokenIcon = token.icon
            val tokenToShow = if (token.isUnknown) {
                TokenStore.swapAssetsMap?.get(TONCOIN_SLUG)
            } else {
                token.token
            }

            val payload = transaction.payload
            val receivingAddress = when (payload) {
                is ApiParsedPayload.ApiTokensTransferPayload -> payload.destination
                is ApiParsedPayload.ApiTokensTransferNonStandardPayload -> payload.destination
                is ApiParsedPayload.ApiTokensBurnPayload -> payload.address
                is ApiParsedPayload.ApiNftTransferPayload -> payload.newOwner
                else -> transaction.toAddress
            }

            uiItems.addAll(
                listOf(
                    Item.ListTitle(LocaleController.getString(R.string.DApp_SendReceivingAddress)),
                    Item.Address(receivingAddress),
                    Item.Gap
                )
            )

            if (payload?.payloadIsNft == true) {
                uiItems.addAll(
                    listOf(
                        Item.ListTitle(LocaleController.getString(R.string.DApp_SendNft)),
                        Item.IconDualLine(
                            title = transaction.payload?.payloadNft?.name,
                            subtitle = DappFeeHelpers.calculateDappTransferFee(
                                transaction.networkFee,
                                BigInteger.ZERO
                            ),
                            image = Content(
                                image = Content.Image.Url(
                                    transaction.payload?.payloadNft?.image ?: ""
                                ),
                                rounding = Content.Rounding.Radius(8f.dp)
                            )
                        ),
                    )
                )
            } else if (payload?.payloadIsToken == true) {
                val amount = if (token.isUnknown) {
                    transaction.amount
                } else {
                    transaction.payload?.payloadTokenAmount ?: BigInteger.ZERO
                }

                uiItems.addAll(
                    listOf(
                        Item.ListTitle(LocaleController.getString(R.string.DApp_SendAmount)),
                        Item.IconDualLine(
                            title = tokenToShow?.let {
                                CoinUtils.setSpanToSymbolPart(
                                    SpannableStringBuilder(amount.toAmountString(it)),
                                    WForegroundColorSpan(WColor.SecondaryText)
                                )
                            },
                            subtitle = DappFeeHelpers.calculateDappTransferFee(
                                transaction.networkFee,
                                BigInteger.ZERO
                            ),
                            image = tokenIcon,
                        ),
                    )
                )
            } else {
                val amount = transaction.amount

                uiItems.addAll(
                    listOf(
                        Item.ListTitle(LocaleController.getString(R.string.DApp_SendAmount)),
                        Item.IconDualLine(
                            title = tokenToShow?.let {
                                CoinUtils.setSpanToSymbolPart(
                                    SpannableStringBuilder(amount.toAmountString(it)),
                                    WForegroundColorSpan(WColor.SecondaryText)
                                )
                            },
                            subtitle = DappFeeHelpers.calculateDappTransferFee(
                                transaction.networkFee,
                                BigInteger.ZERO
                            ),
                            image = tokenIcon,
                        ),
                    )
                )
            }

            val comment = payload?.payloadComment
            comment?.let { text ->
                uiItems.addAll(
                    listOf(
                        Item.Gap,
                        Item.ListTitle(LocaleController.getString(R.string.DApp_SendComment)),
                        Item.Address(text),
                    )
                )
            }

            if (payload !is ApiParsedPayload.ApiCommentPayload) {
                transaction.rawPayload?.let { base64 ->
                    uiItems.addAll(
                        listOf(
                            Item.Gap,
                            Item.ListTitle(LocaleController.getString(R.string.DApp_SendPayload)),
                            Item.ExpandableText(base64),
                        )
                    )
                }
            }

            return uiItems
        }
    }
}
