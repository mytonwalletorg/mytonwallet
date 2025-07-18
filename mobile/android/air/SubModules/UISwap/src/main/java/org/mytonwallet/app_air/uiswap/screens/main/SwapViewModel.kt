package org.mytonwallet.app_air.uiswap.screens.main

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.cancel
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.mytonwallet.app_air.uicomponents.extensions.collectFlow
import org.mytonwallet.app_air.uicomponents.helpers.Rate
import org.mytonwallet.app_air.walletcontext.R
import org.mytonwallet.app_air.walletcontext.helpers.LocaleController
import org.mytonwallet.app_air.walletcontext.utils.CoinUtils
import org.mytonwallet.app_air.walletcontext.utils.smartDecimalsCount
import org.mytonwallet.app_air.walletcontext.utils.toBigInteger
import org.mytonwallet.app_air.walletcontext.utils.toString
import org.mytonwallet.app_air.walletcore.JSWebViewBridge
import org.mytonwallet.app_air.walletcore.WalletCore
import org.mytonwallet.app_air.walletcore.api.checkTransactionDraft
import org.mytonwallet.app_air.walletcore.api.submitTransfer
import org.mytonwallet.app_air.walletcore.api.swapBuildTransfer
import org.mytonwallet.app_air.walletcore.api.swapCexCreateTransaction
import org.mytonwallet.app_air.walletcore.api.swapCexEstimate
import org.mytonwallet.app_air.walletcore.api.swapGetPairs
import org.mytonwallet.app_air.walletcore.api.swapSubmit
import org.mytonwallet.app_air.walletcore.helpers.FeeEstimationHelpers
import org.mytonwallet.app_air.walletcore.models.DIESEL_TOKENS
import org.mytonwallet.app_air.walletcore.models.MBlockchain
import org.mytonwallet.app_air.walletcore.models.MBridgeError
import org.mytonwallet.app_air.walletcore.models.SwapType
import org.mytonwallet.app_air.walletcore.moshi.MApiCheckTransactionDraftOptions
import org.mytonwallet.app_air.walletcore.moshi.MApiSubmitTransferOptions
import org.mytonwallet.app_air.walletcore.moshi.MApiSwapAsset
import org.mytonwallet.app_air.walletcore.moshi.MApiSwapBuildRequest
import org.mytonwallet.app_air.walletcore.moshi.MApiSwapCexCreateTransactionRequest
import org.mytonwallet.app_air.walletcore.moshi.MApiSwapCexCreateTransactionResponse
import org.mytonwallet.app_air.walletcore.moshi.MApiSwapCexEstimateRequest
import org.mytonwallet.app_air.walletcore.moshi.MApiSwapCexEstimateResponse
import org.mytonwallet.app_air.walletcore.moshi.MApiSwapDexLabel
import org.mytonwallet.app_air.walletcore.moshi.MApiSwapEstimateRequest
import org.mytonwallet.app_air.walletcore.moshi.MApiSwapEstimateResponse
import org.mytonwallet.app_air.walletcore.moshi.MApiSwapEstimateVariant
import org.mytonwallet.app_air.walletcore.moshi.MApiSwapHistoryItem
import org.mytonwallet.app_air.walletcore.moshi.MApiSwapHistoryItemStatus
import org.mytonwallet.app_air.walletcore.moshi.MApiSwapPairAsset
import org.mytonwallet.app_air.walletcore.moshi.api.ApiMethod
import org.mytonwallet.app_air.walletcore.stores.AccountStore
import org.mytonwallet.app_air.walletcore.stores.BalanceStore
import org.mytonwallet.app_air.walletcore.stores.TokenStore
import java.math.BigDecimal
import java.math.BigInteger
import java.math.RoundingMode

const val DEFAULT_OUR_SWAP_FEE = 0.875

class SwapViewModel : ViewModel(), WalletCore.EventObserver {

    /** Wallet State **/

    private val _walletStateFlow = MutableStateFlow(createWalletState())

    data class WalletState(
        var accountId: String,
        var accountName: String,
        val addressByChain: Map<String, String>,
        val balances: Map<String, BigInteger>,
        val assets: List<MApiSwapAsset>
    ) {
        val assetsMap: Map<String, MApiSwapAsset> = assets.associateBy { it.slug }

        val tonAddress get() = addressByChain[MBlockchain.ton.name]!!

        fun isSupportedChain(chain: MBlockchain?): Boolean {
            return addressByChain[chain?.name] != null
        }
    }

    private fun createWalletState(): WalletState? {
        val account = AccountStore.activeAccount ?: return null
        val assets = TokenStore.swapAssets2 ?: return null
        return WalletState(
            accountId = account.accountId,
            accountName = account.name,
            addressByChain = account.addressByChain,
            balances = BalanceStore.getBalances(account.accountId) ?: emptyMap(),
            assets = assets
        )
    }


    /** Input State **/

    private val _inputStateFlow = MutableStateFlow(
        InputState(
            tokenToSend = null,
            tokenToSendMaxAmount = null,
            tokenToReceive = null,
            amount = null,
            reverse = false,
            isFromAmountMax = false,
            slippage = 5f,
            selectedDex = null
        )
    )

    data class InputState(
        val tokenToSend: MApiSwapAsset? = null,
        val tokenToSendMaxAmount: String? = null,
        val tokenToReceive: MApiSwapAsset? = null,
        val amount: String? = null,
        val reverse: Boolean = false,
        val isFromAmountMax: Boolean = false,
        val slippage: Float = 0f,
        val selectedDex: MApiSwapDexLabel? = null
    ) {
        val isCex = isCexSwap(tokenToSend, tokenToReceive)
    }


    /** Tokens UI State **/

    enum class SwapDetailsVisibility { VISIBLE, CEX, GONE }

