import WalletCore
import WalletCoreTypes

enum SwapBatchTxPolicy {
    static func isBatchTx(estimate: ApiSwapDexEstimateResponse?, sellingToken: ApiToken?) -> Bool {
        guard estimate?.needsBatch == true else { return false }
        guard let chain = sellingToken?.chain else { return false }
        return chain.isEvm
    }
}
