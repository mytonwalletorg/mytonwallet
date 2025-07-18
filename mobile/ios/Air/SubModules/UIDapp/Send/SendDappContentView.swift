
import SwiftUI
import UIKit
import UIPasscode
import UIComponents
import WalletCore
import WalletContext


struct SendDappContentView: View {
    
    var request: MDappSendTransactions
    var onShowDetail: (ApiDappTransfer) -> ()
    
    var body: some View {
        if request.transactions.count == 1, let tx = request.transactions.first {
            SendTransactionRequestMessageView(message: tx)
        } else {
            list
        }
    }
    
    var list: some View {
        InsetSection {
            ForEach(request.transactions, id: \.self) { tx in
                TransferRow(transfer: tx, action: onShowDetail)
            }
        }
    }
}


struct TransferRow: View {
    
    var transfer: ApiDappTransfer
    var action: (ApiDappTransfer) -> ()
    
    var body: some View {
        InsetButtonCell(alignment: .leading, verticalPadding: 4, action: { action(transfer) }) {
            HStack(spacing: 16) {
                icon
                VStack(alignment: .leading, spacing: 2) {
                    text
                    subtitle
                        .font13()
                }
                Spacer()
                Image.airBundle("RightArrowIcon")
                    .foregroundStyle(Color(WTheme.secondaryLabel))
            }
            .foregroundStyle(Color(WTheme.primaryLabel))
        }
    }
    
    @ViewBuilder
    var icon: some View {
        WUIIconViewToken(
            token: .TONCOIN,
            isWalletView: false,
            showldShowChain: true,
            size: 28,
            chainSize: 12,
            chainBorderWidth: 0.667,
            chainBorderColor: WTheme.groupedItem,
            chainHorizontalOffset: 3,
            chainVerticalOffset: 1
        )
            .frame(width: 30, height: 28, alignment: .leading)

    }
    
    @ViewBuilder
    var text: some View {
        let amount = TokenAmount(transfer.amount, .TONCOIN)
        AmountText(
            amount: amount,
            format: .init(maxDecimals: 4, showMinus: true),
            integerFont: .systemFont(ofSize: 24, weight: .semibold),
            fractionFont: .systemFont(ofSize: 20, weight: .semibold),
            symbolFont: .systemFont(ofSize: 20, weight: .semibold),
            integerColor: WTheme.primaryLabel,
            fractionColor: WTheme.primaryLabel,
            symbolColor: WTheme.secondaryLabel
        )
    }
    
    @ViewBuilder
    var subtitle: some View {
        Text("To: " + formatStartEndAddress(transfer.toAddress))
            .font(.footnote)
    }
}