    data class SwapUiInputState(
        val wallet: WalletState,
        private val input: InputState,
    ) {
        val tokenToSend: MApiSwapAsset? = input.tokenToSend
        val tokenToSendMaxAmount: String
            get() {
                return input.tokenToSendMaxAmount ?: maxAmountFmt ?: ""
            }
        val nativeTokenToSend: MApiSwapAsset? =
            wallet.assetsMap[tokenToSend?.mBlockchain?.nativeSlug]
        val tokenToReceive: MApiSwapAsset? = input.tokenToReceive

        val tokenToSendIsSupported = wallet.isSupportedChain(tokenToSend?.mBlockchain)
        val tokenToReceiveIsSupported = wallet.isSupportedChain(tokenToReceive?.mBlockchain)

        val slippage = input.slippage
        val selectedDex = input.selectedDex

        val isCex = input.isCex
        val reverse = input.reverse && !isCex
        val swapDetailsVisibility = if (wallet.isSupportedChain(tokenToSend?.mBlockchain)) {
            if (isCex) SwapDetailsVisibility.CEX else SwapDetailsVisibility.VISIBLE
        } else {
            SwapDetailsVisibility.GONE
        }

        val amountInput = if (input.reverse && isCex) null else input.amount
        private val tokenToInput = if (reverse) tokenToReceive else tokenToSend
        val amount = tokenToInput?.let {
            CoinUtils.fromDecimal(amountInput, it.decimals)
        }

        val key =
            tokenToSend?.slug + "_" + tokenToReceive?.slug + "_" + amountInput + "_" + (reverse.toString())

        internal val tokenToSendBalance: BigInteger =
            tokenToSend?.let { token -> wallet.balances[token.slug] } ?: BigInteger.ZERO
        internal val nativeTokenToSendBalance: BigInteger =
            nativeTokenToSend?.let { wallet.balances[it.slug] } ?: BigInteger.ZERO

        private val maxAmountFmt: String?
            get() {
                val token = tokenToSend ?: return null
                if (!tokenToSendIsSupported) return null

                return tokenToSendBalance.toString(
                    decimals = token.decimals,
                    currency = token.symbol ?: "",
                    currencyDecimals = tokenToSendBalance.smartDecimalsCount(token.decimals),
                    showPositiveSign = false
                )
            }

        val isFromAmountMax: Boolean
            get() {
                return input.isFromAmountMax
            }

        init {
            if (reverse && isCex) {
                throw IllegalStateException()
            }
        }
    }

    val uiInputStateFlow: Flow<SwapUiInputState> =
        combine(_walletStateFlow, _inputStateFlow, this::buildUiInputStateFlow).filterNotNull()

    private fun buildUiInputStateFlow(
        walletOpt: WalletState?,
        input: InputState
    ): SwapUiInputState? {
        val wallet = walletOpt ?: return null
        return SwapUiInputState(wallet = wallet, input = input)
    }

    private val tokenPairsLoading = mutableSetOf<String>()
    private val tokenPairsCache = mutableMapOf<String, List<MApiSwapPairAsset>>()

    private suspend fun loadPairsIfNeeded(slug: String) {
        if (tokenPairsCache.contains(slug)) return
        if (!tokenPairsLoading.add(slug)) return

        try {
            val pairs = swapGetPairs(slug)

            tokenPairsCache[slug] = pairs.filter { it.slug != slug }
            validatePair()

            if (_loadingStatusFlow.value.needOpenSelectorAfterPairsLoading) {
                openTokenToReceiveSelector()
            }
        } catch (_: JSWebViewBridge.ApiError) {
        } finally {
            tokenPairsLoading.remove(slug)
        }
    }

    fun isReverse() = _inputStateFlow.value.reverse

    fun openTokenToSendSelector() {
        cancelScheduledSelectorOpen()

        _walletStateFlow.value?.assets?.let {
            _eventsFlow.tryEmit(Event.ShowSelector(it, mode = Mode.SEND))
        }
    }

    fun openTokenToReceiveSelector() {
        cancelScheduledSelectorOpen()

        val state = _inputStateFlow.value
        val pairs = tokenPairsCache[state.tokenToSend?.slug]

        if (state.tokenToSend == null) {
            _walletStateFlow.value?.assets?.let {
                _eventsFlow.tryEmit(Event.ShowSelector(it, mode = Mode.RECEIVE))
            }
        } else if (pairs != null) {
            _walletStateFlow.value?.assetsMap?.let { assets ->
                _eventsFlow.tryEmit(
                    Event.ShowSelector(
                        pairs.mapNotNull { assets[it.slug] },
                        mode = Mode.RECEIVE
                    )
                )
            }
        } else {
            _loadingStatusFlow.value = _loadingStatusFlow.value.copy(
                needOpenSelectorAfterPairsLoading = true
            )
        }
    }

    fun openSwapConfirmation(addressToReceive: String?) {
        val estimated = _simulatedSwapFlow.value ?: return

        if (!estimated.request.tokenToReceiveIsSupported && addressToReceive.isNullOrEmpty()) {
            _eventsFlow.tryEmit(Event.ShowAddressToReceiveInput(estimated))
            return
        }

        _eventsFlow.tryEmit(
            Event.ShowConfirm(
                request = estimated,
                addressToReceive = addressToReceive
            )
        )
    }

