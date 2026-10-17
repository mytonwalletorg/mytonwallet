import SwiftUI

extension View {
    /// Sets the accessibility identifier when one is given; `nil` keeps the identifiers the view already has.
    /// The argument must not switch between `nil` and a value during the view's lifetime, as that changes its structural identity
    @ViewBuilder
    public func accessibilityIdentifier(ifPresent identifier: String?) -> some View {
        if let identifier {
            accessibilityIdentifier(identifier)
        } else {
            self
        }
    }
}
