import Combine
import SwiftUI
import WalletContext
import WalletCore

public struct TokenHeroView: View {
    public static func showsDiamond(for token: ApiToken) -> Bool {
        showsDiamond(for: token, isGramWallet: IS_GRAM_WALLET, rendererAvailable: TelegramDiamondView.isAvailable)
    }

    static func showsDiamond(for token: ApiToken, isGramWallet: Bool, rendererAvailable: Bool) -> Bool {
        isGramWallet && token.slug == TONCOIN_SLUG && rendererAvailable
    }

    private let token: ApiToken
    private let size: CGFloat
    private let shouldShowChain: Bool
    private let allowsDiamond: Bool

    public init(token: ApiToken, size: CGFloat = 60, shouldShowChain: Bool = true, allowsDiamond: Bool = true) {
        self.token = token
        self.size = size
        self.shouldShowChain = shouldShowChain
        self.allowsDiamond = allowsDiamond
    }

    public var body: some View {
        if allowsDiamond && Self.showsDiamond(for: token) {
            TelegramDiamondView(size: size)
        } else {
            WUIIconViewToken(token: token, isWalletView: false, showldShowChain: shouldShowChain,
                size: size, chainSize: 22, chainBorderWidth: 1.5,
                chainHorizontalOffset: 6, chainVerticalOffset: 2)
                .frame(width: size, height: size)
        }
    }
}

/// UIKit counterpart for the scrolling token header.
public final class TokenHeroIconView: UIView {
    private let icon: IconView
    private let diamond: TelegramDiamondContainerView
    private var observations: Set<AnyCancellable> = []
    private var showsDiamond = false
    private var renderingVisible = true

    public init(size: CGFloat) {
        icon = IconView(size: size)
        diamond = TelegramDiamondContainerView(size: size)
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false
        addSubview(icon)
        addSubview(diamond)
        icon.setChainSize(24, borderWidth: 1.5, horizontalOffset: 5, verticalOffset: 1.5)
        NSLayoutConstraint.activate([
            widthAnchor.constraint(equalToConstant: size),
            heightAnchor.constraint(equalToConstant: size),
        ])
        let environment = CardBackgroundAnimationEnvironment.shared
        environment.objectWillChange.sink { [weak self] in
            DispatchQueue.main.async { self?.updatePlayback() }
        }.store(in: &observations)
        environment.willSuspend.sink { [weak self] in
            self?.diamond.configure(active: false)
        }.store(in: &observations)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    public override func layoutSubviews() {
        super.layoutSubviews()
        icon.frame = bounds
        diamond.frame = bounds
    }

    public override func didMoveToWindow() {
        super.didMoveToWindow()
        updatePlayback()
    }

    public func configure(token: ApiToken) {
        showsDiamond = TokenHeroView.showsDiamond(for: token)
        isUserInteractionEnabled = showsDiamond
        icon.config(with: token, isStaking: false, isWalletView: false, shouldShowChain: true)
        icon.isHidden = showsDiamond
        diamond.isHidden = !showsDiamond
        updatePlayback()
    }

    public func setRenderingVisible(_ visible: Bool) {
        renderingVisible = visible
        updatePlayback()
    }

    private func updatePlayback() {
        let environment = CardBackgroundAnimationEnvironment.shared
        diamond.configure(active: showsDiamond && renderingVisible && window != nil && environment.applicationActive,
            animated: environment.diamondAnimationsEnabled)
    }
}