    private fun calcSwapMaxBalance(
        lastEstimateSwapResponse: EstimateSwapResponse?
    ): BigInteger {
        val tokenToSend = _inputStateFlow.value.tokenToSend ?: return BigInteger.ZERO
        val tokenToReceive = _inputStateFlow.value.tokenToReceive
        var balance = _walletStateFlow.value?.balances?.get(tokenToSend.slug) ?: BigInteger.ZERO

        val swapType: SwapType =
            if (tokenToReceive == null) SwapType.ON_CHAIN else SwapType.from(
                tokenToSend,
                tokenToReceive
            )
        if (tokenToSend.mBlockchain?.nativeSlug == tokenToSend.slug) {
            val networkFeeData =
                FeeEstimationHelpers.networkFeeData(
                    tokenToSend,
                    lastEstimateSwapResponse?.request?.wallet?.isSupportedChain(tokenToSend.mBlockchain) == true,
                    swapType,
                    lastEstimateSwapResponse?.dex?.networkFee
                )
            balance -= CoinUtils.fromDecimal(networkFeeData?.fee, tokenToSend.decimals)
                ?: BigInteger.ZERO
        }

        tokenToReceive?.let {
            if (swapType == SwapType.ON_CHAIN) {
                lastEstimateSwapResponse?.dex?.dieselFee?.toDouble()?.let {
                    balance -= it.toBigInteger(tokenToSend.decimals)!!
                }

                val ourFeePercent =
                    lastEstimateSwapResponse?.dex?.ourFeePercent ?: DEFAULT_OUR_SWAP_FEE
                balance = balance.multiply(BigInteger.TEN.pow(9))
                    .divide((1 + (ourFeePercent / 100)).toBigInteger(9))
            }
        }

        if (balance < BigInteger.ZERO) {
            return BigInteger.ZERO
        }

        return balance
    }

    val tokenToSendMaxAmount: String?
        get() {
            return _inputStateFlow.value.tokenToSendMaxAmount
        }

    fun tokenToSendSetMaxAmount() {
        cancelScheduledSelectorOpen()

        val token = _inputStateFlow.value.tokenToSend ?: return
        val available = calcSwapMaxBalance(_simulatedSwapFlow.value)
        _inputStateFlow.value = _inputStateFlow.value.copy(
            tokenToSendMaxAmount = available.toString(
                decimals = token.decimals,
                currency = token.symbol ?: "",
                currencyDecimals = available.smartDecimalsCount(token.decimals),
                showPositiveSign = false,
                roundUp = false
            ),
            amount = CoinUtils.toDecimalString(available, token.decimals),
            reverse = false,
            isFromAmountMax = true
        )
    }

    fun onTokenToSendAmountInput(amount: CharSequence?) {
        cancelScheduledSelectorOpen()

        val state = _inputStateFlow.value
        _inputStateFlow.value = state.copy(
            amount = amount?.toString(),
            reverse = false,
            isFromAmountMax = false
        )
    }

    fun onTokenToReceiveAmountInput(amount: CharSequence?) {
        cancelScheduledSelectorOpen()

        val state = _inputStateFlow.value
        _inputStateFlow.value = state.copy(
            amount = amount?.toString(),
            reverse = true,
            isFromAmountMax = false
        )
    }

    fun setTokenToSend(asset: MApiSwapAsset) {
        cancelScheduledSelectorOpen()

        val state = _inputStateFlow.value
        if (asset.slug != state.tokenToReceive?.slug) {
            _inputStateFlow.value = state.copy(tokenToSend = asset, isFromAmountMax = false)
            validatePair()
        } else {
            _inputStateFlow.value = state.copy(
                tokenToSend = asset,
                tokenToReceive = state.tokenToSend,
                isFromAmountMax = false
            )
        }
    }

    fun setSlippage(slippage: Float) {
        _inputStateFlow.value = _inputStateFlow.value.copy(slippage = slippage)
    }

    fun setDex(dex: MApiSwapDexLabel?) {
        _inputStateFlow.value = _inputStateFlow.value.copy(selectedDex = dex)
    }

    private fun validatePair() {
        val state = _inputStateFlow.value
        val pairs = tokenPairsCache[state.tokenToSend?.slug]
        if (pairs != null && state.tokenToReceive != null) {
            if (pairs.find { it.slug == state.tokenToReceive.slug } == null) {
                _inputStateFlow.value = state.copy(tokenToReceive = null)
            }
        }
    }

    fun setTokenToReceive(asset: MApiSwapAsset?) {
        cancelScheduledSelectorOpen()

        _inputStateFlow.value = _inputStateFlow.value.copy(tokenToReceive = asset)
    }

    fun setAmount(amount: Double) {
        _inputStateFlow.value = _inputStateFlow.value.copy(
            amount = BigDecimal(amount).toPlainString(),
            reverse = false
        )
    }

    fun swapTokens() {
        cancelScheduledSelectorOpen()

        val state = _inputStateFlow.value
        _inputStateFlow.value = state.copy(
            tokenToSend = state.tokenToReceive,
            tokenToReceive = state.tokenToSend,
            reverse = !state.reverse && !state.isCex
        )
    }

    fun getLastResponse(): EstimateSwapResponse? {
        return _simulatedSwapFlow.value
    }

    val shouldAuthorizeDiesel: Boolean
        get() {
            _simulatedSwapFlow.value?.let {
                return it.request.isDiesel && it.dex?.dieselStatus == "not-authorized"
            }
            return false
        }

    /** Swap Estimate **/

    private companion object {
        private const val TIME_LIMIT = 1000L
        private const val DELAY_NORMAL = 5000L
        private const val DELAY_ERROR = 1000L

        private fun isCexSwap(
            tokenToSend: MApiSwapAsset?,
            tokenToReceive: MApiSwapAsset?
        ): Boolean {
            val token1 = tokenToSend ?: return false
            val token2 = tokenToReceive ?: return false

            return !token1.isTonOrJetton || !token2.isTonOrJetton
        }
    }

