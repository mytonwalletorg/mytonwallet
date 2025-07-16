
import Combine
import SwiftUI
import UIKit
import UIComponents
import WalletCore
import WalletContext


struct SwapChangellyView: View {
    
    var body: some View {
        InsetSection {
            InsetCell {
                VStack(alignment: .leading, spacing: 7) {
                    header
                        .padding(.top, 1)
                    text
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.bottom, 1)
                        .environment(\.openURL, OpenURLAction { url in
                            topViewController()?.view.endEditing(true)
                            AppActions.openInBrowser(url, title: nil, injectTonConnect: false)
                            return .handled
                        })
                }
            }
        } header: {} footer: {}
            .font(.footnote)
            .multilineTextAlignment(.leading)
            .padding(.horizontal, -16)
    }
    
    var header: some View {
        HStack(spacing: 2) {
            Text(WStrings.Swap_CrossChainSwapBy.localized)
            Image("SwapChangellyLogo", bundle: AirBundle)
        }
        .foregroundStyle(Color(WTheme.secondaryLabel))
    }
    
    var text: some View {
        let paragraphStyle = NSMutableParagraphStyle()
        paragraphStyle.lineSpacing = 2
        let crossChainDetailsAttributedString = NSMutableAttributedString(string: WStrings.Swap_CrossChainDetails.localized, attributes: [
            .font: UIFont.systemFont(ofSize: 13),
            .foregroundColor: WTheme.primaryLabel,
            .paragraphStyle: paragraphStyle,
        ])
        // Highlight specified terms
        let highlightLinks = WStrings.Swap_CrossChainHighlightLinks.localized.components(separatedBy: "|")
        for (i, highlight) in WStrings.Swap_CrossChainHighlights.localized.components(separatedBy: "|").enumerated() {
            let range = (crossChainDetailsAttributedString.string as NSString).range(of: highlight)
            crossChainDetailsAttributedString.addAttribute(.foregroundColor, value: WTheme.primaryButton.background, range: range)
            crossChainDetailsAttributedString.addAttribute(.link, value: highlightLinks[i], range: range)
        }
        
        return Text(crossChainDetailsAttributedString).lineSpacing(3)
    }
}
