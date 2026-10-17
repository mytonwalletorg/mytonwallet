import UIKit
import WalletContext

final class ActivityHistoryStatusCell: UICollectionViewCell {
    private struct Configuration: Equatable {
        var hasLoadError: Bool
        var activityCount: Int
    }

    private let statusView = WalletCreatedView()
    private var configuration: Configuration?
    private var delayedLoadingTask: Task<Void, Never>?

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        contentView.addSubview(statusView)
        NSLayoutConstraint.activate([
            statusView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 20),
            statusView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -20),
            statusView.topAnchor.constraint(equalTo: contentView.topAnchor),
            statusView.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -24),
        ])
        isAccessibilityElement = true
        accessibilityTraits = .staticText
        accessibilityIdentifier = "activityHistoryStatus"
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { nil }

    deinit {
        delayedLoadingTask?.cancel()
    }

    override func prepareForReuse() {
        super.prepareForReuse()
        delayedLoadingTask?.cancel()
        delayedLoadingTask = nil
        configuration = nil
    }

    func configure(hasLoadError: Bool, activityCount: Int) {
        let configuration = Configuration(hasLoadError: hasLoadError, activityCount: activityCount)
        // Unrelated updates must not restart the delay while the same history is still missing.
        guard self.configuration != configuration else { return }
        self.configuration = configuration
        delayedLoadingTask?.cancel()
        delayedLoadingTask = nil

        if hasLoadError {
            setMessage(
                title: lang("Activity Unavailable"),
                subtitle: lang("Activity history is temporarily unavailable. We’ll try again shortly.")
            )
        } else {
            setMessage(
                title: activityCount > 0 ? lang("Loading More Activity") : lang("Loading Activity"),
                subtitle: lang("Your activity history is loading.")
            )
            delayedLoadingTask = Task { [weak self] in
                do {
                    try await Task.sleep(for: .seconds(10))
                } catch {
                    return
                }
                self?.setMessage(
                    title: lang("Taking Longer Than Usual"),
                    subtitle: lang("Activity history is taking longer to load. Please check back shortly.")
                )
            }
        }
    }

    private func setMessage(title: String, subtitle: String) {
        statusView.configure(title: title, subtitle: subtitle)
        accessibilityLabel = "\(title). \(subtitle)"
        invalidateIntrinsicContentSize()
        setNeedsLayout()
    }
}