    data class EstimateSwapRequest(
        val key: String,
        val wallet: WalletState,
        val tokenToSend: MApiSwapAsset,
        val tokenToReceive: MApiSwapAsset,
        val nativeTokenToSend: MApiSwapAsset,
        val nativeTokenToSendBalance: String,
        val amount: BigInteger,
        val slippage: Float,
        val reverse: Boolean,
        val isFromAmountMax: Boolean,
        val selectedDex: MApiSwapDexLabel?,
        val prevEst: EstimateSwapResponse?
    ) {
        val tokenToSendIsSupported = wallet.isSupportedChain(tokenToSend.mBlockchain)
        val tokenToReceiveIsSupported = wallet.isSupportedChain(tokenToReceive.mBlockchain)
        val isCex = isCexSwap(tokenToSend, tokenToReceive)

        val shouldTryDiesel: Boolean
        val isDiesel: Boolean

        init {
            val swapType = SwapType.from(tokenToSend, tokenToReceive)
            val networkFeeData =
                FeeEstimationHelpers.networkFeeData(
                    tokenToSend,
                    wallet.isSupportedChain(tokenToSend.mBlockchain),
                    swapType,
                    prevEst?.dex?.networkFee
                )
            val totalNativeAmount = (networkFeeData?.fee ?: BigDecimal.ZERO) +
                (if (networkFeeData?.isNativeIn == true) CoinUtils.toBigDecimal(
                    amount,
                    nativeTokenToSend.decimals
                ) else BigDecimal.ZERO)
            val tokenInChain = tokenToSend.mBlockchain!!
            val nativeBalance = CoinUtils.toBigDecimal(
                wallet.balances[tokenInChain.nativeSlug] ?: BigInteger.ZERO,
                nativeTokenToSend.decimals
            )
            val isEnoughNative = nativeBalance >= totalNativeAmount
            shouldTryDiesel = !isEnoughNative
            isDiesel = swapType == SwapType.ON_CHAIN && shouldTryDiesel && DIESEL_TOKENS.contains(
                tokenToSend.tokenAddress
            )
        }

        val estimateRequestDex: MApiSwapEstimateRequest
            get() = MApiSwapEstimateRequest(
                from = tokenToSend.swapSlug,
                to = tokenToReceive.swapSlug,
                fromAddress = wallet.tonAddress,
                fromAmount = if (!reverse) CoinUtils.toBigDecimal(
                    amount,
                    tokenToSend.decimals
                ) else null,
                toAmount = if (reverse) CoinUtils.toBigDecimal(
                    amount,
                    tokenToReceive.decimals
                ) else null,
                slippage = slippage,
                shouldTryDiesel = shouldTryDiesel,
                walletVersion = null,
                isFromAmountMax = isFromAmountMax,
                toncoinBalance = nativeTokenToSendBalance,
            )

        val estimateRequestCex: MApiSwapCexEstimateRequest
            get() {
                if (reverse && isCex) {
                    throw IllegalStateException()
                }

                return MApiSwapCexEstimateRequest(
                    from = tokenToSend.swapSlug,
                    to = tokenToReceive.swapSlug,
                    fromAmount = CoinUtils.toBigDecimal(amount, tokenToSend.decimals)
                )
            }
    }

    data class EstimateSwapResponse(
        val request: EstimateSwapRequest,
        val dex: MApiSwapEstimateResponse?,
        val cex: MApiSwapCexEstimateResponse?,
        val fee: BigInteger?,
        val error: JSWebViewBridge.ApiError?
    ) {
        private val fromAmountDec = cex?.fromAmount ?: dex?.fromAmount
        private val toAmountDec = cex?.toAmount ?: dex?.toAmount

        val fromAmount = CoinUtils.fromDecimal(fromAmountDec, request.tokenToSend.decimals)
        val toAmount = CoinUtils.fromDecimal(toAmountDec, request.tokenToReceive.decimals)

        val fromAmountDecimalStr =
            fromAmount?.let { CoinUtils.toDecimalString(it, request.tokenToSend.decimals) }
        val toAmountDecimalStr =
            toAmount?.let { CoinUtils.toDecimalString(it, request.tokenToReceive.decimals) }

        private val toAmountMin =
            CoinUtils.fromDecimal(dex?.toMinAmount ?: toAmountDec, request.tokenToReceive.decimals)
                ?: BigInteger.ZERO

        internal val fromAmountMin =
            CoinUtils.fromDecimal(cex?.fromMin, request.tokenToSend.decimals) ?: BigInteger.ZERO
        val fromAmountMax = CoinUtils.fromDecimal(cex?.fromMax, request.tokenToSend.decimals)

        private val rate = Rate.build(
            sendAmount = fromAmountDec ?: BigDecimal.ZERO,
            receiveAmount = toAmountDec ?: BigDecimal.ZERO
        )
        val rateSendFmt = rate.fmtSend(
            request.tokenToSend.symbol,
            decimals = rate.sendAmount.smartDecimalsCount(),
            round = false
        )
        val rateReceiveFmt = rate.fmtReceive(
            request.tokenToReceive.symbol,
            decimals = rate.receiveAmount.smartDecimalsCount(),
            round = false
        )

        /*val confirmSubtitleFmt = LocaleController.getString(
            R.string.Swap_Confirm_Subtitle, listOf(
                fromAmountDecimalStr + " " + request.tokenToSend.symbol,
                toAmountDecimalStr + " " + request.tokenToReceive.symbol
            )
        )*/

        val priceImpactFmt = (dex?.impact ?: 0.0).toString(
            decimals = 2,
            currency = "",
            currencyDecimals = 2,
            smartDecimals = true
        ) + "%"

        val minReceivedFmt = toAmountMin.toString(
            decimals = request.tokenToReceive.decimals,
            currency = request.tokenToReceive.symbol ?: "",
            currencyDecimals = toAmountMin.smartDecimalsCount(request.tokenToReceive.decimals),
            showPositiveSign = false
        )

        val transactionFeeFmt2: String
            get() {
                if (dex?.dieselFee != null) {
                    val networkFeeData =
                        FeeEstimationHelpers.networkFeeData(
                            request.tokenToSend,
                            request.wallet.isSupportedChain(request.tokenToSend.mBlockchain),
                            SwapType.from(request.tokenToSend, request.tokenToReceive),
                            dex.networkFee
                        )
                    val totalNativeAmount = (networkFeeData?.fee ?: BigDecimal.ZERO) +
                        (if (networkFeeData?.isNativeIn == true) dex.fromAmount else BigDecimal.ZERO)
                    val balance =
                        request.wallet.balances[request.nativeTokenToSend.slug] ?: BigInteger.ZERO
                    val nativeDeficit = totalNativeAmount - CoinUtils.toBigDecimal(
                        balance,
                        request.nativeTokenToSend.decimals
                    )
                    val dieselRealFee = dex.dieselFee!!.toDouble().toBigDecimal()
                        .divide(nativeDeficit, RoundingMode.HALF_UP)
                        .multiply(dex.realNetworkFee?.toBigDecimal())
                    val dieselRealFeeBigInt =
                        CoinUtils.fromDecimal(dieselRealFee, request.nativeTokenToSend.decimals)
                    val dieselRealFeeFmt = dieselRealFeeBigInt?.toString(
                        request.nativeTokenToSend.decimals,
                        request.tokenToSend.symbol ?: "",
                        dieselRealFeeBigInt.smartDecimalsCount(request.nativeTokenToSend.decimals),
                        false
                    )

                    return "~$dieselRealFeeFmt"
                }

                val nativeToken = request.nativeTokenToSend

                return fee?.toString(
                    decimals = nativeToken.decimals,
                    currency = nativeToken.symbol ?: "",
                    currencyDecimals = fee.smartDecimalsCount(nativeToken.decimals),
                    showPositiveSign = false
                ) ?: ""
            }
    }

