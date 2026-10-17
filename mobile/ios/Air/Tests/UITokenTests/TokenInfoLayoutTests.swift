import SwiftUI
import Testing
import UIKit
@testable import UIToken
import WalletCore
import WalletResources

@MainActor
@Suite("Token Info Layout", .serialized)
struct TokenInfoLayoutTests {
    @Test
    func `restored expanded cell fills its collection view allocation`() async throws {
        _ = WalletResourcesBundle.bundle.load()
        let model = TokenInfoModel(state: .details(ApiTokenDetails(
            description: String(repeating: "A long token description. ", count: 30),
            links: nil,
            marketCap: 7_580_000_000,
            circulatingSupply: nil,
            totalSupply: nil,
            createdAt: nil,
            volume24h: nil
        )), isExpanded: true)
        let layout = UICollectionViewCompositionalLayout { section, _ in
            let size = NSCollectionLayoutSize(
                widthDimension: .fractionalWidth(1),
                heightDimension: section == 0 ? .absolute(354) : .estimated(300)
            )
            return NSCollectionLayoutSection(group: .vertical(
                layoutSize: size,
                subitems: [NSCollectionLayoutItem(layoutSize: size)]
            ))
        }
        let collection = UICollectionView(frame: CGRect(x: 0, y: 0, width: 390, height: 844), collectionViewLayout: layout)
        let controller = UIViewController()
        let navigation = UINavigationController(rootViewController: controller)
        let window = UIWindow(frame: collection.bounds)
        window.rootViewController = navigation
        window.isHidden = false
        defer { window.isHidden = true }
        controller.view.addSubview(collection)
        let header = UICollectionView.CellRegistration<UICollectionViewCell, Int> { _, _, _ in }
        let info = UICollectionView.CellRegistration<TokenInfoCell, Int> { [weak collection] cell, indexPath, _ in
            cell.configure(model: model, onHeightChange: { [weak collection] in
                guard let collection else { return }
                let context = UICollectionViewLayoutInvalidationContext()
                context.invalidateItems(at: [indexPath])
                collection.collectionViewLayout.invalidateLayout(with: context)
                collection.layoutIfNeeded()
            }, onUserToggleAnimationChange: { _ in })
        }
        let source = UICollectionViewDiffableDataSource<Int, Int>(collectionView: collection) { collection, indexPath, item in
            if item == 0 {
                return collection.dequeueConfiguredReusableCell(using: header, for: indexPath, item: item)
            }
            return collection.dequeueConfiguredReusableCell(using: info, for: indexPath, item: item)
        }
        var snapshot = NSDiffableDataSourceSnapshot<Int, Int>()
        snapshot.appendSections([0, 1])
        snapshot.appendItems([0], toSection: 0)
        snapshot.appendItems([1], toSection: 1)
        await source.apply(snapshot, animatingDifferences: false)
        window.layoutIfNeeded()
        try await Task.sleep(for: .milliseconds(300))
        let cell = try #require(collection.cellForItem(at: IndexPath(item: 0, section: 1)) as? TokenInfoCell)
        let clippingView = try #require(cell.contentView.subviews.first)
        #expect(model.measuredExpandedHeight > TokenInfoModel.initialExpandedHeight)
        #expect(abs(cell.bounds.height - model.measuredExpandedHeight) < 1)
        #expect(abs(cell.contentView.bounds.height - cell.bounds.height) < 1)
        #expect(abs(clippingView.bounds.height - cell.bounds.height) < 1)

        navigation.pushViewController(UIViewController(), animated: false)
        window.layoutIfNeeded()
        navigation.popViewController(animated: false)
        collection.contentOffset.y = 354
        window.layoutIfNeeded()
        try await Task.sleep(for: .milliseconds(100))
        #expect(abs(clippingView.bounds.height - cell.bounds.height) < 1)
    }

