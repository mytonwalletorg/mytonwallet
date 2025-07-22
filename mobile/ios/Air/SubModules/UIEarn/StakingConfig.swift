//
//  StakingConfig.swift
//  MyTonWalletAir
//
//  Created by nikstar on 18.07.2025.
//

import Foundation
import WalletCore
import WalletContext


public struct StakingConfig: Identifiable, Equatable, Hashable {
    public let id: String
    let _baseToken: ApiToken
    let _stakedToken: ApiToken
    public let displayTitle: String
    
    init(id: String, baseToken: ApiToken, stakedToken: ApiToken, displayTitle: String) {
        self.id = id
        self._baseToken = baseToken
        self._stakedToken = stakedToken
        self.displayTitle = displayTitle
    }
}

public extension StakingConfig {
    
    static let tonLiquid = StakingConfig(
        id: "liquid",
        baseToken: .TONCOIN,
        stakedToken: .STAKED_TON,
        displayTitle: "TON"
    )
    
    static let tonNominators = StakingConfig(
        id: "nominators",
        baseToken: .TONCOIN,
        stakedToken: .STAKED_TON,
        displayTitle: "TON"
    )
    
    static var ton: StakingConfig {
        StakingStore.currentAccount?.shouldUseNominators == true ? tonNominators : tonLiquid
    }

    static let mycoin = StakingConfig(
        id: MYCOIN_STAKING_POOL,
        baseToken: .MYCOIN,
        stakedToken: .STAKED_MYCOIN,
        displayTitle: "MY"
    )

    static let ethena = StakingConfig(
        id: "ethena",
        baseToken: .TON_USDE,
        stakedToken: .TON_TSUSDE,
        displayTitle: "USDe"
    )
}

public extension StakingConfig {
    var baseTokenSlug: String { _baseToken.slug }
    var stakedTokenSlug: String { _stakedToken.slug }
    var nativeTokenSlug: String { TONCOIN_SLUG }
    
    var baseToken: ApiToken { TokenStore.tokens[baseTokenSlug] ?? _baseToken }
    var stakedToken: ApiToken { TokenStore.tokens[stakedTokenSlug] ?? _stakedToken }
    var nativeToken: ApiToken { TokenStore.tokens[nativeTokenSlug] ?? .TONCOIN }
    
    var stakingState: ApiStakingState? { StakingStore.currentAccount?.stateById[id] }

    var fullStakingBalance: BigInt? {
        stakingState.flatMap(getFullStakingBalance(state:))
    }
    var unstakeTime: Date? {
        stakingState.flatMap(getUnstakeTime(state:))
    }
}
