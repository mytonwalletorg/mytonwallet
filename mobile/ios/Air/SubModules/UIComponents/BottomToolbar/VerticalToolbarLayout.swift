import UIKit

@available(iOS 27.1, *)
extension UIView {
    /// Read from the navigation container, before its content's side safe-area inset.
    public var verticalToolbarBottomButtonFrame: CGRect? {
        let isLTR = effectiveUserInterfaceLayoutDirection == .leftToRight
        let edge: UIRectEdge
        switch traitCollection.verticalBarEdge {
        case .leading: edge = isLTR ? .left : .right
        case .trailing: edge = isLTR ? .right : .left
        default: return nil
        }
        let size: CGFloat = 48
        let region = layoutGuide(for: .bar(onEdge: edge, extent: size)).layoutFrame
        guard !region.isEmpty else { return nil }
        return CGRect(
            x: region.midX - size / 2,
            y: min(region.maxY, bounds.maxY - 24) - size,
            width: size,
            height: size
        )
    }
}
