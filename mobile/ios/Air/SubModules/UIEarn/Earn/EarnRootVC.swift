
import SwiftUI
import UIKit
import UIComponents
import WalletCore
import WalletContext


@MainActor
public class EarnRootVC: WViewController, WSegmentedController.Delegate {
    
    public let onlyToken: ApiToken?
    public let customTitle: String?
    
    private var tonVC: EarnVC!
    private var mycoinVC: EarnVC!
    
    private var segmentedController: WSegmentedController!
    private var progress: CGFloat = 0
    
    private var segmentedControlItems: [SegmentedControlItem] = [
        SegmentedControlItem(index: 0, id: "TON", content: AnyView(Text("TON"))),
        SegmentedControlItem(index: 0, id: "MY", content: AnyView(Text("MY"))),
    ]
    
    public init(token: ApiToken? = nil, title: String? = nil) {
        self.onlyToken = token
        self.customTitle = title
        super.init(nibName: nil, bundle: nil)
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    public override func loadView() {
        super.loadView()
        setupViews()
    }
    
    func setupViews() {
        view.backgroundColor = WTheme.sheetBackground
      
        tonVC = EarnVC(earnVM: .sharedTon)
        mycoinVC = EarnVC(earnVM: .sharedMycoin)

        addChild(tonVC)
        addChild(mycoinVC)
        
        let capsuleColor = UIColor { WTheme.secondaryLabel.withAlphaComponent($0.userInterfaceStyle == .dark ? 0.2 : 0.12 ) }
        segmentedController = WSegmentedController(viewControllers: [tonVC, mycoinVC],
                                                   defaultIndex: onlyToken?.slug == STAKED_MYCOIN_SLUG ? 1 : 0,
                                                   barHeight: 56.333,
                                                   animationSpeed: .slow,
                                                   capsuleFillColor: capsuleColor,
                                                   delegate: self)
        
        segmentedController.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(segmentedController)
        NSLayoutConstraint.activate([
            segmentedController.topAnchor.constraint(equalTo: view.topAnchor),
            segmentedController.leftAnchor.constraint(equalTo: view.leftAnchor),
            segmentedController.rightAnchor.constraint(equalTo: view.rightAnchor),
            segmentedController.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
        segmentedController.backgroundColor = .clear
        segmentedController.blurView.isHidden = true
        segmentedController.separator.isHidden = true
        
        view.bringSubviewToFront(segmentedController)
        
        let navigationBar = WNavigationBar(navHeight: 60, title: title, titleColor: .white, closeIcon: true, closeIconColor: WTheme.secondaryLabel, closeIconFillColor: capsuleColor)
        self.navigationBar = navigationBar
        navigationBar.blurView.isHidden = true
        navigationBar.shouldPassTouches = true
        navigationBar.backgroundColor = .clear
        view.addSubview(navigationBar)
        NSLayoutConstraint.activate([
            navigationBar.topAnchor.constraint(equalTo: view.topAnchor),
            navigationBar.leftAnchor.constraint(equalTo: view.leftAnchor),
            navigationBar.rightAnchor.constraint(equalTo: view.rightAnchor)
        ])

        updateWithStakingState()

        updateTheme()

        WalletCoreData.add(eventObserver: self)
    }

    func updateWithStakingState() {
        let twoTabs = true
        segmentedController.scrollView.isScrollEnabled = twoTabs
        let title: String? = twoTabs ? nil : (customTitle ?? WStrings.Receive_Title.localized)
        navigationBar?.set(title: title)
        
        if StakingStore.currentAccount?.mycoinState == nil {
            segmentedController.replace(viewControllers: [tonVC], items: [segmentedControlItems[0]])
        } else {
            segmentedController.replace(viewControllers: [tonVC, mycoinVC], items: segmentedControlItems)
        }
    }
    
    public override func updateTheme() {
        view.backgroundColor = WTheme.sheetBackground
        segmentedController.updateTheme()
    }
    
    public override var hideNavigationBar: Bool { true }
    
    public override func scrollToTop() {
        segmentedController?.scrollToTop()
    }
    
    public func switchToTokensTab() {
        segmentedController?.switchTo(tabIndex: 0)
    }
    
    public func segmentedController(scrollOffsetChangedTo progress: CGFloat) {
        self.progress = progress
    }
    
    public func segmentedControllerDidStartDragging() {
    }
    
    public func segmentedControllerDidEndScrolling() {
    }
}

extension EarnRootVC: WalletCoreData.EventsObserver {
    public func walletCore(event: WalletCoreData.Event) {
        switch event {
        case .accountChanged:
            updateWithStakingState()
        case .stakingAccountData(let data):
            if data.accountId == AccountStore.accountId {
                updateWithStakingState()
            }
        default:
            break
        }
    }
}
