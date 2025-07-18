//
//  ApiStakingState.swift
//  WalletCore
//
//  Created by Sina on 5/13/24.
//

import Foundation
import WalletContext

private let log = Log("ApiStakingState")

// MARK: Staking state

public enum ApiStakingState: Equatable, Hashable, Codable, Sendable {
    case liquid(ApiStakingStateLiquid)
    case nominators(ApiStakingStateNominators)
    case jetton(ApiStakingStateJetton)
    case ethena(ApiEthenaStakingState)
    case unknown(String)
    
    enum CodingKeys: CodingKey {
        case type
    }
    
    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.decode(String.self, forKey: .type)
        switch type {
        case "liquid":
            self = try .liquid(ApiStakingStateLiquid(from: decoder))
        case "nominators":
            self = try .nominators(ApiStakingStateNominators(from: decoder))
        case "jetton":
            self = try .jetton(ApiStakingStateJetton(from: decoder))
        case "ethena":
            self = try .ethena(ApiEthenaStakingState(from: decoder))
        default:
            log.error("Unexpected staking type = \(type)")
            self = .unknown(type)
        }
    }
    
    public func encode(to encoder: any Encoder) throws {
        switch self {
        case .liquid(let ApiStakingStateLiquid):
            try ApiStakingStateLiquid.encode(to: encoder)
        case .nominators(let ApiStakingStateNominators):
            try ApiStakingStateNominators.encode(to: encoder)
        case .jetton(let ApiStakingStateJetton):
            try ApiStakingStateJetton.encode(to: encoder)
        case .ethena(let ethena):
            try ethena.encode(to: encoder)
        case .unknown(let type):
            break
        }
    }
}

extension ApiStakingState: MBaseStakingState { // less cringey way to do this?
    public var id: String {
        switch self {
        case .liquid(let v): v.id
        case .nominators(let v): v.id
        case .jetton(let v): v.id
        case .ethena(let v): v.id
        case .unknown(let type): type
        }
    }
    
    public var tokenSlug: String {
        switch self {
        case .liquid(let v): v.tokenSlug
        case .nominators(let v): v.tokenSlug
        case .jetton(let v): v.tokenSlug
        case .ethena(let v): v.tokenSlug
        case .unknown(let type): type
        }
    }
    
    public var annualYield: MDouble {
        switch self {
        case .liquid(let v): v.annualYield
        case .nominators(let v): v.annualYield
        case .jetton(let v): v.annualYield
        case .ethena(let v): v.annualYield
        case .unknown(let type): .zero
        }
    }
    
    public var yieldType: ApiYieldType {
        switch self {
        case .liquid(let v): v.yieldType
        case .nominators(let v): v.yieldType
        case .jetton(let v): v.yieldType
        case .ethena(let v): v.yieldType
        case .unknown(let type): .apy
        }
    }
    
    public var balance: BigIntLib.BigInt {
        switch self {
        case .liquid(let v): v.balance
        case .nominators(let v): v.balance
        case .jetton(let v): v.balance
        case .ethena(let v): v.balance
        case .unknown(let type): .zero
        }
    }
    
    public var pool: String {
        switch self {
        case .liquid(let v): v.pool
        case .nominators(let v): v.pool
        case .jetton(let v): v.pool
        case .ethena(let v): v.pool
        case .unknown(let type): type
        }
    }
    
    public var isUnstakeRequested: Bool? {
        switch self {
        case .liquid(let v): v.isUnstakeRequested
        case .nominators(let v): v.isUnstakeRequested
        case .jetton(let v): v.isUnstakeRequested
        case .ethena(let v): v.isUnstakeRequested
        case .unknown(let type): nil
        }
    }
    
    public var end: Int? {
        switch self {
        case .liquid(let v): return v.end
        case .nominators(let v): return v.end
        case .jetton(let v): return nil
        case .ethena(let v): return nil
        case .unknown(let type): return nil
        }
    }
    
    public var unclaimedRewards: BigInt? {
        if case .jetton(let v) = self {
            return v.unclaimedRewards
        }
        return nil
    }
}

public extension ApiStakingState {
    
