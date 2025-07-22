//
//  StakingVC.swift
//  UIEarn
//
//  Created by Sina on 5/13/24.
//

import Foundation
import SwiftUI
import UIKit
import UIComponents
import Ledger
import WalletCore
import WalletContext
import UIPasscode

fileprivate let MINIMUM_REQUIRED_AMOUNT_TON = BigInt(3 * ONE_TON + (ONE_TON / 10))
fileprivate let calculatedFee = BigInt(15_000_000)
fileprivate let MAX_INSTANT = 200 * ONE_TON


public class StakeUnstakeVC: WViewController, WalletCoreData.EventsObserver {

    public enum Mode {
        case stake
        case unstake
    }
    let mode: Mode
    let model: StakeUnstakeModel
    
    var stakingState: ApiStakingState { model.stakingState }
    
    var fakeTextField = UITextField(frame: .zero)
    private var continueButton: WButton { self.bottomButton! }
    private var taskError: BridgeCallError? = nil
    
    public init(stakingStateProvider: @escaping () -> ApiStakingState, baseToken: ApiToken, stakedToken: ApiToken, mode: Mode) {
        self.mode = mode
        self.model = StakeUnstakeModel(stakingStateProvider: stakingStateProvider, baseToken: baseToken, stakedToken: stakedToken, mode: mode)
        
        super.init(nibName: nil, bundle: nil)
        
        model.onAmountChanged = { [weak self] amount in
            self?.amountChanged(amount: amount)
        }
        model.onWhyIsSafe = { [weak self] in
            self?.view.endEditing(true)
            showWhyIsSafe()
        }
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    
    public func walletCore(event: WalletCoreData.Event) {
        switch event {
        case .stakingAccountData(let data):
            if data.accountId == AccountStore.accountId {
                model.objectWillChange.send()
            }
        case .accountChanged:
            model.objectWillChange.send()
        default:
            break
        }
    }
    
    public override func viewDidLoad() {
        super.viewDidLoad()
        setupViews()
        
        // observe keyboard events
//        WKeyboardObserver.observeKeyboard(delegate: self)
    }
    
    private func setupViews() {
        
        title = model.mode == .stake ? WStrings.Staking_AddStake.localized : WStrings.Staking_Unstake.localized
        addNavigationBar(
            topOffset: 1,
            title: title,
            closeIcon: true,
            addBackButton: { [weak self] in
                self?.view.endEditing(true)
                self?.navigationController?.popViewController(animated: true)
            }
        )

        let hostingController = addHostingController(
            StakeUnstakeView(
                model: model,
                navigationBarInset: navigationBarHeight,
                onScrollPositionChange: { [weak self] y in
                    self?.navigationBar?.showSeparator = y < 0
                }
            ),
            constraints: { [self] v in
                NSLayoutConstraint.activate([
                    v.leadingAnchor.constraint(equalTo: view.leadingAnchor),
                    v.trailingAnchor.constraint(equalTo: view.trailingAnchor),
                    v.topAnchor.constraint(equalTo: view.topAnchor),
                    v.bottomAnchor.constraint(equalTo: view.bottomAnchor),
                ])
            }
        )
        hostingController.view.backgroundColor = WTheme.sheetBackground
        
        _ = addBottomButton()
        let title: String = switch (model.mode, model.baseToken.slug) {
        case (.stake, TONCOIN_SLUG):
            WStrings.Staking_StakeTON.localized
        case (.unstake, TONCOIN_SLUG):
            WStrings.Staking_UnstakeTON.localized
        case (.stake, MYCOIN_SLUG):
            WStrings.Staking_StakeMY.localized
        case (.unstake, MYCOIN_SLUG):
            WStrings.Staking_UnstakeMY.localized
        default: ""
        }
        continueButton.setTitle(title, for: .normal)
        continueButton.addTarget(self, action: #selector(continuePressed), for: .touchUpInside)
        continueButton.isEnabled = false
        
        fakeTextField.keyboardType = .decimalPad
        if #available(iOS 18.0, *) {
            fakeTextField.writingToolsBehavior = .none
        }
        view.addSubview(fakeTextField)
        
        bringNavigationBarToFront()

        updateTheme()
        
        amountChanged(amount: nil)
    }
    
    public override func viewDidAppear(_ animated: Bool) {
        model.isAmountFieldFocused = true
    }
    
    public override func updateTheme() {
    }
    
    func amountChanged(amount: BigInt?) {
        
        guard let amount = amount, let availableBalance = model.accountBalance else {
            continueButton.isEnabled = false
            return
        }
        
        let minAmount = getStakingMinAmount(type: stakingState.type)
        var usingAmount = amount
        if model.mode == .stake && amount == availableBalance {
            usingAmount = amount - calculatedFee
        }
        let powedAmount = usingAmount
//        let fee = getFee(mode == .stake ? .)
        
        if model.mode == .stake && powedAmount < minAmount { // Insufficient min amount for staking
            model.insufficientFunds = true
            let symbol = model.baseToken.symbol
            continueButton.setTitle("Minimum 1 \(symbol)", for: .normal)
            continueButton.isEnabled = false
        } else if powedAmount /*+ (model.mode == .stake ? calculatedFee : 0)*/ > availableBalance {
            model.insufficientFunds = true
            let symbol = model.baseToken.symbol
            continueButton.setTitle("Insufficient \(symbol) Balance", for: .normal)
            continueButton.isEnabled = false
//        } else if model.mode == .stake && powedAmount >= minAmount && powedAmount < 2 * ONE_TON && !model.shouldRenderBalanceWithSmallFee {
//            model.insufficientFunds = true
//            continueButton.setTitle(WStrings.Staking_InsufficientFeeAmount_Text(amount: minAmount.doubleAbsRepresentation(decimals: 9)), for: .normal)
//            continueButton.isEnabled = false
        } else {
            model.insufficientFunds = false
            let title: String = switch (model.mode, model.baseToken.slug) {
            case (.stake, TONCOIN_SLUG):
                WStrings.Staking_StakeTON.localized
            case (.unstake, TONCOIN_SLUG):
                WStrings.Staking_UnstakeTON.localized
            case (.stake, MYCOIN_SLUG):
                WStrings.Staking_StakeMY.localized
            case (.unstake, MYCOIN_SLUG):
                WStrings.Staking_UnstakeMY.localized
            default: ""
            }
            continueButton.setTitle(title, for: .normal)
            continueButton.isEnabled = amount > 0
        }
        
        // when withdrawal?
        if model.mode == .unstake {
            if amount <= model.stakingState.instantAvailable {
                model.withdrawalType = .instant
            } else {
                let remaining: TimeInterval?
                if case .liquid(let liquid) = model.stakingState,
                   liquid.isUnstakeRequested == true,
                   liquid.unstakeRequestAmount > 0 {
                    let roundEnd = liquid.end
                    let waitUntil = Date(timeIntervalSince1970: Double(roundEnd) / 1000)
                    remaining = waitUntil.timeIntervalSinceNow
                } else {
                    remaining = nil
                }
                model.withdrawalType = remaining.flatMap { .timed($0) } ?? .instant
            }
        }
    }
    
    @objc func continuePressed() {
        view.endEditing(true)
        guard let account = AccountStore.account else { return }
        Task {
            do {
                try await confirmAction(account: account)
            } catch {
                showAlert(error: error)
            }
        }
    }
    
    func confirmAction(account: MAccount) async throws {
        let headerView = StakingConfirmHeaderView(
            mode: self.mode == .stake ? .stake : .unstake,
            tokenAmount: TokenAmount(model.amount ?? 0, TokenStore.tokens[model.baseToken.slug]!),
        )
        let headerVC = UIHostingController(rootView: headerView)
        headerVC.view.backgroundColor = .clear
        
        self.taskError = nil
        
        let onDone: () -> () = { [weak self] in
                guard let self else { return }
                
                if let taskError {
                    showAlert(error: taskError) { [weak self] in
                        guard let self else { return }
                        navigationController?.popViewController(animated: true)
                    }
                } else {
                    navigationController?.popToRootViewController(animated: true)
                }
        }
        let title = model.mode == .stake ? WStrings.Staking_ConfirmStake_Title.localized : WStrings.Staking_ConfirmUnstake_Title.localized
        if account.isHardware {
            try await confirmLedger(account: account, title: title, headerView: headerView, onDone: onDone)
        } else {
            confirmMnemonic(account: account, title: title, headerVC: headerVC, onDone: onDone)
        }
    }
    
    func confirmMnemonic(account: MAccount, title: String, headerVC: UIHostingController<StakingConfirmHeaderView>, onDone: @escaping () -> ()) {
        
        UnlockVC.pushAuth(on: self,
                          title: title,
                          customHeaderVC: headerVC,
                          onAuthTask: { [weak self] passcode, onTaskDone in
            guard let self else { return }
            
            Task {
                do {
                    switch self.mode {
                    case .stake:
                        // Stake TON!
                        var usingAmount = self.model.amount!
                        if usingAmount == self.model.accountBalance {
                            usingAmount -= calculatedFee
                        }
                        _ = try await Api.submitStake(accountId: account.id, password: passcode, amount: usingAmount, state: self.model.stakingState, realFee: nil)
                        
                    case .unstake:
                        let draft = if let draft = self.model.draft {
                            draft
                        } else {
                            try await Api.checkUnstakeDraft(accountId: account.id, amount: self.model.amount!, state: self.model.stakingState)
                        }
                        let tokenAmount = try draft.tokenAmount.orThrow("Failed to check transaction draft")
                        _ = try await Api.submitUnstake(accountId: account.id, password: passcode, amount: tokenAmount, state: self.model.stakingState, realFee: nil)
                    }
                } catch {
                    self.taskError = .customMessage("\(error)", nil)
                }
                onTaskDone()
            }
            
        }, onDone: { _ in onDone() })
    }
    
    func confirmLedger(account: MAccount, title: String, headerView: StakingConfirmHeaderView, onDone: @escaping () -> ()) async throws {
        guard
            let account = AccountStore.account,
            let fromAddress = account.tonAddress?.nilIfEmpty,
            let ledger = account.ledger
        else { return }
        
        var usingAmount = self.model.amount!
        if mode == .stake && usingAmount == self.model.accountBalance {
            usingAmount -= calculatedFee
        }
        if mode == .unstake {
            let draft = if let draft = self.model.draft {
                draft
            } else {
                try await Api.checkUnstakeDraft(accountId: account.id, amount: self.model.amount!, state: self.model.stakingState)
            }
            usingAmount = try draft.tokenAmount.orThrow("Failed to check transaction draft")
            
        }
        
        let signModel = await LedgerSignModel(
            accountId: account.id,
            fromAddress: fromAddress,
            ledger: ledger,
            signData: SignData.staking(
                isStaking: model.mode == .stake,
                accountId: account.id,
                amount: usingAmount,
                stakingState: self.model.stakingState
            )
        )
        let vc = LedgerSignVC(
            model: signModel,
            title: WStrings.SendConfirm_ConfirmSend.localized,
            headerView: headerView
        )
        vc.onDone = { _ in onDone() }
        navigationController?.pushViewController(vc, animated: true)
    }
}
