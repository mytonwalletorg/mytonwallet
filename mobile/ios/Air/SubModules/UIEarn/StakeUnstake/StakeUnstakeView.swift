
import Foundation
import SwiftUI
import UIComponents
import WalletCore
import WalletContext

struct StakeUnstakeView: View {
    
    @ObservedObject var model: StakeUnstakeModel
    var navigationBarInset: CGFloat
    var onScrollPositionChange: (CGFloat) -> ()
    
    @Namespace private var ns
    
    var body: some View {
        InsetList {
            AmountSection(model: model)
                .background {
                    GeometryReader { geom in
                        Color.clear.onChange(of: geom.frame(in: .named(ns)).origin.y) { y in
                            onScrollPositionChange(y + 2)
                        }
                    }
                }

            switch model.mode {
            case .stake:
                StakeInfoSection(model: model)
                    .padding(.top, -8)
            case .unstake:
                UnstakeInfoSection(model: model)
                    .padding(.top, -8)
            }
        }
        .padding(.top, -8)
        .coordinateSpace(name: ns)
        .navigationBarInset(navigationBarInset)
        .contentShape(.rect)
        .onTapGesture {
            model.onBackgroundTapped()
        }
        .onChange(of: model.amount) { amount in
            if let amount, model.switchedToBaseCurrencyInput == false {
                model.updateBaseCurrencyAmount(amount)
            }
        }
        .onChange(of: model.amountInBaseCurrency) { baseCurrencyAmount in
            if let baseCurrencyAmount, model.switchedToBaseCurrencyInput == true {
                model.updateAmountFromBaseCurrency(baseCurrencyAmount)
            }
        }
        .task(id: model.amount) {
            await model.updateFee()
        }
    }
}


struct AmountSection: View {
    
    @ObservedObject var model: StakeUnstakeModel
    
    var body: some View {
        TokenAmountEntrySection(
            amount: $model.amount,
            token: displayToken,
            balance: $model.accountBalance,
            insufficientFunds: model.insufficientFunds,
            amountInBaseCurrency: $model.amountInBaseCurrency,
            switchedToBaseCurrencyInput: $model.switchedToBaseCurrencyInput,
            fee: nil,
            explainedFee: model.fee,
            isFocused: $model.isAmountFieldFocused,
            onTokenSelect: nil,
            onUseAll: { model.onUseAll() }
        )
    }
    
    /// even when withdrawing "staked", show normal token
    var displayToken: ApiToken {
        if model.token.slug == STAKED_TON_SLUG {
            TokenStore.tokens["toncoin"]!
        } else if model.token.slug == STAKED_MYCOIN_SLUG {
            TokenStore.tokens[MYCOIN_SLUG]!
        } else {
            model.token
        }
    }
}


struct StakeInfoSection: View {
    
    @ObservedObject var model: StakeUnstakeModel
    
    var body: some View {
        InsetSection {
            InsetCell {
                HStack {
                    Text(WStrings.StakeUnstake_CurrentAPY.localized)
                        .font17h22()
                    Spacer()
                    apyBadge
                }
                .padding(.top, -1)
                .padding(.bottom, -1)
            }
            InsetCell {
                HStack {
                    Text(WStrings.StakeUnstake_EstimatedEarningPerYear.localized)
                        .font17h22()
                    Spacer()
                    estEarning
                }
                .padding(.top, -1)
            }
            InsetButtonCell(action: { model.onWhyIsSafe?() }) {
                Text(WStrings.Earn_WhyStakingIsSafe.localized)
                    .font17h22()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .tint(Color(WTheme.tint))
                    .padding(.top, -1)
            }
        } header: {
            Text(WStrings.StakeUnstake_StakingDetails.localized)
        } footer: {}
    }
    
    @ViewBuilder
    var apyBadge: some View {
        let v = formatAmountText(amount: model.apy)
        Text("\(v)%")
            .fontWeight(.medium)
            .font(.callout)
            .lineSpacing(3)
            .padding(.top, 2.66)
            .padding(.bottom, 2.66)
            .padding(.horizontal, 6)
            .foregroundStyle(Color(WTheme.background))
            .background {
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(gradient)
            }
    }
    
    @ViewBuilder
    var estEarning: some View {
        estEarningText
            .fontWeight(.medium)
            .font17h22()
            .foregroundStyle(gradient)
    }
    
    var estEarningText: Text {
        if model.switchedToBaseCurrencyInput {
            let cur = model.amountInBaseCurrency ?? 0
            let income = cur * BigInt(model.apy * 1000) / 1000 / 100
            return Text(amount: DecimalAmount.baseCurrency(income)!, format: .init(showPlus: true))
        } else {
            let amnt = (model.amount ?? 0)
            let income = amnt * BigInt(model.apy * 1000) / 1000 / 100
            return Text(amount: TokenAmount(income, model.token), format: .init(showPlus: true))
        }
    }
    
    var gradient: LinearGradient {
        LinearGradient(colors: [
            Color("EarnGradientColorLeft", bundle: AirBundle),
            Color("EarnGradientColorRight", bundle: AirBundle),
        ], startPoint: .leading, endPoint: .trailing)
    }
}


struct UnstakeInfoSection: View {
    
    @ObservedObject var model: StakeUnstakeModel
    
    var body: some View {
        InsetSection {
            InsetCell {
                HStack {
                    Text(WStrings.StakeUnstake_ReceivingLabel.localized)
                        .font17h22()
                        .foregroundStyle(Color(WTheme.secondaryLabel))
                    Spacer()
                    receivingBadge
                }
            }
            if model.stakingState.type == .liquid {
                InsetCell {
                    HStack {
                        Text(WStrings.StakeUnstake_InstantWithdrawalLabel.localized)
                            .font17h22()
                            .foregroundStyle(Color(WTheme.secondaryLabel))
                        Spacer()
                        Text(WStrings.StakeUnstake_InstantWithdrawalInfo.localized)
                    }
                    .padding(.top, -1)
                }
            }
        } header: {
            Text(WStrings.StakeUnstake_UnstakingDetails.localized)
        } footer: {}
    }
    
    
    @ViewBuilder
    var receivingBadge: some View {
        switch model.withdrawalType {
        case .loading:
            ProgressView().progressViewStyle(.circular)
        case .instant:
            HStack(spacing: 4) {
                Image(systemName: "bolt.fill")
                    .foregroundStyle(gradient)
                    .imageScale(.small)
                Text(WStrings.StakeUnstake_ReceivingInfo_Instantly.localized)
            }
        case .timed(let remaining):
            HStack(spacing: 4) {
                Image(systemName: "clock.fill")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(Color(WTheme.secondaryLabel))
                    .imageScale(.small)
                Text(formatTimeToWait(remaining))
            }

        }
    }
    
    var gradient: LinearGradient {
        LinearGradient(colors: [
            Color("EarnGradientColorLeft", bundle: AirBundle),
            Color("EarnGradientColorRight", bundle: AirBundle),
        ], startPoint: .top, endPoint: .bottom)
    }

    func formatTimeToWait(_ remaining: TimeInterval) -> String {
        return Duration.seconds(remaining).formatted(.units(
            allowed: [.hours, .minutes],
            width: .wide,
            maximumUnitCount: 2,
            fractionalPart: .hide
        ))
    }
 }
