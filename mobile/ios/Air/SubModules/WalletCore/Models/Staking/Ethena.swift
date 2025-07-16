
import Foundation
import WalletContext

private let log = Log("ApiEthenaStakingState")

public struct ApiEthenaStakingState: MBaseStakingState, Equatable, Hashable, Codable, Sendable  {
    // base staking state
    public var id: String
    public var tokenSlug: String
    public var annualYield: MDouble
    public var yieldType: ApiYieldType
    public var balance: BigInt
    public var pool: String
    public var isUnstakeRequested: Bool?
    
    public var type = "ethena"
    public var tokenBalance: BigInt
    public var tsUsdeWalletAddress: String
    public var lockedBalance: BigInt
    public var unstakeRequestAmount: BigInt
    public var unlockTime: Int?
}