    fun doSend(passcode: String, response: EstimateSwapResponse, addressToReceive: String?) {
        viewModelScope.launch {
            callSubmit(passcode, response, addressToReceive)
        }
    }

    private var lastSimulationTime: Long = 0L
    private var subscriptionScope: CoroutineScope? = null

    private val _simulatedSwapFlow = MutableStateFlow<EstimateSwapResponse?>(null)
    val simulatedSwapFlow = _simulatedSwapFlow.asStateFlow()

    private fun subscribe(state: SwapUiInputState) {
        unsubscribe()
        if (state.tokenToSend != null && state.tokenToReceive != null && state.amount != null) {
            subscriptionScope = CoroutineScope(Dispatchers.IO)
            subscriptionScope!!.launch {
                val currentTime = System.currentTimeMillis()
                val timeSinceLastSimulation = currentTime - lastSimulationTime
                if (timeSinceLastSimulation < TIME_LIMIT) {
                    delay(TIME_LIMIT - timeSinceLastSimulation)
                }
                while (isActive) {
                    lastSimulationTime = System.currentTimeMillis()

                    try {
                        val request = EstimateSwapRequest(
                            key = state.key,
                            tokenToSend = state.tokenToSend,
                            nativeTokenToSend = state.nativeTokenToSend!!,
                            nativeTokenToSendBalance = CoinUtils.toDecimalString(
                                _walletStateFlow.value?.balances?.get(state.nativeTokenToSend.slug)
                                    ?: BigInteger.ZERO, state.nativeTokenToSend.decimals
                            ),
                            tokenToReceive = state.tokenToReceive,
                            wallet = state.wallet,
                            amount = if (state.isFromAmountMax) _walletStateFlow.value?.balances?.get(
                                state.tokenToSend.slug
                            ) ?: BigInteger.ZERO else state.amount,
                            reverse = state.reverse,
                            slippage = state.slippage,
                            isFromAmountMax = state.isFromAmountMax,
                            prevEst = _simulatedSwapFlow.value,
                            selectedDex = state.selectedDex
                        )

                        val response = callEstimate(request)
                        val available = calcSwapMaxBalance(response)
                        _inputStateFlow.value = _inputStateFlow.value.copy(
                            tokenToSendMaxAmount = available.toString(
                                decimals = request.tokenToSend.decimals,
                                currency = request.tokenToSend.symbol ?: "",
                                currencyDecimals = available.smartDecimalsCount(
                                    request.tokenToSend.decimals
                                ),
                                showPositiveSign = false,
                                roundUp = false
                            ),
                        )
                        _simulatedSwapFlow.value = response

                        if (response.error != null) {
                            delay(DELAY_ERROR)
                        } else {
                            delay(DELAY_NORMAL)
                        }
                        continue
                    } catch (t: Throwable) {
                        if (isActive && _simulatedSwapFlow.value?.request?.key != state.key) {
                            _simulatedSwapFlow.value = null
                        }
                    }
                    delay(DELAY_ERROR)
                }
            }
        } else {
            _simulatedSwapFlow.value = null
        }
    }

    private fun unsubscribe() {
        subscriptionScope?.cancel()
        subscriptionScope = null
    }


    /** Loading **/

    data class LoadingState(
        val needOpenSelectorAfterPairsLoading: Boolean = false,
    )

    private val _loadingStatusFlow = MutableStateFlow(LoadingState())

    private fun cancelScheduledSelectorOpen() {
        if (_loadingStatusFlow.value.needOpenSelectorAfterPairsLoading) {
            _loadingStatusFlow.value = _loadingStatusFlow.value.copy(
                needOpenSelectorAfterPairsLoading = false
            )
        }
    }


    /** Events **/

    private val _eventsFlow =
        MutableSharedFlow<Event>(replay = 1, onBufferOverflow = BufferOverflow.DROP_OLDEST)
    val eventsFlow = _eventsFlow.asSharedFlow()

