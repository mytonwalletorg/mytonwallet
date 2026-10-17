import ContextMenuKit
import UIKit
import UIComponents
import UIHome
import WalletContext
import WalletCore

/// Lives in the selected root's view, so native pushes also transition the tabs away.
@available(iOS 27.1, *)
@MainActor
final class SplitRootToolbarView: UIView {
    static let tabIds: [AppTabId] = [.wallet, .market, .explore]
    let accountButton = TopTabsAccountButton()
    let tabBar: WVerticalTabBar
    weak var navigationContainer: UIView?
    var onLayout: (() -> Void)?
    private var accountMenuInteraction: ContextMenuInteraction?

    init() {
        tabBar = WVerticalTabBar(items: Self.tabIds.compactMap { id in
            guard let registration = AppTabManager.shared.registration(for: id) else { return nil }
            return .init(id: id.rawValue, title: registration.titleProvider(), image: registration.compactIcon)
        })
        super.init(frame: .zero)
        autoresizingMask = [.flexibleWidth, .flexibleHeight]
        accountButton.translatesAutoresizingMaskIntoConstraints = true
        addSubview(accountButton)
        addSubview(tabBar)
        let interaction = ContextMenuInteraction(triggers: [.longPress]) { sourceView in
            SwitchAccountMenu.makeConfiguration(sourceView: sourceView)
        }
        interaction.attach(to: accountButton)
        accountMenuInteraction = interaction
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func layoutSubviews() {
        super.layoutSubviews()
        guard let container = navigationContainer, isDescendant(of: container) else { return }
        let isLTR = effectiveUserInterfaceLayoutDirection == .leftToRight
        let isLeft = traitCollection.verticalBarEdge == .leading ? isLTR : !isLTR
        let region = container.layoutGuide(for: .bar(onEdge: isLeft ? .left : .right, extent: 48)).layoutFrame
        guard !region.isEmpty else { return }
        let origin = convert(CGPoint(x: region.midX - 24, y: max(region.minY, container.bounds.minY + 24)), from: container)
        accountButton.frame = CGRect(origin: origin, size: CGSize(width: 48, height: 48))
        tabBar.frame = CGRect(x: origin.x, y: origin.y + 60, width: 48, height: tabBar.intrinsicContentSize.height)
        tabBar.isOnLeftEdge = isLeft
        onLayout?()
    }

    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        let hit = super.hitTest(point, with: event)
        return hit === self ? nil : hit
    }
}
