import Testing
@testable import WalletCore

@Suite("Wallet version identity")
struct WalletVersionsDataTests {
    @Test
    func balancesAndInitializationDoNotChangeWalletIdentity() {
        let before = MWalletVersionsData.Version(dictionary: [
            "version": "W5", "address": "testnet-w5", "balance": "bigint:0",
            "isInitialized": false, "isTestnetSubwalletId": true,
        ])
        let after = MWalletVersionsData.Version(dictionary: [
            "version": "W5", "address": "testnet-w5", "balance": "bigint:123",
            "isInitialized": true, "isTestnetSubwalletId": true,
        ])
        #expect(before.id == after.id)
        #expect(before.balance != after.balance)
        #expect(before.isInitialized != after.isInitialized)
    }
}
