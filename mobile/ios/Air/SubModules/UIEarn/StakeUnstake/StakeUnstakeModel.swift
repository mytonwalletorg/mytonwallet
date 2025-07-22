//
//  StakingVC.swift
//  UIEarn
//
//  Created by Sina on 5/13/24.
//

import Combine
import Foundation
import SwiftUI
import UIKit
import UIComponents
import WalletCore
import WalletContext
import UIPasscode

private let log = Log("StakeUnstakeModel")

// display available amount
// actual available (incl. for fees)
// display token
// actual token
//

@MainActor
final class StakeUnstakeModel: ObservableObject {
    
    typealias Mode = StakeUnstakeVC.Mode
    let mode: Mode
    
    var baseToken: ApiToken
    var stakedToken: ApiToken
    
    var token: ApiToken { mode == .stake ? baseToken : stakedToken }
    
    var stakingStateProvider: () -> ApiStakingState
    
    var stakingState: ApiStakingState { stakingStateProvider() }
    var apy: Double { stakingState.apy }
    
    // View controller callbacks
    
    var onAmountChanged: ((BigInt?) -> ())?
    var onWhyIsSafe: (() -> ())?
    
    // User input
    
    @Published var switchedToBaseCurrencyInput: Bool = false
    @Published var amount: BigInt? = nil
    @Published var amountInBaseCurrency: BigInt? = nil
    @Published var isAmountFieldFocused: Bool = false
    
    // Wallet state
    
    @Published var accountBalance: BigInt? = nil
    var tokenSlug: String { token.slug }
    @Published var draft: MTransactionDraft?
    
    var fee: ExplainedTransferFee? {
        if let draft {
            return explainApiTransferFee(input: draft, tokenSlug: tokenSlug)
        }
        return nil
    }
    
    var tokenChain: ApiChain? { availableChain(slug: token.chain) }
    
    // Validation

    @Published var insufficientFunds: Bool = false

    @Published var shouldRenderBalanceWithSmallFee = false
    
    enum WithdrawalType {
        case instant
        case loading
        case timed(TimeInterval)
    }
    @Published var withdrawalType: WithdrawalType = .instant
    
    var canContinue: Bool {
        !insufficientFunds && (amount ?? 0 > 0)
    }
    
    private var observers: Set<AnyCancellable> = []
    
    public init(stakingStateProvider: @escaping () -> ApiStakingState, baseToken: ApiToken, stakedToken: ApiToken, mode: Mode) {
        self.mode = mode
        self.stakingStateProvider = stakingStateProvider
        self.baseToken = baseToken
        self.stakedToken = stakedToken
        WalletCoreData.add(eventObserver: self)
        updateAccountBalance()
    }
    
    // MARK: - View callbacks
    
    @MainActor func onBackgroundTapped() {
        topViewController()?.view.endEditing(true)
    }
        
    @MainActor func onUseAll() {
        topViewController()?.view.endEditing(true)
        self.amount = accountBalance
        self.amountInBaseCurrency = if let baseCurrency = TokenStore.baseCurrency, let accountBalance {
            convertAmount(accountBalance, price: token.price ?? 0, tokenDecimals: token.decimals, baseCurrencyDecimals: baseCurrency.decimalsCount)
        } else {
            0
        }
        onAmountChanged?(amount)
    }
    
    // MARK: -
    
    func updateBaseCurrencyAmount(_ amount: BigInt?) {
        guard let amount else { return }
        let price = TokenStore.tokens[token.slug]?.price ?? 0
        self.amountInBaseCurrency = if let baseCurrency = TokenStore.baseCurrency {
            convertAmount(amount, price: price, tokenDecimals: token.decimals, baseCurrencyDecimals: baseCurrency.decimalsCount)
        } else {
            0
        }
        onAmountChanged?(amount)
    }
    
    func updateAmountFromBaseCurrency(_ baseCurrency: BigInt) {
        let price = TokenStore.tokens[token.slug]?.price ?? 0
        let baseCurrencyDecimals = TokenStore.baseCurrency?.decimalsCount ?? 2
        if price > 0 {
            self.amount = convertAmountReverse(baseCurrency, price: price, tokenDecimals: token.decimals, baseCurrencyDecimals: baseCurrencyDecimals)
        } else {
            self.amount = 0
            self.switchedToBaseCurrencyInput = false
        }
        onAmountChanged?(amount)
    }

    func updateAccountBalance() {
        var availableBalance = BalanceStore.currentAccountBalances[tokenSlug] ?? 0

        switch mode {
        case .stake:
            shouldRenderBalanceWithSmallFee = availableBalance >= ONE_TON
            availableBalance = shouldRenderBalanceWithSmallFee
            ? availableBalance - 2 * ONE_TON
            : (availableBalance > ONE_TON
               ? availableBalance - ONE_TON
               : availableBalance)
            
        case .unstake:
            break
        }

        self.accountBalance = availableBalance
        
        if let amountInBaseCurrency, switchedToBaseCurrencyInput && amount != accountBalance {
                updateAmountFromBaseCurrency(amountInBaseCurrency)
        } else {
            updateBaseCurrencyAmount(amount)
        }
    }
    
    func updateFee() async {
        if let accountId = AccountStore.accountId, let amount = amount {
            do {
                let draft: MTransactionDraft = switch mode {
                case .stake:
                    try await Api.checkStakeDraft(accountId: accountId, amount: amount, state: stakingState)
                case .unstake:
                    try await Api.checkUnstakeDraft(accountId: accountId, amount: amount, state: stakingState)
                }
                try handleDraftError(draft)
                if Task.isCancelled {
                    if self.draft == nil {
                        self.draft = draft
                    }
                    return
                }
                self.draft = draft
            } catch {
                if !Task.isCancelled {
                    topViewController()?.showAlert(error: error)
                }
                log.info("\(error)")
            }
        }
    }
}


extension StakeUnstakeModel: WalletCoreData.EventsObserver {
    public func walletCore(event: WalletCoreData.Event) {
        switch event {
        case .balanceChanged, .tokensChanged:
            updateAccountBalance()
        default:
            break
        }
    }
}

