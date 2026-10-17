import UIKit

#if DEBUG
private final class DebugDisplayLogOverlayViewController: UIViewController {
    let containerView = UIView()
    let textView = UITextView()
    var heightConstraint: NSLayoutConstraint?
    var lines: [String] = []
    let prefix = String(repeating: "\n", count: 5)

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear

        containerView.backgroundColor = UIColor.black.withAlphaComponent(0.75)
        containerView.layer.cornerRadius = 26
        containerView.layer.cornerCurve = .continuous
        containerView.layer.maskedCorners = [.layerMinXMaxYCorner, .layerMaxXMaxYCorner]
        containerView.translatesAutoresizingMaskIntoConstraints = false

        textView.backgroundColor = .clear
        textView.isEditable = false
        textView.isSelectable = true
        textView.isScrollEnabled = true
        textView.textColor = .white
        textView.font = UIFont.monospacedSystemFont(ofSize: 10, weight: .regular)
        textView.textContainerInset = UIEdgeInsets(top: 6, left: 8, bottom: 6, right: 8)
        textView.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(containerView)
        containerView.addSubview(textView)

        heightConstraint = containerView.heightAnchor.constraint(equalToConstant: 0)

        NSLayoutConstraint.activate([
            containerView.topAnchor.constraint(equalTo: view.topAnchor),
            containerView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            containerView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            heightConstraint!,

            textView.topAnchor.constraint(equalTo: containerView.topAnchor),
            textView.leadingAnchor.constraint(equalTo: containerView.leadingAnchor),
            textView.trailingAnchor.constraint(equalTo: containerView.trailingAnchor),
            textView.bottomAnchor.constraint(equalTo: containerView.bottomAnchor)
        ])
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        heightConstraint?.constant = view.bounds.height / 3
    }

    func setLines(_ newLines: [String]) {
        lines = newLines
        textView.text = prefix + newLines.joined(separator: "\n")
        scrollToBottom()
    }

    func appendLine(_ line: String, maxLines: Int) {
        lines.append(line)
        if lines.count > maxLines {
            lines.removeFirst(lines.count - maxLines)
        }
        textView.text = prefix + lines.joined(separator: "\n")
        scrollToBottom()
    }

    func scrollToBottom() {
        textView.layoutIfNeeded()
        let y = max(0, textView.contentSize.height - textView.bounds.height + textView.contentInset.bottom)
        textView.setContentOffset(CGPoint(x: 0, y: y), animated: false)
    }
}

@MainActor private final class DebugDisplayLogOverlay {
    static let shared = DebugDisplayLogOverlay()

    let formatter: DateFormatter
    let maxLines = 500
    /// SDK console lines can carry whole request payloads; the overlay only needs their start.
    let maxLineLength = 400
    var buffer: [String] = []
    var window: UIWindow?
    var viewController: DebugDisplayLogOverlayViewController?
    var isEnabled = false
    var sceneActivationObserver: (any NSObjectProtocol)?

    init() {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "HH:mm:ss.SSS"
        self.formatter = formatter
    }

    func setEnabled(_ enabled: Bool) {
        if enabled {
            show()
        } else {
            hide()
        }
    }

    func append(_ message: String, at date: Date) {
        let message = message.count > maxLineLength ? String(message.prefix(maxLineLength)) + "…" : message
        let line = "\(formatter.string(from: date)) \(message)"
        buffer.append(line)
        if buffer.count > maxLines {
            buffer.removeFirst(buffer.count - maxLines)
        }
        guard isEnabled else { return }
        viewController?.appendLine(line, maxLines: maxLines)
    }

    func show() {
        isEnabled = true

        let vc = viewController ?? DebugDisplayLogOverlayViewController()
        viewController = vc

        if window == nil {
            // A cold launch enables the overlay before its scene is in the foreground, so it attaches on activation.
            guard let scene = Self.foregroundScene() else {
                attachOnSceneActivation()
                return
            }
            let window = UIWindow(windowScene: scene)
            window.rootViewController = vc
            window.windowLevel = UIWindow.Level(rawValue: UIWindow.Level.statusBar.rawValue + 1)
            window.backgroundColor = .clear
            window.isUserInteractionEnabled = false
            window.frame = scene.screen.bounds
            self.window = window
        }
        window?.isHidden = false

        vc.setLines(buffer)
    }

    func hide() {
        isEnabled = false
        window?.isHidden = true
    }

    private static func foregroundScene() -> UIWindowScene? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        return scenes.first { $0.activationState == .foregroundActive }
            ?? scenes.first { $0.activationState == .foregroundInactive }
    }

    private func attachOnSceneActivation() {
        guard sceneActivationObserver == nil else { return }
        sceneActivationObserver = NotificationCenter.default.addObserver(
            forName: UIScene.didActivateNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                guard let self, let observer = self.sceneActivationObserver else { return }
                NotificationCenter.default.removeObserver(observer)
                self.sceneActivationObserver = nil
                if self.isEnabled {
                    self.show()
                }
            }
        }
    }
}

public func setDisplayLogOverlayEnabled(_ enabled: Bool) {
    Task { @MainActor in
        DebugDisplayLogOverlay.shared.setEnabled(enabled)
    }
}

/// The line is stamped when it is logged, not when the main actor gets to draw it.
public func displayLog(_ message: String) {
    let date = Date.now
    Task { @MainActor in
        DebugDisplayLogOverlay.shared.append(message, at: date)
    }
}
#else
public func setDisplayLogOverlayEnabled(_ enabled: Bool) { }
public func displayLog(_ message: String) { }
#endif