    var type: MStakingType {
        switch self {
        case .liquid: .liquid
        case .nominators: .nominators
        case .jetton: .jetton
        case .ethena: .ethena
        case .unknown: .unknown
        }
    }
    
    var apy: Double { self.annualYield.value }
    
    var unstakeRequestAmount: BigInt? {
        if case .liquid(let v) = self {
            return v.unstakeRequestAmount
        }
        return nil
    }
    
    var instantAvailable: BigInt {
        if case .liquid(let ApiStakingStateLiquid) = self {
            return ApiStakingStateLiquid.instantAvailable
        }
        return 0
    }
}

public enum ApiYieldType: String, Equatable, Hashable, Codable, Sendable {
    case apy = "APY"
    case apr = "APR"
}

public protocol MBaseStakingState: Identifiable {
    var id: String { get }
    var tokenSlug: String { get }
    var annualYield: MDouble { get }
    var yieldType: ApiYieldType { get }
    var balance: BigInt { get }
    var pool: String { get }
    var isUnstakeRequested: Bool? { get }
}

public struct ApiStakingStateLiquid: MBaseStakingState, Equatable, Hashable, Codable, Sendable {
    // base staking state
    public var id: String
    public var tokenSlug: String
    public var annualYield: MDouble
    public var yieldType: ApiYieldType
    public var balance: BigInt
    public var pool: String
    public var isUnstakeRequested: Bool?
    
    public var type = "liquid"
    public var tokenBalance: BigInt
    public var unstakeRequestAmount: BigInt
    public var instantAvailable: BigInt
    public var start: Int
    public var end: Int
}

public struct ApiStakingStateNominators: MBaseStakingState, Equatable, Hashable, Codable, Sendable {
    // base staking state
    public var id: String
    public var tokenSlug: String
    public var annualYield: MDouble
    public var yieldType: ApiYieldType
    public var balance: BigInt
    public var pool: String
    public var isUnstakeRequested: Bool?
    
    public var type = "nominators"
    public var pendingDepositAmount: BigInt
    public var start: Int
    public var end: Int
}

public struct ApiStakingStateJetton: MBaseStakingState, Equatable, Hashable, Codable, Sendable {
    // base staking state
    public var id: String
    public var tokenSlug: String
    public var annualYield: MDouble
    public var yieldType: ApiYieldType
    public var balance: BigInt
    public var pool: String
    public var isUnstakeRequested: Bool?
    
    public let type = "jetton"
    public var tokenAddress: String
    public var unclaimedRewards: BigInt
    public var stakeWalletAddress: String
    public var tokenAmount: BigInt
    public var period: Int64
    public var tvl: BigInt
    public var dailyReward: BigInt
    public var poolWallets: [String]?
    
    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.id = try container.decode(String.self, forKey: .id)
        self.tokenSlug = try container.decode(String.self, forKey: .tokenSlug)
        self.annualYield = try container.decode(MDouble.self, forKey: .annualYield)
        self.yieldType = try container.decode(ApiYieldType.self, forKey: .yieldType)
        self.balance = try container.decode(BigInt.self, forKey: .balance)
        self.pool = try container.decode(String.self, forKey: .pool)
        self.isUnstakeRequested = try container.decodeIfPresent(Bool.self, forKey: .isUnstakeRequested)
        self.tokenAddress = try container.decode(String.self, forKey: .tokenAddress)
        self.unclaimedRewards = try container.decode(BigInt.self, forKey: .unclaimedRewards)
        self.stakeWalletAddress = try container.decode(String.self, forKey: .stakeWalletAddress)
        self.tokenAmount = try container.decode(BigInt.self, forKey: .tokenAmount)
        self.period = try container.decode(Int64.self, forKey: .period)
        self.tvl = try container.decode(BigInt.self, forKey: .tvl)
        self.dailyReward = try container.decode(BigInt.self, forKey: .dailyReward)
        self.poolWallets = try container.decodeIfPresent([String].self, forKey: .poolWallets)
    }
}


// MARK: - Backend staking state

