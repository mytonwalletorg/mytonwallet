import Foundation
import WalletContext

enum DuoNavigationSettings {
    enum Placement: String {
        case sidebar
        case toolbar
    }

    static let userDefaultsKey = "experimental_openDuoNavigation"
    static let didChangeNotification = Notification.Name("DuoNavigationSettingsDidChange")

    static var usesToolbar: Bool {
        IS_DEBUG_OR_TESTFLIGHT
            && UserDefaults.standard.string(forKey: userDefaultsKey) == Placement.toolbar.rawValue
    }

    static func notifyDidChange() {
        NotificationCenter.default.post(name: didChangeNotification, object: nil)
    }
}
