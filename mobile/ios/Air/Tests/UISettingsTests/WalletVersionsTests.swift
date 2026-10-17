import UIKit
import WalletResources
import XCTest
@testable import UISettings
@testable import WalletCore

@MainActor
final class WalletVersionsTests: XCTestCase {
    func testRepeatedW5RowsOpenAndResolveToTheirOwnWallets() async throws {
        _ = WalletResourcesBundle.bundle.load()
        let previousData = AccountStore.walletVersionsData
        defer { AccountStore.walletVersionsData = previousData }

        // Addresses derived from a zero-filled public key; these are synthetic wallet-discovery data.
        let testnetW5: [String: Any] = [
            "version": "W5", "address": "0QAU7whfZW_H1lyTXrdNlH63HrHwIbGJ05EZzp3iknlET-kr",
            "balance": "bigint:1000000000", "isInitialized": true,
            "isTestnetSubwalletId": true,
        ]
        let legacyW5: [String: Any] = [
            "version": "W5", "address": "0QDg6S-r4rdNU-PuvgSGv1SIfyEtP3m4hFkzR7g0t3ayCsmn",
            "balance": "bigint:2000000000", "isInitialized": true,
            "isTestnetSubwalletId": false,
        ]
        let v3: [String: Any] = [
            "version": "v3R2", "address": "0QCg5fZTvtgMoA8SoJ6GA01Q8SNfQ-X55XgkOMiEiZOP8dQa", "balance": "bigint:0",
        ]

        // A non-W5 source can receive both W5 variants. An identical repeated record is not another choice.
        for currentVersion in ["v4R2", nil] as [String?] {
            var update: [String: Any] = ["versions": [testnetW5, legacyW5, testnetW5, v3]]
            update["currentVersion"] = currentVersion
            AccountStore.walletVersionsData = MWalletVersionsData(dictionary: update)

            let vc = WalletVersionsVC()
            let navigation = UINavigationController(rootViewController: vc)
            let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 390, height: 844))
            window.rootViewController = navigation
            window.makeKeyAndVisible()
            defer { window.isHidden = true }
            navigation.view.frame = window.bounds
            navigation.view.layoutIfNeeded()
            vc.loadViewIfNeeded()
            window.layoutIfNeeded()
            vc.view.layoutIfNeeded()
            try await Task.sleep(for: .milliseconds(100))

            let collection = try XCTUnwrap(vc.view.subviews.compactMap { $0 as? UICollectionView }.first)
            let section = currentVersion == nil ? 0 : 1
            XCTAssertEqual(collection.numberOfSections, section + 1)
            XCTAssertEqual(collection.numberOfItems(inSection: section), 3)
            let first = IndexPath(item: 0, section: section)
            let second = IndexPath(item: 1, section: section)
            let third = IndexPath(item: 2, section: section)
            XCTAssertEqual(vc.walletVersion(at: first)?.address, testnetW5["address"] as? String)
            XCTAssertEqual(vc.walletVersion(at: first)?.isTestnetSubwalletId, true)
            XCTAssertEqual(vc.walletVersion(at: second)?.address, legacyW5["address"] as? String)
            XCTAssertEqual(vc.walletVersion(at: second)?.isTestnetSubwalletId, false)
            XCTAssertEqual(vc.walletVersion(at: third)?.version, "v3R2")
            XCTAssertNil(vc.walletVersion(at: third)?.isTestnetSubwalletId)
            XCTAssertTrue(vc.collectionView(collection, shouldSelectItemAt: first))
            XCTAssertTrue(vc.collectionView(collection, shouldSelectItemAt: second))
            XCTAssertNotNil(collection.cellForItem(at: first))
            XCTAssertNotNil(collection.cellForItem(at: second))
            if currentVersion != nil {
                XCTAssertFalse(vc.collectionView(collection, shouldSelectItemAt: IndexPath(item: 0, section: 0)))
            }

            let image = UIGraphicsImageRenderer(bounds: navigation.view.bounds).image { context in
                navigation.view.layer.render(in: context.cgContext)
            }
            let attachment = XCTAttachment(image: image)
            attachment.name = "Repeated W5 choices - current version \(currentVersion ?? "unknown")"
            attachment.lifetime = .keepAlways
            add(attachment)
        }
    }
}
