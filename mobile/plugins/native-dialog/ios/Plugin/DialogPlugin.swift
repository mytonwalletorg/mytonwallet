import Foundation
import Capacitor

/**
 * Implement three common native-dialog types: alert, confirm, and prompt
 */
@objc(DialogPlugin)
public class DialogPlugin: CAPPlugin {

    @objc public func alert(_ call: CAPPluginCall) {
        let title = call.options["title"] as? String
        guard let message = call.options["message"] as? String else {
            call.reject("Please provide a message for the dialog")
            return
        }
        let buttonTitle = call.options["buttonTitle"] as? String ?? "OK"

        DispatchQueue.main.async {
            let alertWindow: UIWindow? = UIWindow(frame: UIScreen.main.bounds)
            alertWindow?.rootViewController = UIViewController()
            alertWindow?.windowLevel = UIWindow.Level.alert + 1
            alertWindow?.makeKeyAndVisible()

            let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: buttonTitle, style: .default, handler: { (_) -> Void in
                call.resolve()
                self.cleanupWindow(alertWindow)
            }))

            alertWindow?.rootViewController?.present(alert, animated: true, completion: nil)
        }
    }

    @objc public func confirm(_ call: CAPPluginCall) {
        let title = call.options["title"] as? String
        guard let message = call.options["message"] as? String else {
            call.reject("Please provide a message for the dialog")
            return
        }
        let okButtonTitle = call.options["okButtonTitle"] as? String ?? "OK"
        let cancelButtonTitle = call.options["cancelButtonTitle"] as? String ?? "Cancel"

        DispatchQueue.main.async {
            let alertWindow: UIWindow? = UIWindow(frame: UIScreen.main.bounds)
            alertWindow?.rootViewController = UIViewController()
            alertWindow?.windowLevel = UIWindow.Level.alert + 1
            alertWindow?.makeKeyAndVisible()

            let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: cancelButtonTitle, style: .default, handler: { (_) -> Void in
                call.resolve([
                    "value": false
                ])
                self.cleanupWindow(alertWindow)
            }))
            alert.addAction(UIAlertAction(title: okButtonTitle, style: .default, handler: { (_) -> Void in
                call.resolve([
                    "value": true
                ])
                self.cleanupWindow(alertWindow)
            }))

            alertWindow?.rootViewController?.present(alert, animated: true, completion: nil)
        }
    }

    @objc public func prompt(_ call: CAPPluginCall) {
        let title = call.options["title"] as? String
        guard let message = call.options["message"] as? String else {
            call.reject("Please provide a message for the dialog")
            return
        }
        let okButtonTitle = call.options["okButtonTitle"] as? String ?? "OK"
        let cancelButtonTitle = call.options["cancelButtonTitle"] as? String ?? "Cancel"
        let inputPlaceholder = call.options["inputPlaceholder"] as? String ?? ""
        let inputText = call.options["inputText"] as? String ?? ""

        DispatchQueue.main.async {
            let alertWindow: UIWindow? = UIWindow(frame: UIScreen.main.bounds)
            alertWindow?.rootViewController = UIViewController()
            alertWindow?.windowLevel = UIWindow.Level.alert + 1
            alertWindow?.makeKeyAndVisible()

            let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
            alert.addTextField { (textField) in
                textField.placeholder = inputPlaceholder
                textField.text = inputText
            }

            alert.addAction(UIAlertAction(title: cancelButtonTitle, style: .default, handler: { (_) -> Void in
                call.resolve([
                    "value": "",
                    "cancelled": true
                ])
                self.cleanupWindow(alertWindow)
            }))
            alert.addAction(UIAlertAction(title: okButtonTitle, style: .default, handler: { (_) -> Void in
                let textField = alert.textFields?.first
                call.resolve([
                    "value": textField?.text ?? "",
                    "cancelled": false
                ])
                self.cleanupWindow(alertWindow)
            }))

            alertWindow?.rootViewController?.present(alert, animated: true, completion: nil)
        }
    }

    private func cleanupWindow(_ window: UIWindow?) {
        window?.isHidden = true
        window?.rootViewController = nil
        window?.windowLevel = UIWindow.Level.normal
    }
}