    enum class Mode { SEND, RECEIVE }

    sealed class Event {
        data class ShowSelector(
            val assets: List<MApiSwapAsset>,
            val mode: Mode
        ) : Event()

        data class ShowConfirm(
            val request: EstimateSwapResponse,
            val addressToReceive: String?
        ) : Event()

        data class ShowAddressToReceiveInput(
            val request: EstimateSwapResponse
        ) : Event()

        data class ShowAddressToSend(
            val estimate: EstimateSwapResponse,
            val response: MApiSwapCexCreateTransactionResponse,
            val cex: MApiSwapHistoryItem.Cex
        ) : Event()

        data class SwapComplete(
            val success: Boolean,
            val error: JSWebViewBridge.ApiError? = null
        ) : Event()
    }


    /** UI Status **/

    data class UiStatus(
        val tokenToSend: FieldState,
        val tokenToReceive: FieldState,
        val button: ButtonState
    )

    data class FieldState(
        val isError: Boolean = false,
        val isLoading: Boolean = false
    )

    enum class ButtonStatus {
        WaitAmount,
        WaitToken,
        WaitNetwork,

        Loading,
        Error,

        LessThanMinCex,
        MoreThanMaxCex,
        AuthorizeDiesel,
        PendingPreviousDiesel,

        NotEnoughNativeToken,
        NotEnoughToken,

        Ready;

        val isEnabled: Boolean
            get() = this == Ready || this == AuthorizeDiesel

        val isLoading: Boolean
            get() = this == Loading

        val isError: Boolean
            get() = this == Error
    }

    data class ButtonState(
        val status: ButtonStatus,
        val title: String = ""
    )

    val uiStatusFlow: Flow<UiStatus> =
        combine(uiInputStateFlow, simulatedSwapFlow, _loadingStatusFlow, this::getUiState)

    private fun getUiState(
        assets: SwapUiInputState,
        est: EstimateSwapResponse?,
        loading: LoadingState
    ): UiStatus {
        val buttonState = getButtonState(assets, est, loading)
        val sendAmountError = (!assets.amountInput.isNullOrEmpty() && assets.amount == null)
            || buttonState.status == ButtonStatus.NotEnoughToken
            || buttonState.status == ButtonStatus.LessThanMinCex
            || buttonState.status == ButtonStatus.MoreThanMaxCex


        val inputState = FieldState(
            isError = sendAmountError && !assets.reverse,
            isLoading = false
        )

        val outputState = FieldState(
            isLoading = (est?.let { it.request.key != assets.key } ?: true),
            isError = sendAmountError && assets.reverse
        )

        return UiStatus(
            button = buttonState,
            tokenToSend = if (!assets.reverse) inputState else outputState,
            tokenToReceive = if (assets.reverse) inputState else outputState
        )
    }

    private fun getButtonState(
        state: SwapUiInputState,
        est: EstimateSwapResponse?,
        loading: LoadingState
    ): ButtonState {
        if (loading.needOpenSelectorAfterPairsLoading) {
            return ButtonState(ButtonStatus.Loading)
        }

        val tokenToSend = state.tokenToSend ?: return ButtonState(
            ButtonStatus.WaitToken,
            LocaleController.getString(R.string.Swap_Button_SelectToken)
        )

        val tokenToReceive = state.tokenToReceive ?: return ButtonState(
            ButtonStatus.WaitToken,
            LocaleController.getString(R.string.Swap_Button_SelectToken)
        )

        val inputAmount = state.amount ?: return ButtonState(
            ButtonStatus.WaitAmount,
            LocaleController.getString(R.string.Swap_Button_EnterAmount)
        )

        if (inputAmount == BigInteger.ZERO) {
            return ButtonState(
                ButtonStatus.WaitAmount,
                LocaleController.getString(R.string.Swap_Button_EnterAmount)
            )
        }

        val estimated = est ?: run {
            return if (WalletCore.isConnected())
                ButtonState(ButtonStatus.Loading)
            else
                ButtonState(
                    ButtonStatus.WaitNetwork,
                    LocaleController.getString(R.string.Error_WaitingForNetwork)
                )
        }
        if (estimated.request.key != state.key) {
            return ButtonState(ButtonStatus.Loading)
        }

        val sendAmount = estimated.fromAmount ?: BigInteger.ZERO
        if (sendAmount < estimated.fromAmountMin) {
            return ButtonState(
                ButtonStatus.LessThanMinCex, LocaleController.getString(
                    R.string.Swap_Button_MinAmountIs, listOf(
                        estimated.fromAmountMin.toString(
                            decimals = tokenToSend.decimals,
                            currency = tokenToSend.symbol ?: "",
                            currencyDecimals = tokenToSend.decimals,
                            showPositiveSign = false
                        )
                    )
                )
            )
        }

        estimated.fromAmountMax?.let { maxAmount ->
            if (sendAmount > maxAmount) {
                return ButtonState(
                    ButtonStatus.MoreThanMaxCex, LocaleController.getString(
                        R.string.Swap_Button_MaxAmountIs, listOf(
                            maxAmount.toString(
                                decimals = tokenToSend.decimals,
                                currency = tokenToSend.symbol ?: "",
                                currencyDecimals = tokenToSend.decimals,
                                showPositiveSign = false
                            )
                        )
                    )
                )
            }
        }

        estimated.error?.let {
            return ButtonState(
                ButtonStatus.Error, when (it.parsed) {
                    MBridgeError.INSUFFICIENT_BALANCE -> {
                        val walletBalance =
                            (est.request.wallet.balances[est.request.tokenToSend.slug]
                                ?: BigInteger.ZERO)
                        val requestAmount = estimated.fromAmount ?: estimated.request.amount
                        if (walletBalance >= requestAmount && state.tokenToSendIsSupported) {
                            state.nativeTokenToSend?.symbol?.let {
                                LocaleController.getString(
                                    R.string.Swap_Button_InsufficientXBalance,
                                    listOf(it)
                                )
                            }
                                ?: LocaleController.getString(R.string.Swap_Button_InsufficientBalance)
                        } else {
                            LocaleController.getString(R.string.Swap_Button_InsufficientBalance)
                        }
                    }

                    MBridgeError.TOO_SMALL_AMOUNT,
                    MBridgeError.PAIR_NOT_FOUND -> it.parsed.toShortLocalized ?: ""

                    else -> LocaleController.getString(R.string.Error_Title)
                }
            )
        }

        if (sendAmount > calcSwapMaxBalance(_simulatedSwapFlow.value) && state.tokenToSendIsSupported) {
            return ButtonState(
                ButtonStatus.NotEnoughToken,
                LocaleController.getString(R.string.Swap_Button_InsufficientBalance)
            )
        }


        val nativeSendAmount = if (tokenToSend.slug == tokenToSend.mBlockchain?.nativeSlug) {
            sendAmount
        } else {
            BigInteger.ZERO
        } + (estimated.fee ?: BigInteger.ZERO)

        if (nativeSendAmount > state.nativeTokenToSendBalance && state.tokenToSendIsSupported) {
            if (estimated.request.isDiesel) {
                if (shouldAuthorizeDiesel) {
                    return ButtonState(
                        ButtonStatus.AuthorizeDiesel, LocaleController.getString(
                            R.string.Swap_Button_AuthorizeDiesel, listOf(tokenToSend.symbol ?: "")
                        )
                    )
                }
                if (_simulatedSwapFlow.value?.dex?.dieselStatus == "pending-previous") {
                    return ButtonState(
                        ButtonStatus.PendingPreviousDiesel,
                        LocaleController.getString(R.string.Swap_Button_DieselPendingPreviousFee)
                    )
                }
            } else {
                return ButtonState(
                    ButtonStatus.NotEnoughNativeToken,
                    state.nativeTokenToSend?.symbol?.let {
                        LocaleController.getString(
                            R.string.Swap_Button_InsufficientXBalance,
                            listOf(it)
                        )
                    } ?: LocaleController.getString(R.string.Swap_Button_InsufficientBalance))
            }
        }

        return ButtonState(
            ButtonStatus.Ready, LocaleController.getString(
                R.string.Swap_Button_Continue,
                listOf(tokenToSend.symbol ?: "", tokenToReceive.symbol ?: "")
            )
        )
    }


