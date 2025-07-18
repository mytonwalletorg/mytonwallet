
import SwiftUI
import UIKit
import UIPasscode
import UIComponents
import WalletCore
import WalletContext



class DappSendTransactionDetailVC: WViewController {
    
    private let message: ApiDappTransfer
    
    init(message: ApiDappTransfer) {
        self.message = message
        super.init(nibName: nil, bundle: nil)
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    var hostingController: UIHostingController<DappSendTransactionDetailView>? = nil
    
    public override func loadView() {
        super.loadView()
        setupViews()
    }
    
    func makeView() -> DappSendTransactionDetailView {
        return DappSendTransactionDetailView(message: message, onScroll: { [weak self] y in self?.updateNavigationBarProgressiveBlur(y) })
    }
    
    private func setupViews() {
        
        addNavigationBar(title: WStrings.Asset_Title.localized,
                         addBackButton: { [weak self] in self?.navigationController?.popViewController(animated: true) })
        navigationBarProgressiveBlurDelta = 10
        
        self.hostingController = addHostingController(makeView(), constraints: .fill)

        bringNavigationBarToFront()
        
        updateTheme()
    }
    
    public override func updateTheme() {
        view.backgroundColor = WTheme.sheetBackground
    }
}
