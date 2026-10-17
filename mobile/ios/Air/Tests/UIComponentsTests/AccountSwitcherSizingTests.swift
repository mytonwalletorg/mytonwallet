import Testing
import UIKit
@testable import UIComponents

@Suite("Account switcher navigation sizing")
struct AccountSwitcherSizingTests {
    @Test @MainActor func buttonFitsCompactNavigationHost() {
        let host = UIView(frame: CGRect(x: 0, y: 0, width: 66, height: 36))
        let button = AccountSwitcherButton()
        host.addSubview(button)
        NSLayoutConstraint.activate([
            button.topAnchor.constraint(equalTo: host.topAnchor),
            button.bottomAnchor.constraint(equalTo: host.bottomAnchor),
            button.leadingAnchor.constraint(equalTo: host.leadingAnchor),
        ])
        host.layoutIfNeeded()
        #expect(button.bounds.height == 36)
    }

    @Test @MainActor func navigationBarRoutesTheFullTouchHeight() {
        let button = AccountSwitcherButton()
        button.heightAnchor.constraint(equalToConstant: 36).isActive = true
        let controller = UIViewController()
        controller.navigationItem.rightBarButtonItem = UIBarButtonItem(customView: button)
        let navigation = UINavigationController(rootViewController: controller)
        let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 390, height: 844))
        window.rootViewController = navigation
        window.isHidden = false
        defer { window.isHidden = true }
        navigation.view.layoutIfNeeded()
        #expect(button.bounds.height == 36)
        for offset in [CGFloat(-21), 0, 21] {
            let point = button.convert(CGPoint(x: button.bounds.midX, y: button.bounds.midY + offset), to: window)
            let hit = window.hitTest(point, with: nil)
            #expect(hit === button || hit?.isDescendant(of: button) == true,
                "Navigation hit at offset \(offset) reaches \(String(describing: hit))")
        }
    }

    @Test @MainActor func buttonKeepsRegularNavigationHeight() {
        let host = UIView(frame: CGRect(x: 0, y: 0, width: 66, height: 44))
        let button = AccountSwitcherButton()
        host.addSubview(button)
        NSLayoutConstraint.activate([
            button.topAnchor.constraint(equalTo: host.topAnchor),
            button.bottomAnchor.constraint(equalTo: host.bottomAnchor),
            button.leadingAnchor.constraint(equalTo: host.leadingAnchor),
        ])
        host.layoutIfNeeded()
        #expect(button.bounds.height == 44)
    }
}
