
import UIKit
import WalletCore
import WalletContext


public func makeAddAccountActions(
    createNew: @escaping () -> (),
    importWallet: @escaping () -> (),
    connectLedger: @escaping () -> (),
    viewAnyAddress: @escaping () -> ()
) -> UIAlertController {
    let alert = UIAlertController()
    alert.addAction(
        UIAlertAction(
            title: WStrings.SwitchAccount_CreateNewWallet.localized,
            style: .default,
            handler: { _ in createNew() }
        )
    )
    alert.addAction(
        UIAlertAction(
            title: WStrings.SwitchAccount_ImportWallet.localized,
            style: .default,
            handler: { _ in importWallet() }
        )
    )
    alert.addAction(
        UIAlertAction(
            title: WStrings.SwitchAccount_LedgerConnect.localized,
            style: .default,
            handler: { _ in connectLedger() }
        )
    )
    alert.addAction(
        UIAlertAction(
            title: "View Any Address",
            style: .default,
            handler: { _ in viewAnyAddress() }
        )
    )
    alert.addAction(
        UIAlertAction(
            title: WStrings.SwitchAccount_Cancel.localized,
            style: .cancel,
            handler: nil
        )
    )
    return alert
}
