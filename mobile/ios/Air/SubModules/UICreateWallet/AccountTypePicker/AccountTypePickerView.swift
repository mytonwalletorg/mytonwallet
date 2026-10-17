import SwiftUI
import WalletContext
import WalletCore
import UIComponents
import Perception

enum AccountTypePickerAuthorizationAction: Equatable {
    case createWallet
    case createSubwallet
    case importWallet
}

@Perceptible @MainActor
final class AccountTypePickerAuthorizationState {
    private(set) var action: AccountTypePickerAuthorizationAction?

    var isAuthorizing: Bool {
        action != nil
    }

    @discardableResult
    func begin(_ action: AccountTypePickerAuthorizationAction) -> Bool {
        guard self.action == nil else { return false }
        self.action = action
        return true
    }

    func reset() {
        action = nil
    }
}

struct AccountTypePickerView: View {

    var network: ApiNetwork
    var authorizationState: AccountTypePickerAuthorizationState
    var onHeightChange: (CGFloat) -> ()
    var onCreate: () -> ()
    var onCreateSubwallet: () -> ()
    var onImport: () -> ()
    var onViewAddress: () -> ()
    var onLedger: () -> ()

    var body: some View {
        WithPerceptionTracking {
            ScrollView {
                VStack(spacing: 0) {
                    InsetSection(addDividers: false) {
                        WalletPickerOptionRow(
                            icon: "CreateWalletIcon30",
                            title: lang("New Wallet"),
                            subtitle: lang("From new secret words"),
                            showsDivider: canCreateSubwallet,
                            isLoading: authorizationState.action == .createWallet,
                            accessibilityId: "add_wallet_create",
                            onTap: onCreate
                        )

                        if canCreateSubwallet {
                            WalletPickerOptionRow(
                                icon: "NewSubwalletIcon30",
                                title: lang("New Subwallet"),
                                subtitle: lang("From current secret words"),
                                isLoading: authorizationState.action == .createSubwallet,
                                accessibilityId: "add_wallet_subwallet",
                                onTap: onCreateSubwallet
                            )
                        }
                    }

                    WalletPickerSectionTitle()

                    InsetSection(addDividers: false) {
                        WalletPickerOptionRow(
                            icon: "KeyIcon30",
                            title: lang("$secret_words"),
                            subtitle: localizedIntegerDigits(in: lang("Restore wallet from 12 or 24 words")),
                            showsDivider: network == .mainnet,
                            isLoading: authorizationState.action == .importWallet,
                            accessibilityId: "add_wallet_secret_words",
                            onTap: onImport
                        )
                        if network == .mainnet {
                            WalletPickerOptionRow(
                                icon: "LedgerIcon30",
                                title: lang("Ledger"),
                                subtitle: lang("Connect your hardware wallet"),
                                accessibilityId: "add_wallet_ledger",
                                onTap: onLedger
                            )
                        }
                    }

                    InsetSection(addDividers: false) {
                        WalletPickerOptionRow(
                            icon: "ViewIcon30",
                            title: lang("View Any Address"),
                            subtitle: lang("Watch wallet in read-only mode"),
                            accessibilityId: "add_wallet_view",
                            onTap: onViewAddress
                        )
                    }
                    .padding(.top, 24)
                }
                .padding(.top, 20)
                .padding(.bottom, 24)
                .allowsHitTesting(!authorizationState.isAuthorizing)
                .onGeometryChange(for: CGFloat.self, of: \.size.height) { height in
                    onHeightChange(height)
                }
            }
            .ignoresSafeArea(.container, edges: .bottom)
            .backportScrollBounceBehaviorBasedOnSize()
        }
    }

    private var canCreateSubwallet: Bool {
        guard let account = AccountStore.account, account.type == .mnemonic, account.network == network else {
            return false
        }

        return account.orderedChains.contains { chain, _ in
            account.supportsSubwallets(on: chain)
        }
    }

}
