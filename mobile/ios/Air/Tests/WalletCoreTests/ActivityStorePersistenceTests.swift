import Foundation
import Testing
@testable import WalletCore

@Suite("Activity Store Persistence")
struct ActivityStorePersistenceTests {
    @Test(arguments: [false, true], [ApiTransactionStatus.pending, .pendingTrusted])
    func `BTC history without ETA preserves the websocket estimate`(isIncoming: Bool, status: ApiTransactionStatus) {
        let existing = activity(id: "btc", status: status, slug: "btc", isIncoming: isIncoming, etaSeconds: 600)
        let incoming = activity(id: "btc", status: .pending, slug: "btc", isIncoming: isIncoming)

        let result = preserveActivityStatusProgress(existingActivity: existing, incomingActivity: incoming)

        #expect(result.transaction?.etaSeconds == 600)
        #expect(result.transaction?.status == status)
    }

    @Test(arguments: [300, 0])
    func `explicit BTC estimates replace the previous ETA`(etaSeconds: Int) {
        let existing = activity(id: "btc", status: .pendingTrusted, slug: "btc", etaSeconds: 600)
        let incoming = activity(id: "btc", status: .pending, slug: "btc", etaSeconds: etaSeconds)

        let result = preserveActivityStatusProgress(existingActivity: existing, incomingActivity: incoming)

        #expect(result.transaction?.etaSeconds == etaSeconds)
        #expect(result.transaction?.status == .pendingTrusted)
    }

    @Test
    func `pending provider history does not revive a failed deposit`() throws {
        func swap(status: String, cexStatus: String) throws -> ApiActivity {
            let json = """
            {"kind":"swap","id":"swap::backend-swap","timestamp":1,
             "from":"doge","fromAmount":"3","to":"toncoin","toAmount":"1",
             "transactionIds":{},"status":"\(status)",
             "cex":{"payinAddress":"deposit","payoutAddress":"destination",
                    "transactionId":"provider-id","status":"\(cexStatus)"}}
            """
            return try JSONDecoder().decode(ApiActivity.self, from: Data(json.utf8))
        }
        let existing = try swap(status: "failed", cexStatus: "failed")
        let incoming = try swap(status: "pendingTrusted", cexStatus: "waiting")
        let result = preserveActivityStatusProgress(existingActivity: existing, incomingActivity: incoming)
        guard case .swap(let activity) = result else {
            Issue.record("Expected swap activity")
            return
        }
        #expect(activity.status == .failed)
        #expect(activity.cex?.status == .failed)
        #expect(activity.displayStatus() == .failed)
    }

    @Test
    func `persistence snapshot excludes local and pending activities`() {
        let local = activity(id: "local:local", status: .pendingTrusted)
        let pending = activity(id: "pending", status: .pending)
        let confirmed = activity(id: "confirmed", status: .confirmed)
        let state = _ActivityStore.AccountState(
            accountId: "0-mainnet",
            byId: [local.id: local, pending.id: pending, confirmed.id: confirmed],
            idsMain: [local.id, pending.id, confirmed.id],
            idsBySlug: ["toncoin": [local.id, pending.id, confirmed.id]],
            newestActivitiesBySlug: ["toncoin": local],
            isMainHistoryEndReached: false,
            isHistoryEndReachedBySlug: ["toncoin": false],
            localActivityIds: [local.id],
            pendingActivityIds: ["ton": [pending.id]],
            isInitialLoadedByChain: ["ton": true]
        )

        let snapshot = state.persistenceSnapshot()

        #expect(snapshot.byId == [confirmed.id: confirmed])
        #expect(snapshot.idsMain == [confirmed.id])
        #expect(snapshot.idsBySlug == ["toncoin": [confirmed.id]])
        #expect(snapshot.localActivityIds == nil)
        #expect(snapshot.pendingActivityIds == nil)
        #expect(snapshot.newestActivitiesBySlug == ["toncoin": confirmed])
        #expect(snapshot.isInitialLoadedByChain == ["ton": true])
    }
}

private func activity(
    id: String,
    status: ApiTransactionStatus,
    slug: String = "toncoin",
    isIncoming: Bool = false,
    etaSeconds: Int? = nil
) -> ApiActivity {
    .transaction(
        ApiTransactionActivity(
            id: id,
            kind: "transaction",
            externalMsgHashNorm: nil,
            timestamp: 0,
            amount: 0,
            fromAddress: "from",
            toAddress: "to",
            comment: nil,
            encryptedComment: nil,
            fee: 0,
            slug: slug,
            isIncoming: isIncoming,
            normalizedAddress: nil,
            type: nil,
            metadata: nil,
            nft: nil,
            status: status,
            etaSeconds: etaSeconds
        )
    )
}