    @Test
    func `reconfiguring during crossfade keeps the measured hosting height`() async throws {
        _ = WalletResourcesBundle.bundle.load()
        let model = TokenInfoModel(state: .loading, isExpanded: true)
        let cell = TokenInfoCell(frame: CGRect(x: 0, y: 100, width: 390, height: TokenInfoModel.collapsedHeight))
        let controller = UIViewController()
        let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 390, height: 844))
        window.rootViewController = controller
        window.isHidden = false
        defer { window.isHidden = true }
        controller.view.addSubview(cell)

        let updateHeight = { [weak cell] in
            guard let cell else { return }
            cell.frame.size.height = cell.height ?? 0
            cell.layoutIfNeeded()
        }
        cell.configure(model: model, onHeightChange: updateHeight, onUserToggleAnimationChange: { _ in })
        window.layoutIfNeeded()
        try await Task.sleep(for: .milliseconds(100))
        model.configure(state: .details(ApiTokenDetails(
            description: String(repeating: "A long token description. ", count: 30),
            links: nil,
            marketCap: nil,
            circulatingSupply: nil,
            totalSupply: nil,
            createdAt: nil,
            volume24h: nil
        )))
        cell.modelStateDidChange()

        for _ in 0..<100 {
            window.layoutIfNeeded()
            if model.pendingPresentationRevision == nil { break }
            try await Task.sleep(for: .milliseconds(10))
        }
        #expect(model.pendingPresentationRevision == nil)
        #expect(model.presentationOverlay != nil)
        #expect(model.measuredExpandedHeight > TokenInfoModel.collapsedHeight)
        cell.configure(model: model, onHeightChange: updateHeight, onUserToggleAnimationChange: { _ in })
        updateHeight()
        try await Task.sleep(for: .milliseconds(300))
        window.layoutIfNeeded()

        let host = try #require(cell.contentView.subviews.first?.subviews.first)
        #expect(abs(host.bounds.height - model.measuredExpandedHeight) < 1)
        #expect(abs(cell.bounds.height - model.measuredExpandedHeight) < 1)
    }

    @Test(arguments: [true, false])
    func `content stays at the top when the host and content heights differ`(isExpanded: Bool) async throws {
        _ = WalletResourcesBundle.bundle.load()
        let model = TokenInfoModel(state: .loading, isExpanded: isExpanded)
        var contentHeight = CGFloat.zero
        var contentFrame: CGRect?
        let hostingView = UIHostingConfiguration {
            TokenInfoView(model: model) { height, _ in
                contentHeight = height
            }
            .onGeometryChange(for: CGRect.self, of: { $0.frame(in: .global) }) {
                contentFrame = $0
            }
        }
        .margins(.all, 0)
        .makeContentView()

        let controller = UIViewController()
        let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 390, height: 844))
        window.rootViewController = controller
        window.isHidden = false
        defer { window.isHidden = true }
        hostingView.frame = CGRect(x: 16, y: 100, width: 358, height: TokenInfoModel.collapsedHeight)
        controller.view.addSubview(hostingView)
        window.layoutIfNeeded()
        try await Task.sleep(for: .milliseconds(100))
        let initialFrame = try #require(contentFrame)
        #expect(abs(contentHeight - TokenInfoModel.collapsedHeight) < 1)

        let details = ApiTokenDetails(
            description: String(repeating: "A long token description. ", count: 30),
            links: nil,
            marketCap: 7_580_000_000,
            circulatingSupply: nil,
            totalSupply: nil,
            createdAt: nil,
            volume24h: nil
        )
        model.configure(state: .details(details))
        hostingView.setNeedsLayout()
        window.layoutIfNeeded()
        try await Task.sleep(for: .milliseconds(100))

        #expect(contentHeight > TokenInfoModel.collapsedHeight)
        let frame = try #require(contentFrame)
        #expect(abs(frame.minY - initialFrame.minY) < 1)

        model.updateMeasuredExpandedHeight(contentHeight)
        model.beginPresentationTransition(revision: model.layoutRevision, animated: false)
        model.setExpansionProgress(model.targetExpansionProgress)
        hostingView.frame.size.height = contentHeight
        window.layoutIfNeeded()
        try await Task.sleep(for: .milliseconds(100))

        // During a shrinking transition the outgoing layer is taller than the new host.
        model.configure(state: .error)
        hostingView.frame.size.height = TokenInfoModel.collapsedHeight
        window.layoutIfNeeded()
        try await Task.sleep(for: .milliseconds(100))

        #expect(abs(contentHeight - TokenInfoModel.collapsedHeight) < 1)
        let shrinkingFrame = try #require(contentFrame)
        #expect(abs(shrinkingFrame.minY - initialFrame.minY) < 1)
    }
}