    /** API **/

    private suspend fun callEstimate(request: EstimateSwapRequest): EstimateSwapResponse {
        try {
            if (request.isCex) {
                val firstTransactionFee: BigInteger
                val balance = request.wallet.balances[request.tokenToSend.slug] ?: BigInteger.ZERO
                val needEstFee = request.wallet.isSupportedChain(request.tokenToSend.mBlockchain)

                if (needEstFee && balance > BigInteger.ZERO) {
                    val estFeeAddress = when (request.tokenToSend.mBlockchain) {
                        MBlockchain.ton -> request.wallet.tonAddress
                        MBlockchain.tron -> "TW2LXSebZ7Br1zHaiA2W1zRojDkDwjGmpw"    // random address for estimate
                        else -> throw NotImplementedError()
                    }

                    val estAmount = BigInteger.ONE
                    firstTransactionFee = WalletCore.Transfer.checkTransactionDraft(
                        request.tokenToSend.mBlockchain!!,
                        MApiCheckTransactionDraftOptions(
                            accountId = request.wallet.accountId,
                            toAddress = estFeeAddress,
                            amount = estAmount,
                            data = null,
                            stateInit = null,
                            tokenAddress = if (!request.tokenToSend.isBlockchainNative) request.tokenToSend.tokenAddress else null,
                            shouldEncrypt = null,
                            isBase64Data = null,
                            allowGasless = null,
                        )
                    ).fee!!
                } else {
                    firstTransactionFee = BigInteger.ZERO
                }

                val cex = WalletCore.Swap.swapCexEstimate(request.estimateRequestCex)
                val res = EstimateSwapResponse(
                    request = request,
                    dex = null,
                    cex = cex,
                    fee = firstTransactionFee,
                    error = null
                )
                return res
            } else {
                var dex = WalletCore.call(
                    ApiMethod.Swap.SwapEstimate(
                        request.wallet.accountId,
                        request.estimateRequestDex,
                    )
                )
                val fee = dex.networkFee.toBigInteger(request.nativeTokenToSend.decimals)
                val all = ArrayList(dex.other ?: emptyList())
                all.add(
                    MApiSwapEstimateVariant(
                        fromAmount = dex.fromAmount,
                        toAmount = dex.toAmount,
                        toMinAmount = dex.toMinAmount,
                        swapFee = dex.swapFee,
                        networkFee = dex.networkFee,
                        realNetworkFee = dex.realNetworkFee,
                        impact = dex.impact,
                        dexLabel = dex.dexLabel
                    )
                )
                val requestedDex = all.find { it.dexLabel == request.selectedDex }
                if (requestedDex != null) {
                    dex = dex.copy(
                        fromAmount = requestedDex.fromAmount,
                        toAmount = requestedDex.toAmount,
                        toMinAmount = requestedDex.toMinAmount,
                        swapFee = requestedDex.swapFee,
                        networkFee = requestedDex.networkFee,
                        realNetworkFee = requestedDex.realNetworkFee,
                        impact = requestedDex.impact,
                        dexLabel = request.selectedDex!!,
                        bestDexLabel = dex.dexLabel,
                        all = all
                    )
                } else {
                    dex = dex.copy(
                        all = all
                    )
                }
                return EstimateSwapResponse(
                    request = request,
                    dex = dex,
                    cex = null,
                    fee = fee,
                    error = null
                )
            }
        } catch (apiError: JSWebViewBridge.ApiError) {
            return EstimateSwapResponse(
                request = request,
                dex = null,
                cex = null,
                fee = null,
                error = apiError
            )
        }
    }

