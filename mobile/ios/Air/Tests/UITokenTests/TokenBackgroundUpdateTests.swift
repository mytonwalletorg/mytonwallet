import Dependencies
import GRDB
import IssueReportingTestSupport
import UIKit
import Testing
import UIActivityList
import WalletContext
import WalletResources
@testable import UIToken
@testable import WalletCore

@MainActor
@Suite("Token Background Updates", .serialized)
struct TokenBackgroundUpdateTests {
    @Test
    func testRepeatedBackgroundEventsDoNotApplySnapshotsOrResetScrollGeometry() async throws {
        try await withFixture { controller in
            let collection = controller.collectionView
            collection.contentInset.bottom += 100
            collection.contentOffset.y = -collection.adjustedContentInset.top - 50
            collection.layoutIfNeeded()
            let offset = collection.contentOffset
            let inset = collection.contentInset
            let originalCells = collection.visibleCells
            let configurationCount = controller.configurationCount
            let applyCount = controller.snapshots.count
            let menu = controller.navigationItem.rightBarButtonItem
            var toolbarUpdates = 0
            controller.onSharedBottomToolbarActionsChange = { toolbarUpdates += 1 }

            for _ in 0..<10 {
                controller.dataUpdated()
                controller.priceDataUpdated()
                controller.activityViewModelChanged()
                controller.walletCore(event: .configChanged)
                controller.viewSafeAreaInsetsDidChange()
            }
            try await Task.sleep(for: .milliseconds(100))
            collection.layoutIfNeeded()

            #expect(controller.snapshots.count == applyCount)
            #expect(controller.configurationCount == configurationCount)
            #expect(collection.contentInset == inset)
            #expect(collection.contentOffset == offset)
            #expect(Set(collection.visibleCells) == Set(originalCells))
            #expect(controller.navigationItem.rightBarButtonItem === menu)
            #expect(toolbarUpdates == 0)
        }
    }

    @Test
    func testActivityChangesDoNotReconfigureTokenSections() async throws {
        try await withFixture { controller in
            let model = try #require(controller.activityViewModel)
            let accountId = model.accountId
            let section = ActivityListViewModel.Section.transactions(accountId, Date(timeIntervalSince1970: 0))
            let row = ActivityListViewModel.Row.transaction(accountId, "new")
            let activity = try JSONDecoder().decode(ApiActivity.self, from: Data("""
                {"kind":"transaction","id":"new","timestamp":1000,"amount":"1000000000",
                "fromAddress":"from","toAddress":"to","fee":"0","slug":"toncoin","isIncoming":true,"status":"confirmed"}
                """.utf8))
            model.activitiesById = ["new": activity]
            var snapshot = try #require(model.snapshot)
            snapshot.deleteSections([.emptyPlaceholder])
            snapshot.appendSections([section])
            snapshot.appendItems([row], toSection: section)
            model.snapshot = snapshot
            let applyCount = controller.snapshots.count
            controller.activityViewModelChanged()
            #expect(controller.snapshots.count == applyCount + 1)
            #expect(try #require(controller.snapshots.last).reconfiguredItemIdentifiers.isEmpty)

            snapshot.reconfigureItems([row])
            model.snapshot = snapshot
            controller.activityViewModelChanged()
            #expect(controller.snapshots.count == applyCount + 2)
            #expect(controller.snapshots.last?.reconfiguredItemIdentifiers == [row])
            try await Task.sleep(for: .milliseconds(100))
        }
    }

    @Test
    func testBalanceChangesUpdateTradeActionsWithoutReloadingTheList() async throws {
        try await withFixture { controller in
            let accountId = try #require(controller.activityViewModel).accountId
            defer { BalancesStore.for(accountId: accountId).replaceAll(byChain: [:]) }
            let applyCount = controller.snapshots.count
            #expect(controller.sharedBottomToolbarActions.map(\.id) == ["token.buy"])
            var toolbarUpdates = 0
            controller.onSharedBottomToolbarActionsChange = { toolbarUpdates += 1 }

            BalancesStore.for(accountId: accountId).replace(chain: .ton, balances: [TONCOIN_SLUG: 1_000_000_000])
            controller.dataUpdated()
            #expect(controller.sharedBottomToolbarActions.map(\.id) == ["token.buy", "token.sell"])
            #expect(toolbarUpdates == 1)
            controller.dataUpdated()
            #expect(toolbarUpdates == 1)
            #expect(controller.snapshots.count == applyCount)
        }
    }

    private func withFixture(_ body: @MainActor (TokenUpdateTestController) async throws -> Void) async throws {
        _ = WalletResourcesBundle.bundle.load()
        let db = try DatabaseQueue()
        try makeMigrator().migrate(db)
        let account = MAccount(id: UUID().uuidString + "-mainnet", title: "Token updates", type: .mnemonic,
                               byChain: ["ton": AccountChain(address: "test")])
        try await db.write { db in
            try account.insert(db)
            try _ActivityStore.AccountState(accountId: account.id, byId: [:], idsMain: [],
                idsBySlug: [TONCOIN_SLUG: []], isMainHistoryEndReached: true,
                isHistoryEndReachedBySlug: [TONCOIN_SLUG: true]).insert(db)
        }
        SettingsStore.liveValue.use(db: db)
        defer { SettingsStore.liveValue.clean() }
        await _ActivityStore.shared.use(db: db)
        try await withDependencies {
            $0.context = .live
            $0.accountStore = _AccountStore(db: db)
        } operation: {
            let controller = await TokenUpdateTestController(accountSource: .constant(account), token: .TONCOIN, isInModal: false)
            controller.loadViewIfNeeded()
            controller.view.frame = CGRect(x: 0, y: 0, width: 390, height: 844)
            controller.view.layoutIfNeeded()
            try await Task.sleep(for: .milliseconds(100))
            controller.collectionView.layoutIfNeeded()
            #expect(controller.visibleCustomSectionCell(id: "chart") != nil)
            try await body(controller)
        }
    }
}

@MainActor
private final class TokenUpdateTestController: TokenVC {
    var snapshots: [NSDiffableDataSourceSnapshot<Section, Row>] = []
    var configurationCount = 0

    override var customSections: [any CustomSectionDataProvider] {
        super.customSections.map { provider in
            CountingSection(provider: provider) { [weak self] in self?.configurationCount += 1 }
        }
    }

    override func applySnapshot(_ snapshot: NSDiffableDataSourceSnapshot<Section, Row>, animatingDifferences: Bool = true) {
        snapshots.append(snapshot)
        super.applySnapshot(snapshot, animatingDifferences: animatingDifferences)
    }
}

@MainActor
private struct CountingSection: ActivityListViewController.CustomSectionDataProvider {
    let provider: any ActivityListViewController.CustomSectionDataProvider
    let onConfigure: () -> Void
    var id: String { provider.id }
    var itemIdentifiers: [String] { provider.itemIdentifiers }

    func makeLayoutSection(layoutEnvironment: NSCollectionLayoutEnvironment) -> NSCollectionLayoutSection? {
        provider.makeLayoutSection(layoutEnvironment: layoutEnvironment)
    }

    func dequeueCell(_ collectionView: UICollectionView, _ indexPath: IndexPath, itemIdentifier: String) -> UICollectionViewCell {
        onConfigure()
        return provider.dequeueCell(collectionView, indexPath, itemIdentifier: itemIdentifier)
    }
}
