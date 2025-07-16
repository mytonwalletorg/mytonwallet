
import SwiftUI
import UIKit
import UIPasscode
import UIComponents
import WalletCore
import WalletContext


struct SendTransactionRequestMessageView: View {
    
    var message: ApiDappTransfer
    
    var body: some View {
        InsetList(topPadding: 0, spacing: 16) {
            VStack(alignment: .leading, spacing: 0) {
                Text(WStrings.TonConnect_ReceivingAddress.localized)
                    .font13()
                    .textCase(.uppercase)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 5)
                    
                ZStack {
                    Color(WTheme.groupedItem)
                    TappableAddressFull(address: message.toAddress)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.vertical, 1)
                        .padding(.vertical, 11)
                        .padding(.horizontal, 16)
                }
                .clipShape(.rect(cornerRadius: 10, style: .continuous))
            }
            .padding(.horizontal, 16)
            
            InsetSection {
                AmountCell(amount: message.amount, token: TokenStore.tokens["toncoin"]!)
            } header: {
                Text(WStrings.Send_Amount.localized)
            }
            
            if let payload = message.rawPayload {
                InsetSection {
                    InsetExpandableCell(content: payload)
                } header: {
                    Text(WStrings.TonConnect_Payload.localized)
                }
            }
            
            if let stateInit = message.stateInit {
                InsetSection {
                    InsetExpandableCell(content: stateInit)
                } header: {
                    Text(WStrings.TonConnect_StateInit.localized)
                }
            }
        }
    }
}
