import Testing
import UIKit
@testable import UIComponents

@Suite("Token hero touch routing")
struct TokenHeroTouchTests {
    @Test @MainActor func blurPassesEmptyTouchesAndPreservesContentTouches() {
        let blur = WBlurredContentView()
        blur.frame = CGRect(x: 0, y: 0, width: 100, height: 100)
        let content = UIView(frame: CGRect(x: 30, y: 30, width: 40, height: 40))
        blur.addSubview(content)
        #expect(blur.hitTest(CGPoint(x: 10, y: 10), with: nil) === blur)
        blur.passesTouchesOutsideContent = true
        #expect(blur.hitTest(CGPoint(x: 10, y: 10), with: nil) == nil)
        #expect(blur.hitTest(CGPoint(x: 50, y: 50), with: nil) === content)
    }
}
