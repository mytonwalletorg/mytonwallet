//
//  SentVC.swift
//  UISend
//
//  Created by Sina on 5/9/24.
//

import SwiftUI
import UIKit
import UIComponents
import WalletCore
import WalletContext

struct SentView: View {
    
    var model: SendModel
    var transferOptions: Api.SubmitTransferOptions?

    var body: some View {
        InsetList {
            VStack(spacing: 0) {
                iconView
                    .padding(.bottom, 16)
                amountView
                    .padding(.bottom, 12)
                currencyAmount
            }
            
            details
        }
        .padding(.top, 16)
    }
    
    @ViewBuilder
    var iconView: some View {
        WUIIconViewToken(
            token: model.token,
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
        if let _amount = model.amount, let token = model.token {
            let amount = DecimalAmount(-_amount, token)
            AmountText(
                amount: amount,
                format: .init(maxDecimals: 4, showMinus: true),
                integerFont: .rounded(ofSize: 34, weight: .bold),
                fractionFont: .rounded(ofSize: 28, weight: .bold),
                symbolFont: .rounded(ofSize: 28, weight: .bold),
                integerColor: WTheme.primaryLabel,
                fractionColor: WTheme.primaryLabel,
                symbolColor: WTheme.secondaryLabel
            )
        }
    }
    
    @ViewBuilder
    var currencyAmount: some View {
        if let amnt = model.amountInBaseCurrency, let amount = DecimalAmount.baseCurrency(amnt) {
            Text(amount: amount, format: .init())
                .font17h22()
                .foregroundStyle(Color(WTheme.secondaryLabel))
        }
    }
    
    @ViewBuilder
    var details: some View {
        InsetSection {
            if let transferOptions, model.addressOrDomain != transferOptions.toAddress && model.addressOrDomain.contains(".") {
                InsetCell {
                    HStack {
                        Text(WStrings.Sent_CoinsSentTo.localized)
                        Spacer()
                        Text(model.addressOrDomain)
                    }
                    .font17h22()
                }
            }
            InsetCell {
                HStack {
                    Text(WStrings.TransactionInfo_Recipient.localized)
                    Spacer()
                    TappableAddress(name: nil, resolvedAddress: model.toAddressDraft?.resolvedAddress, addressOrName: model.addressOrDomain)
                        .environmentObject(model)
                }
            }
            if let amount = model.amount, let token = model.token {
                InsetCell {
                    HStack {
                        Text(WStrings.TransactionInfo_Amount.localized)
                        Spacer()
                        let amount = DecimalAmount(amount, token)
                        Text(amount: amount, format: .init())
                    }
                    .font17h22()
                }
            }
            InsetCell {
                HStack {
                    Text(WStrings.TransactionInfo_Fee.localized)
                    Spacer()
                    let fee = model.toAddressDraft?.fee ?? 0
                    if let token = model.token, let nativeToken = token.availableChain?.nativeToken {
                        FeeView(
                            token: token,
                            nativeToken: nativeToken,
                            fee: MFee(
                                precision: .exact,
                                terms: .init(token: nil, native: fee, stars: nil),
                                nativeSum: fee
                            ),
                            explainedTransferFee: nil,
                            includeLabel: false
                        )
                    } else {
                        let amount = DecimalAmount(fee, decimals: 9, symbol: "TON")
                        Text(amount: amount, format: .init(maxDecimals: 4))
                            .font17h22()
                    }
                }
                .font17h22()
            }
            
            InsetButtonCell(action: { model.onOpenAddressInExplorer() }) {
                Text(WStrings.Send_Confirm_OpenInExplorer.localized)
                    .font17h22()
            }
            .buttonStyle(.borderless)
            
        } header: {
            Text(WStrings.TransactionInfo_Details.localized)
        } footer: {}
    }
}
