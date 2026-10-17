@testable import UIActivityList
import UIKit
import WalletContext
import XCTest

@MainActor
final class ActivityHistoryStatusTests: XCTestCase {
    func testUnresolvedHistoryShowsOneCompactStatusAndNeverStartsSkeletons() async throws {
        let controller = try await makeController()
        let cell = try XCTUnwrap(controller.collectionView.visibleCells.compactMap { $0 as? ActivityHistoryStatusCell }.first)
        XCTAssertTrue(cell.accessibilityLabel?.contains(lang("Loading Activity")) == true)
        XCTAssertLessThan(controller.collectionView.contentSize.height, 250)
        XCTAssertFalse(controller.skeletonView.isAnimating)
    }

    private func makeController() async throws -> HistoryStatusTestController {
        let controller = HistoryStatusTestController()
        controller.loadViewIfNeeded()
        controller.view.frame = CGRect(x: 0, y: 0, width: 320, height: 844)
        controller.view.backgroundColor = .air.groupedBackground
        controller.setupCollectionView(collectionViewBottomConstraint: 0)
        controller.isInitializingCache = false
        let snapshot = controller.makeSnapshot()
        XCTAssertEqual(snapshot.itemIdentifiers, [.headerPlaceholder, .loadingMore])
        let applied = expectation(description: "Loading snapshot applied")
        controller.onDidApply = { applied.fulfill() }
        controller.applySnapshot(snapshot, animatingDifferences: false)
        await fulfillment(of: [applied], timeout: 3)
        controller.view.layoutIfNeeded()
        return controller
    }

    func testDelayedMessageSurvivesReconfigurationAndResetsAfterProgressOrReuse() async throws {
        let controller = try await makeController()
        let cell = try XCTUnwrap(controller.collectionView.visibleCells.compactMap { $0 as? ActivityHistoryStatusCell }.first)
        let initialHeight = cell.bounds.height
        let failedCell = ActivityHistoryStatusCell(frame: cell.frame)
        cell.configure(hasLoadError: false, activityCount: 0)
        failedCell.configure(hasLoadError: false, activityCount: 0)
        failedCell.configure(hasLoadError: true, activityCount: 0)
        attach(cell, named: "Loading activity")
        attach(failedCell, named: "Activity unavailable")

        try await Task.sleep(for: .seconds(6))
        cell.configure(hasLoadError: false, activityCount: 0)
        try await Task.sleep(for: .seconds(5))
        XCTAssertTrue(cell.accessibilityLabel?.contains(lang("Taking Longer Than Usual")) == true)
        XCTAssertTrue(failedCell.accessibilityLabel?.contains(lang("Activity Unavailable")) == true)
        controller.collectionView.layoutIfNeeded()
        XCTAssertGreaterThan(cell.bounds.height, initialHeight)
        attach(cell, named: "Slow activity history")

        cell.configure(hasLoadError: false, activityCount: 60)
        XCTAssertTrue(cell.accessibilityLabel?.contains(lang("Loading More Activity")) == true)

        cell.prepareForReuse()
        cell.configure(hasLoadError: false, activityCount: 0)
        XCTAssertTrue(cell.accessibilityLabel?.contains(lang("Loading Activity")) == true)
    }

    private func attach(_ cell: UICollectionViewCell, named name: String) {
        cell.backgroundColor = .air.groupedBackground
        if cell.superview == nil {
            cell.bounds.size.height = cell.contentView.systemLayoutSizeFitting(
                CGSize(width: cell.bounds.width, height: 0),
                withHorizontalFittingPriority: .required,
                verticalFittingPriority: .fittingSizeLevel
            ).height
        }
        cell.layoutIfNeeded()
        let image = UIGraphicsImageRenderer(bounds: cell.bounds).image { context in
            cell.layer.render(in: context.cgContext)
        }
        let attachment = XCTAttachment(image: image)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}

@MainActor
private final class HistoryStatusTestController: ActivityListViewController {
    override var headerPlaceholderHeight: CGFloat { 0 }
    var onDidApply: (() -> Void)?

    override func didApplySnapshot() {
        onDidApply?()
    }
}
