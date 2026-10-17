import UIKit

public struct ContextMenuAccessoryContext {
    private let dismissHandler: @MainActor () -> Void

    init(dismissHandler: @escaping @MainActor () -> Void) {
        self.dismissHandler = dismissHandler
    }

    @MainActor
    public func dismiss() {
        self.dismissHandler()
    }
}

/// A view that the menu shows over its source's top edge, such as a row of reactions.
///
/// The overlay keeps the accessory inside the screen insets and the safe area, places the menu panel clear of the
/// source and the accessory, animates the accessory together with the panel and does not dismiss the menu on taps
/// inside it. Right-to-left layouts mirror its placement and `backgroundCapsules`.
public struct ContextMenuAccessory {
    public typealias ViewProvider = @MainActor (ContextMenuAccessoryContext) -> UIView

    public var size: CGSize
    /// The offset of the accessory's top trailing corner from the source's top trailing corner: a positive `dx`
    /// moves the accessory past the source's trailing edge, a positive `dy` moves it down
    public var topTrailingOffset: CGVector
    /// Rects of the accessory, measured from its leading edge, that the menu panel's material fills as capsules
    /// under the content view. Overlapping capsules merge into one shape.
    public var backgroundCapsules: [CGRect]
    /// Makes the view that fills the accessory's bounds over its background
    public var makeContentView: ViewProvider

    public init(
        size: CGSize,
        topTrailingOffset: CGVector,
        backgroundCapsules: [CGRect],
        makeContentView: @escaping ViewProvider
    ) {
        self.size = size
        self.topTrailingOffset = topTrailingOffset
        self.backgroundCapsules = backgroundCapsules
        self.makeContentView = makeContentView
    }
}
