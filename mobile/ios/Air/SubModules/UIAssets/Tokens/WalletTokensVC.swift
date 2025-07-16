
import UIKit
import UIComponents
import WalletCore
import WalletContext

private let log = Log("Home-WalletTokens")


@MainActor public final class WalletTokensVC: WViewController, WalletCoreData.EventsObserver, WalletTokensViewDelegate, Sendable {
    
    private let compactMode: Bool
    private var topInset: CGFloat { compactMode ? 0 : 56 }
    
    public var tokensView: WalletTokensView { view as! WalletTokensView }
    public var onHeightChanged: ((_ animated: Bool) -> ())?
    
    private var currentAccountId: String?
    
    public init(compactMode: Bool) {
        self.compactMode = compactMode
        super.init(nibName: nil, bundle: nil)
    }
    
    @MainActor required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    public override func loadView() {
        view = WalletTokensView(compactMode: compactMode, delegate: self)
    }
    
    public override func viewDidLoad() {
        super.viewDidLoad()
        tokensView.contentInset.top = topInset
        tokensView.verticalScrollIndicatorInsets.top = topInset
        tokensView.contentOffset.y = -topInset
        updateTheme()
        WalletCoreData.add(eventObserver: self)
    }
    
    public override func viewWillAppear(_ animated: Bool) {
        updateWalletTokens(animated: false)
        super.viewWillAppear(animated)
    }
    
    public override func updateTheme() {
    }

    nonisolated public func walletCore(event: WalletCore.WalletCoreData.Event) {
        MainActor.assumeIsolated {
            switch event {
            case .accountChanged:
                updateWalletTokens(animated: true)
                tokensView.reloadStakeCells(animated: false)
                
            case .stakingAccountData(let data):
                if data.accountId == AccountStore.accountId {
                    stakingDataUpdated()
                }
                
            case .tokensChanged:
                tokensChanged()
            
            case .balanceChanged(_):
                updateWalletTokens(animated: true)
                
            default:
                break
            }
        }
    }
    
    private func stakingDataUpdated() {
        tokensView.reloadStakeCells(animated: true)
    }
    
    private func tokensChanged() {
        tokensView.reconfigureAllRows(animated: true)
    }
    
    private func updateWalletTokens(animated: Bool) {
        var animated = animated
        if let account = AccountStore.account {
            let accountId = account.id
            if accountId != currentAccountId {
                animated = false
                currentAccountId = accountId
            }
            
            if var walletTokens = BalanceStore.currentAccountBalanceData?.walletTokens {
                let count = walletTokens.count
                if compactMode {
                    walletTokens = Array(walletTokens.prefix(5))
                }
                tokensView.set(
                    walletTokens: walletTokens,
                    allTokensCount: count,
                    placeholderCount: 0,
                    animated: animated
                )
            } else {
                tokensView.set(
                    walletTokens: nil,
                    allTokensCount: 0,
                    placeholderCount: 4,
                    animated: animated
                )
            }
            self.onHeightChanged?(animated)
        }
    }
    
    public func didSelect(slug: String?) {
        guard let slug, let token = TokenStore.tokens[slug] else {
            return
        }
        AppActions.showToken(token: token, isInModal: !compactMode)
    }

    public func goToStakedPage(slug: String) {
        let token = slug == STAKED_MYCOIN_SLUG ? TokenStore.tokens[STAKED_MYCOIN_SLUG] ?? .STAKED_MYCOIN : nil
        AppActions.showEarn(token: token)
    }

    public func goToTokens() {
        AppActions.showAssets(selectedTab: 0, collectionsFilter: .none)
    }
}