public struct MBackendStakingState: Equatable, Hashable, Codable, Sendable {
    public var balance: BigInt
    public var totalProfit: BigInt
    public var type: MStakingType?
    public var nominatorsPool: MNominatorsPool
    public var loyaltyType: MLoyaltyType?
    public var shouldUseNominators: Bool?
    public var stakedAt: Int?
}

public extension MBackendStakingState {
    var isLiquid: Bool { type == .liquid || type == nil }
}

public enum MStakingType: String, Equatable, Hashable, Codable, Sendable {
    case nominators = "nominators"
    case liquid = "liquid"
    case jetton = "jetton"
    case ethena = "ethena"
    case unknown
}
public typealias ApiStakingType = MStakingType

public enum MLoyaltyType: String, Equatable, Hashable, Codable, Sendable {
    case black = "black"
    case platinum = "platinum"
    case gold = "gold"
    case silver = "silver"
    case standard = "standard"
}

public struct MNominatorsPool: Equatable, Hashable, Codable, Sendable {
    public let address: String
    public let apy: Double
    public let start: Int64?
    public let end: Int64?
    
    public init(dictionary: [String: Any]) {
        self.address = dictionary["address"] as? String ?? ""
        self.apy = dictionary["apy"] as? Double ?? 0
        self.start = dictionary["start"] as? Int64
        self.end = dictionary["end"] as? Int64
    }
}


// MARK: - Common data

public struct MStakingCommonData: Equatable, Hashable, Codable, Sendable {
    public var liquid: MStakingCommonDataLiquid
    public var jettonPools: [MStakingJettonPool]
    public var round: MStakingCommonDataRound
    public var prevRound: MStakingCommonDataRound
}

extension MStakingCommonData {
    public var mycoinPool: MStakingJettonPool? {
        jettonPools.first(where: { $0.token == MYCOIN_SLUG })
    }
}


public struct MStakingCommonDataLiquid: Equatable, Hashable, Codable, Sendable {
    public var currentRate: MDouble
    public var nextRoundRate: MDouble
    public var collection: String?
    public var apy: MDouble
    public var available: BigInt
    public var loyaltyApy: [MLoyaltyType: MDouble]
    
    enum CodingKeys: CodingKey {
        case currentRate
        case nextRoundRate
        case collection
        case apy
        case available
        case loyaltyApy
    }
    
    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.currentRate = try container.decode(MDouble.self, forKey: .currentRate)
        self.nextRoundRate = try container.decode(MDouble.self, forKey: .nextRoundRate)
        self.collection = try container.decodeIfPresent(String.self, forKey: .collection)
        self.apy = try container.decode(MDouble.self, forKey: .apy)
        self.available = try container.decode(BigInt.self, forKey: .available)
        
        let dict = try container.decode([String : MDouble].self, forKey: .loyaltyApy)
        let kv: [(MLoyaltyType, MDouble)] = dict.compactMap { k, v in
            if let type = MLoyaltyType(rawValue: k) {
                return (type, v)
            }
            Log.shared.error("Unknown loyalty type: \(k, .public)")
            return nil
        }
        self.loyaltyApy = Dictionary(uniqueKeysWithValues: kv)
    }
    
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(self.currentRate, forKey: .currentRate)
        try container.encode(self.nextRoundRate, forKey: .nextRoundRate)
        try container.encodeIfPresent(self.collection, forKey: .collection)
        try container.encode(self.apy, forKey: .apy)
        try container.encode(self.available, forKey: .available)
        
        let kv = self.loyaltyApy.map { k, v in (k.rawValue, v) }
        let dict = Dictionary(uniqueKeysWithValues: kv)
        try container.encode(dict, forKey: .loyaltyApy)
    }
}

public struct MStakingJettonPool: Equatable, Hashable, Codable, Sendable  {
    public var pool: String
    public var token: String
    public var periods: [MStakingJettonPoolPeriod]
}

public struct MStakingJettonPoolPeriod: Equatable, Hashable, Codable, Sendable  {
    public var period: MDouble
    public var token: String
    public var unstakeCommission: MDouble
}

public struct MStakingCommonDataRound: Equatable, Hashable, Codable, Sendable {
    public var start: Int
    public var end: Int
    public var unlock: Int
}
