
import SwiftUI
import UIKit
import UIPasscode
import UIComponents
import WalletCore
import WalletContext


struct DappSendTransactionDetailView: View {
    
    var message: ApiDappTransfer
    var onScroll: (CGFloat) -> ()
    
    var body: some View {
        SendTransactionRequestMessageView(message: message)
            .navigationBarInset(60)
    }
}
