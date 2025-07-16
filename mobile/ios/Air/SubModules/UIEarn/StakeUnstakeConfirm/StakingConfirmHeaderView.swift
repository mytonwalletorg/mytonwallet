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
import WalletCore
import WalletContext

struct StakingConfirmHeaderView: View {
    
    var amount: BigInt
    var token: ApiToken
    var isUnstaking: Bool
    
    var body: some View {
        VStack(spacing: 0) {
            iconView
                .padding(.bottom, 16)
            amountView
                .padding(.bottom, 12)
            toView
        }
        .padding(.bottom, 12)
    }
    
    @ViewBuilder
    var iconView: some View {
        WUIIconViewToken(
            token: token,
            isWalletView: false,
            showldShowChain: true,
            size: 60,
            chainSize: 24,
            chainBorderWidth: 1.5,
            chainBorderColor: WTheme.sheetBackground,
            chainHorizontalOffset: 6,
            chainVerticalOffset: 2
        )
            .frame(width: 60, height: 60)
    }
    
    @ViewBuilder
    var amountView: some View {
        let amount = DecimalAmount(amount, token)
        AmountText(
            amount: amount,
            format: .init(maxDecimals: 4, showPlus: isUnstaking),
            integerFont: .rounded(ofSize: 34, weight: .bold),
            fractionFont: .rounded(ofSize: 28, weight: .bold),
            symbolFont: .rounded(ofSize: 28, weight: .bold),
            integerColor: WTheme.primaryLabel,
            fractionColor: WTheme.primaryLabel,
            symbolColor: WTheme.secondaryLabel
        )
    }
    
    @ViewBuilder
    var toView: some View {
        Text(isUnstaking ? WStrings.Staking_ConfirmUnstake_Hint.localized : WStrings.Staking_ConfirmStake_Hint.localized)
    }
}
