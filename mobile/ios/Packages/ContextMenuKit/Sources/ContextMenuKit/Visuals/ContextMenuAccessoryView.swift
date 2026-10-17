import UIKit

@MainActor
final class ContextMenuAccessoryView: UIView {
    private static let legacyShadowRadius: CGFloat = 12.0
    private static let legacyShadowOffset = CGSize(width: 0.0, height: 4.0)

    private let capsules: [CGRect]
    // Native glass merges the capsules that overlap into one shape, while the ones apart stay apart
    private let glassContainer = ContextMenuGlassContainerView(spacing: 0.0)
    private let backgroundViews: [ContextMenuGlassBackgroundView]
    private let glassTint: ContextMenuGlassTint
    private let isRightToLeft: Bool
    private let contentView: UIView

    init(
        capsules: [CGRect],
        contentView: UIView,
        glassTint: ContextMenuGlassTint,
        sourceUserInterfaceLayoutDirection: UIUserInterfaceLayoutDirection
    ) {
        self.capsules = capsules
        // The pre-glass material is one view cut to the capsules' union, so overlapping capsules are not tinted twice
        self.backgroundViews = ContextMenuVisuals.supportsNativeGlass || capsules.isEmpty
            ? capsules.map { _ in ContextMenuGlassBackgroundView() }
            : [ContextMenuGlassBackgroundView()]
        self.glassTint = glassTint
        self.isRightToLeft = sourceUserInterfaceLayoutDirection.contextMenuIsRightToLeft
        self.contentView = contentView

        super.init(frame: .zero)

        self.semanticContentAttribute = sourceUserInterfaceLayoutDirection.contextMenuSemanticContentAttribute
        // The accessory grows from and shrinks into its bottom edge, the one over the source
        self.layer.anchorPoint = CGPoint(x: 0.5, y: 1.0)
        self.glassContainer.isUserInteractionEnabled = false
        self.addSubview(self.glassContainer)
        for backgroundView in self.backgroundViews {
            backgroundView.isUserInteractionEnabled = false
            self.glassContainer.contentView.addSubview(backgroundView)
        }
        self.addSubview(contentView)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func layoutSubviews() {
        super.layoutSubviews()

        let capsuleFrames = self.capsules.map { capsule in
            self.isRightToLeft
                ? CGRect(x: self.bounds.width - capsule.maxX, y: capsule.minY, width: capsule.width, height: capsule.height)
                : capsule
        }
        self.glassContainer.update(size: self.bounds.size)
        self.contentView.frame = self.bounds

        // Native glass draws its own depth, as it does for the menu panel
        if ContextMenuVisuals.supportsNativeGlass {
            for (frame, backgroundView) in zip(capsuleFrames, self.backgroundViews) {
                backgroundView.frame = frame
                backgroundView.update(
                    size: frame.size,
                    cornerRadius: Self.cornerRadius(of: frame),
                    traits: self.traitCollection,
                    isInteractive: false,
                    glassTint: self.glassTint
                )
            }
            self.layer.shadowOpacity = 0.0
            self.layer.shadowPath = nil
            return
        }

        let shape = capsuleFrames
            .map { frame in
                let cornerRadius = Self.cornerRadius(of: frame)
                return CGPath(roundedRect: frame, cornerWidth: cornerRadius, cornerHeight: cornerRadius, transform: nil)
            }
            .reduce(nil as CGPath?) { union, capsule in union?.union(capsule) ?? capsule }
        for backgroundView in self.backgroundViews {
            backgroundView.frame = self.bounds
            backgroundView.update(
                size: self.bounds.size,
                cornerRadius: 0.0,
                legacyShape: shape,
                traits: self.traitCollection,
                isInteractive: false,
                glassTint: self.glassTint
            )
        }
        self.layer.shadowColor = UIColor.black.cgColor
        self.layer.shadowOpacity = self.traitCollection.userInterfaceStyle == .dark ? 0.22 : 0.12
        self.layer.shadowRadius = Self.legacyShadowRadius
        self.layer.shadowOffset = Self.legacyShadowOffset
        self.layer.shadowPath = shape
    }

    private static func cornerRadius(of capsule: CGRect) -> CGFloat {
        min(capsule.width, capsule.height) * 0.5
    }
}