    private suspend fun callSubmit(
        passcode: String,
        estimate: EstimateSwapResponse,
        addressToReceive: String?
    ) {
        val accountId = estimate.request.wallet.accountId
        val accountTonAddress = estimate.request.wallet.tonAddress
        val tokenToSend = estimate.request.tokenToSend
        val tokenToReceive = estimate.request.tokenToReceive

        try {
            estimate.dex?.let { dex ->
                val build = WalletCore.Swap.swapBuildTransfer(
                    accountId,
                    passcode,
                    MApiSwapBuildRequest(
                        dexLabel = estimate.request.selectedDex?.name
                            ?: dex.dexLabel.name.lowercase(),
                        from = dex.from,
                        fromAddress = accountTonAddress,
                        fromAmount = dex.fromAmount,
                        networkFee = dex.realNetworkFee ?: dex.networkFee,
                        shouldTryDiesel = estimate.request.shouldTryDiesel,
                        slippage = estimate.request.slippage,
                        swapFee = dex.swapFee,
                        to = dex.to,
                        toAmount = dex.toAmount,
                        toMinAmount = dex.toMinAmount,
                        ourFee = dex.ourFee,
                        dieselFee = dex.dieselFee,
                        swapVersion = 2
                    )
                )

                WalletCore.Swap.swapSubmit(
                    accountId,
                    passcode,
                    build.transfers,
                    MApiSwapHistoryItem(
                        id = build.id,
                        timestamp = System.currentTimeMillis(),
                        lt = null,
                        from = dex.from,
                        fromAmount = dex.fromAmount,
                        to = dex.to,
                        toAmount = dex.toAmount,
                        networkFee = dex.networkFee,
                        swapFee = dex.swapFee,
                        status = MApiSwapHistoryItemStatus.PENDING,
                        txIds = emptyList(),
                        isCanceled = null,
                        cex = null
                    ),
                    estimate.request.isDiesel
                )

                _eventsFlow.tryEmit(Event.SwapComplete(success = true))
            }

            estimate.cex?.let { cex ->
                val toUserAddress =
                    estimate.request.wallet.addressByChain[tokenToReceive.mBlockchain?.name]
                        ?: addressToReceive
                        ?: throw NullPointerException("user address is null")

                val networkFee = if (tokenToSend.mBlockchain == MBlockchain.ton) {
                    estimate.fee?.toBigDecimal(9)?.toDouble() ?: 0.0
                } else 0.0

                val result = WalletCore.Swap.swapCexCreateTransaction(
                    accountId,
                    passcode,
                    MApiSwapCexCreateTransactionRequest(
                        from = tokenToSend.swapSlug,
                        fromAmount = cex.fromAmount,
                        fromAddress = accountTonAddress,
                        to = tokenToReceive.swapSlug,
                        toAddress = toUserAddress,
                        payoutExtraId = null,
                        swapFee = cex.swapFee,
                        networkFee = networkFee
                    )
                )

                if (estimate.request.tokenToSendIsSupported) {
                    WalletCore.Transfer.submitTransfer(
                        tokenToSend.mBlockchain!!, MApiSubmitTransferOptions(
                            accountId = accountId,
                            password = passcode,
                            toAddress = result.swap.cex?.payinAddress!!,
                            amount = estimate.fromAmount ?: BigInteger.ZERO,
                            fee = estimate.fee,
                            tokenAddress = if (!tokenToSend.isBlockchainNative) tokenToSend.tokenAddress else null
                        )
                    )
                    _eventsFlow.tryEmit(Event.SwapComplete(success = true))
                } else {
                    _eventsFlow.tryEmit(
                        Event.ShowAddressToSend(
                            estimate = estimate,
                            response = result,
                            cex = result.swap.cex!!
                        )
                    )
                }
            }
        } catch (e: JSWebViewBridge.ApiError) {
            _eventsFlow.tryEmit(Event.SwapComplete(success = false, e))
        } catch (t: Throwable) {
            _eventsFlow.tryEmit(Event.SwapComplete(success = false))
        }
    }

    override fun onWalletEvent(event: WalletCore.Event) {
        when (event) {
            is WalletCore.Event.AccountChanged,
            WalletCore.Event.BalanceChanged -> {
                _walletStateFlow.value = createWalletState()
            }

            WalletCore.Event.NetworkConnected,
            WalletCore.Event.NetworkDisconnected -> {
                val correctVal = _inputStateFlow.value
                _inputStateFlow.value = InputState()
                _inputStateFlow.value = correctVal
            }

            else -> {}
        }
    }


    /** Init and Clear **/

    init {
        collectFlow(uiInputStateFlow, this::subscribe)
        collectFlow(uiInputStateFlow) {
            it.tokenToSend?.let { token -> loadPairsIfNeeded(token.slug) }
        }

        combine(TokenStore.swapAssetsFlow, _inputStateFlow) { assets, input ->
            if (assets != null && input.tokenToSend == null && input.tokenToReceive == null) {
                _inputStateFlow.value = _inputStateFlow.value.copy(
                    tokenToSend = assets.find { it.isTON },
                    tokenToReceive = assets.find { it.isUsdt && it.isJetton },
                    isFromAmountMax = false
                )
            }
        }.launchIn(viewModelScope)

        WalletCore.registerObserver(this)
    }

    override fun onCleared() {
        unsubscribe()
        WalletCore.unregisterObserver(this)

        super.onCleared()
    }
}
