
import SwiftUI
import WalletContext


struct WarningView: View {
    
    var text: String
    
    var body: some View {
        Text(text)
            .multilineTextAlignment(.leading)
            .foregroundStyle(Color(WTheme.error))
//            .font13()
            .font14h18()
            .padding(.bottom, 2)
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .frame(maxWidth: .infinity, alignment: .leading)
            .fixedSize(horizontal: false, vertical: true)
            .overlay(alignment: .leading) {
                Rectangle()
                    .fill(Color(WTheme.error))
                    .frame(width: 4)
            }
            .background(Color(WTheme.error).opacity(0.1))
            .clipShape(.rect(cornerRadius: 10))
    }
}
