
import GRDB
import Foundation
import WalletContext
import OrderedCollections

private let log = Log("ActivityStore")
private let TX_AGE_TO_PLAY_SOUND = 60.0 // 1 min

public let ActivityStore = _ActivityStore.shared

public actor _ActivityStore: WalletCoreData.EventsObserver {
    
    public static let shared = _ActivityStore()
    
    // MARK: Data
    
    struct AccountState: Equatable, Hashable, Codable, FetchableRecord, PersistableRecord {
        var accountId: String
        var byId: [String: ApiActivity]?
        var idsMain: [String]?
        var idsBySlug: [String: [String]]?
        var newestActivitiesBySlug: [String: ApiActivity]?
        var isInitialLoadedByChain: [String: Bool]?
        var localActivities: [ApiActivity]?
        var isHistoryEndReachedBySlug: [String: Bool]?
        var isMainHistoryEndReached: Bool?
        
        static var databaseTableName: String = "account_activities"
    }
    
    private var byAccountId: [String: AccountState] = [:]
    
    private func withAccountState<T>(_ accountId: String, updates: (inout AccountState) -> T) -> T {
        defer { save(accountId: accountId) }
        return updates(&byAccountId[accountId, default: .init(accountId: accountId)])
    }
    
    func getAccountState(_ accountId: String) -> AccountState {
        byAccountId[accountId, default: .init(accountId: accountId)]
    }
    
    private var _db: (any DatabaseWriter)?
    private var db: any DatabaseWriter {
        get throws {
            try _db.orThrow("database not ready")
        }
    }
    
    private var notifiedIds: Set<String> = []
    
    private var lastApplicationWillEnterForeground: Date
    private var timeSinceLastApplicationWillEnterForeground: Double { Date.now.timeIntervalSince(lastApplicationWillEnterForeground)}
    
    // MARK: - Event handling
    
    private init() {
        // event observer will be added after cache is loaded
        lastApplicationWillEnterForeground = .now
    }
    
    nonisolated public func walletCore(event: WalletCoreData.Event) {
        Task {
            await handleEvent(event)
        }
    }
    
    private func handleEvent(_ event: WalletCoreData.Event) async {
        switch event {
        case .initialActivities(let update):
            handleInitialActivities(update: update)
        case .newActivities(let update):
            handleNewActivities(update: update)
        case .newLocalActivity(let update):
            await handleNewLocalActivity(update: update)
        case .applicationWillEnterForeground:
            await handleApplicationWillEnterForeground()
        default:
            break
        }
    }
    
    private func handleInitialActivities(update: ApiUpdate.InitialActivities) {
        log.info("handleInitialActivities \(update.accountId, .public) mainIds=\(update.mainActivities.count)")
        putInitialActivities(accountId: update.accountId, mainActivities: update.mainActivities, bySlug: update.bySlug);
        if let chain = update.chain {
            setIsInitialActivitiesLoadedTrue(accountId: update.accountId, chain: chain);
        }
        WalletCoreData.notify(event: .activitiesChanged(accountId: update.accountId))
        log.info("handleInitialActivities \(update.accountId, .public) [done] mainIds=\(update.mainActivities.count)")
    }
    
    private func handleNewActivities(update: ApiUpdate.NewActivities, forceReload: Bool = false) {
        log.info("handleNewActivities \(update.accountId, .public) sinceForeground=\(timeSinceLastApplicationWillEnterForeground) forceReload=\(forceReload) mainIds=\(getAccountState(update.accountId).idsMain?.count ?? -1) inUpdate=\(update.activities.count)")
        
        let localActivities = selectLocalActivities(accountId: update.accountId) ?? []
        let (replacedLocalIds, newActivities) = splitReplacedAndNewActivities(localActivities: localActivities, incomingActivities: update.activities)
        
        removeActivities(accountId: update.accountId, deleteIds: Array(replacedLocalIds.keys))
        addNewActivities(accountId: update.accountId, newActivities: update.activities)
        
        // TODO: Update open ActivityVC if activity has changed
        notifyAboutNewActivities(newActivities: newActivities)
        
        // TODO: Copy from web app: processCardMintingActivity
        // NFT polling is executed at long intervals, so it is more likely that a user will see a new transaction
        // rather than receiving a card in the collection. Therefore, when a new activity occurs,
        // we check for a card from the MyTonWallet collection and apply it.
        //        global = processCardMintingActivity(global, accountId, incomingActivities);
        
        if let chain = update.chain {
            setIsInitialActivitiesLoadedTrue(accountId: update.accountId, chain: chain);
        }
        WalletCoreData.notify(event: .activitiesChanged(accountId: update.accountId))
        log.info("handleNewActivities \(update.accountId, .public) [done] mainIds=\(getAccountState(update.accountId).idsMain?.count ?? -1) inUpdate=\(update.activities.count)")
    }
    
    private func handleNewLocalActivity(update: ApiUpdate.NewLocalActivity) {
        log.info("newLocalActivity \(update.accountId, .public)")
        addNewActivities(accountId: update.accountId, newActivities: [update.activity])
        WalletCoreData.notify(event: .activitiesChanged(accountId: update.accountId))
    }

    private func handleApplicationWillEnterForeground() async {
        self.lastApplicationWillEnterForeground = .now
        log.info("handleApplicationWillEnterForeground \(lastApplicationWillEnterForeground, .public)")
        do {
            try await AccountStore.reactivateCurrentAccount()
            await forceReload(dryRun: false)
            try await Task.sleep(for: .seconds(0.5))
            try await AccountStore.reactivateCurrentAccount()
        } catch {
            log.error("handleApplicationWillEnterForeground: \(error, .public)")
        }
    }
    
    // MARK: - Fetch methods
    
    func fetchAllTransactions(accountId: String, limit: Int, shouldLoadWithBudget: Bool) async throws {
        let tronTokenSlugs = selectAccountTxTokenSlugs(accountId: accountId, chain: .tron) ?? []
        
        var toTimestamp = selectLastMainTxTimestamp(accountId: accountId)
        var fetchedActivities: [ApiActivity] = []
        
        while true {
            let result = try await Api.fetchAllActivitySlice(accountId: accountId, limit: limit, toTimestamp: toTimestamp, tronTokenSlugs: tronTokenSlugs)
            if result.isEmpty {
                updateActivitiesIsHistoryEndReached(accountId: accountId, slug: nil, isReached: true)
                break
            }
            var filteredResult = result
            if AppStorageHelper.hideTinyTransfers {
                filteredResult = filteredResult.filter {
                    !$0.isTinyOrScamTransaction
                }
            }
            fetchedActivities.append(contentsOf: result)
            if filteredResult.count >= limit || fetchedActivities.count >= limit {
                break
            }
            toTimestamp = result.last!.timestamp
        }
        
        fetchedActivities.sort(by: <)
        
        let accountState = getAccountState(accountId)
        var byId = accountState.byId ?? [:]
        var newIds: [String] = []
        for activity in fetchedActivities {
            // TODO: remove temporary workaround
            if activity.type == .callContract && byId[activity.id] != nil {
                continue
            }
            byId[activity.id] = activity
            newIds.append(activity.id)
        }
        
        var idsMain = Array(OrderedSet(
            (accountState.idsMain ?? []) + newIds
        ))
        idsMain.sort {
            compareActivityIds($0, $1, byId: byId)
        }
        
        withAccountState(accountId) {
            $0.byId = byId
            $0.idsMain = idsMain
        }
        
        log.info("[inf] got new ids: \(newIds.count)")
        WalletCoreData.notify(event: .activitiesChanged(accountId: accountId))
        
        if shouldLoadWithBudget {
            await Task.yield()
            try await fetchAllTransactions(accountId: accountId, limit: limit, shouldLoadWithBudget: false)
        }
    }
    
    func fetchTokenTransactions(accountId: String, limit: Int, token: ApiToken, shouldLoadWithBudget: Bool) async throws {
        var accountState = getAccountState(accountId)
        var idsBySlug = accountState.idsBySlug ?? [:]
        var byId = accountState.byId ?? [:]
        
        var fetchedActivities: [ApiActivity] = []
        var tokenIds = idsBySlug[token.slug] ?? []
        var toTimestamp = tokenIds
            .last(where: { getIsIdSuitableForFetchingTimestamp($0) && byId[$0] != nil })
            .flatMap { id in byId[id]?.timestamp }
        let chain = token.chainValue
        
        while true {
            let result = try await Api.fetchActivitySlice(accountId: accountId, chain: chain, slug: token.slug, fromTimestamp: nil, toTimestamp: toTimestamp, limit: limit)
            if result.isEmpty {
                updateActivitiesIsHistoryEndReached(accountId: accountId, slug: token.slug, isReached: true)
                break
            }
            var filteredResult = result
            if AppStorageHelper.hideTinyTransfers {
                filteredResult = filteredResult.filter {
                    !$0.isTinyOrScamTransaction
                }
            }
            fetchedActivities.append(contentsOf: result)
            if filteredResult.count >= limit || fetchedActivities.count >= limit {
                break
            }
            toTimestamp = result.last!.timestamp
        }
        
        fetchedActivities.sort(by: <)
        
        accountState = getAccountState(accountId)
        byId = getAccountState(accountId).byId ?? [:]
        var newIds: [String] = []
        for activity in fetchedActivities {
            // TODO: remove temporary workaround
            if activity.type == .callContract && byId[activity.id] != nil {
                continue
            }
            byId[activity.id] = activity
            newIds.append(activity.id)
        }
        
        idsBySlug = accountState.idsBySlug ?? [:]
        
        tokenIds = Array(OrderedSet(
            tokenIds + newIds
        ))
        tokenIds.sort {
            compareActivityIds($0, $1, byId: byId)
        }
        idsBySlug = accountState.idsBySlug ?? [:]
        idsBySlug[token.slug] = tokenIds
        
        withAccountState(accountId) {
            $0.byId = byId
            $0.idsBySlug = idsBySlug
        }
        
        log.info("[inf] got new ids \(token.slug): \(newIds.count)")
        WalletCoreData.notify(event: .activitiesChanged(accountId: accountId))
        
        if shouldLoadWithBudget {
            await Task.yield()
            try await fetchTokenTransactions(accountId: accountId, limit: limit, token: token, shouldLoadWithBudget: false)
        }
    }
    
    @available(*, deprecated, message: "shouldn't be needed")
    private func forceReload(dryRun: Bool) async {
        do {
            if let accountId = AccountStore.accountId {
                log.info("forceReload sinceForeground=\(timeSinceLastApplicationWillEnterForeground) ")
                let tronTokenSlugs = selectAccountTxTokenSlugs(accountId: accountId, chain: .tron) ?? []
                let result = try await Api.fetchAllActivitySlice(accountId: accountId, limit: 60, toTimestamp: nil, tronTokenSlugs: tronTokenSlugs)
                if !dryRun {
                    handleNewActivities(update: .init(accountId: accountId, chain: nil, activities: result), forceReload: true)
                }
                log.info("forceReload [done] sinceForeground=\(timeSinceLastApplicationWillEnterForeground)")
            }
        } catch {
            log.error("forceReload: \(error)")
        }
    }
    
    // MARK: - Activity details
    
    public func getActivity(accountId: String, activityId: String) -> ApiActivity? {
        getAccountState(accountId).byId?[activityId]
    }
    
    public func fetchActivityDetails(accountId: String, activity: ApiActivity) async throws -> ApiActivity {
        let activity = try await Api.fetchTonActivityDetails(accountId: accountId, activity: activity)
        withAccountState(accountId) {
            var byId = $0.byId ?? [:]
            // TODO: remove temporary workaround
            if activity.type == .callContract && byId[activity.id] != nil {
                return
            }
            byId[activity.id] = activity
            $0.byId = byId
        }
        WalletCoreData.notify(event: .activitiesChanged(accountId: accountId))
        return activity
    }
    
    // MARK: - Persistence
    
    func use(db: any DatabaseWriter) {
        self._db = db
        do {
            let accountStates = try db.read { db in
                try AccountState.fetchAll(db)
            }
            updateFromDb(accountStates: accountStates)
        } catch {
            log.error("accountStates intial load: \(error, .public)")
        }
        WalletCoreData.add(eventObserver: self)
    }
    
    private func updateFromDb(accountStates: [AccountState]) {
        log.info("updateFromDb accounts=\(accountStates.count)")
        let newByAccountId = accountStates.dictionaryByKey(\.accountId)
        let oldByAccountId = self.byAccountId
        self.byAccountId = newByAccountId
        for (accountId, newAccountState) in newByAccountId {
            if oldByAccountId[accountId] != newAccountState {
                WalletCoreData.notify(event: .activitiesChanged(accountId: accountId))
            }
        }
    }
    
    func getNewestActivitiesBySlug(accountId: String) -> [String: ApiActivity]? {
        getAccountState(accountId).newestActivitiesBySlug
    }
    
    private func save(accountId: String) {
        do {
            let accountState = getAccountState(accountId)
            try db.write { db in
                try accountState.upsert(db)
            }
        } catch {
            log.error("save error: \(error, .public)")
        }
    }
    
    func clean() {
        byAccountId = [:]
        do {
            _ = try db.write { db in
                try AccountState.deleteAll(db)
            }
        } catch {
            log.error("clean failed: \(error)")
        }
    }
    
    // MARK: - Impl
    
    /**
     Used for the initial activities insertion into `global`.
     Token activity IDs will just be replaced.
     */
    private func putInitialActivities(accountId: String, mainActivities: [ApiActivity], bySlug: [String: [ApiActivity]]) {
        
        let currentState = getAccountState(accountId)
        
        var byId = currentState.byId ?? [:]
        let allActivities = mainActivities + bySlug.values.flatMap { $0 }
        for activity in allActivities {
            // TODO: remove temporary workaround
            if activity.type == .callContract && byId[activity.id] != nil {
                continue
            }
            byId[activity.id] = activity
        }
        
        // Activities from different blockchains arrive separately, which causes the order to be disrupted
        let idsMain = mergeActivityIdsToMaxTime(mainActivities.map(\.id), currentState.idsMain ?? [], byId: byId)
        
        var idsBySlug = currentState.idsBySlug ?? [:]
        let newIdsBySlug = bySlug.mapValues { $0.map(\.id) }
        for (slug, ids) in newIdsBySlug {
            idsBySlug[slug] = ids
        }
        
        let newestActivitiesBySlug = _getNewestActivitiesBySlug(byId: byId, idsBySlug: idsBySlug, newestActivitiesBySlug: currentState.newestActivitiesBySlug, tokenSlugs: newIdsBySlug.keys)
        
        withAccountState(accountId) {
            $0.byId = byId
            $0.idsMain = idsMain
            $0.idsBySlug = idsBySlug
            $0.newestActivitiesBySlug = newestActivitiesBySlug
        }
    }
    
    private func addNewActivities(accountId: String, newActivities: [ApiActivity]) {
        if newActivities.isEmpty {
            return
        }
        
        let currentState = getAccountState(accountId)
        
        var byId = currentState.byId ?? [:]
        for activity in newActivities {
            // TODO: remove temporary workaround
            if activity.type == .callContract && byId[activity.id] != nil {
                continue
            }
            byId[activity.id] = activity
        }
        
        // Activities from different blockchains arrive separately, which causes the order to be disrupted
        let idsMain = mergeSortedActivityIds(newActivities.map(\.id), currentState.idsMain ?? [], byId: byId)
        
        var idsBySlug = currentState.idsBySlug ?? [:]
        let newIdsBySlug = buildActivityIdsBySlug(newActivities)
        for (slug, newIds) in newIdsBySlug {
            let mergedIds = mergeSortedActivityIds(newIds, currentState.idsBySlug?[slug] ?? [], byId: byId)
            idsBySlug[slug] = mergedIds
        }
        
        let newestActivitiesBySlug = _getNewestActivitiesBySlug(byId: byId, idsBySlug: idsBySlug, newestActivitiesBySlug: currentState.newestActivitiesBySlug, tokenSlugs: newIdsBySlug.keys)
        
        var localActivities = currentState.localActivities ?? []
        let newIds = newActivities.filter { getIsIdLocal($0.id) }.map(\.id)
        localActivities = localActivities.filter { !newIds.contains($0.id) }
        localActivities.append(contentsOf: newActivities.filter { getIsIdLocal($0.id) })
        
        withAccountState(accountId) {
            $0.byId = byId
            $0.idsMain = idsMain
            $0.idsBySlug = idsBySlug
            $0.newestActivitiesBySlug = newestActivitiesBySlug
            $0.localActivities = localActivities
        }
    }
    
    private func setIsInitialActivitiesLoadedTrue(accountId: String, chain: ApiChain) {
        withAccountState(accountId) {
            var isInitialLoadedByChain = $0.isInitialLoadedByChain ?? [:]
            isInitialLoadedByChain[chain.rawValue] = true
            $0.isInitialLoadedByChain = isInitialLoadedByChain
        }
    }
    
    private func selectLocalActivities(accountId: String) -> [ApiActivity]? {
        byAccountId[accountId]?.localActivities
    }
    
    private func removeActivities(accountId: String, deleteIds: [String]) {
        let currentState = getAccountState(accountId)
        let ids = Set(deleteIds)
        guard !ids.isEmpty else { return }
        
        let affectedTokenSlugs = getActivityListTokenSlugs(activityIds: ids, byId: currentState.byId ?? [:])
        
        var idsBySlug = currentState.idsBySlug ?? [:]
        for tokenSlug in affectedTokenSlugs {
            if let idsForSlug = idsBySlug[tokenSlug] {
                idsBySlug[tokenSlug] = idsForSlug.filter { !ids.contains($0) }
            }
        }
        
        let newestActivitiesBySlug = _getNewestActivitiesBySlug(byId: currentState.byId ?? [:], idsBySlug: idsBySlug, newestActivitiesBySlug: currentState.newestActivitiesBySlug, tokenSlugs: affectedTokenSlugs)
        
        let idsMain = currentState.idsMain?.filter { !ids.contains($0) }
        
        let byId = currentState.byId?.filter { id, _ in !ids.contains(id) }
        
        let localActivities = currentState.localActivities?.filter { !ids.contains($0.id) }
        
        withAccountState(accountId) {
            $0.byId = byId
            $0.idsMain = idsMain
            $0.idsBySlug = idsBySlug
            $0.newestActivitiesBySlug = newestActivitiesBySlug
            $0.localActivities = localActivities
        }
    }
    
    private func selectAccountTxTokenSlugs(accountId: String, chain: ApiChain) -> [String]? {
        if let idsBySlug = getAccountState(accountId).idsBySlug {
            return idsBySlug.keys.filter { $0.hasPrefix(chain.rawValue)}
        }
        return nil
    }
    
    private func selectLastMainTxTimestamp(accountId: String) -> Int64? {
        let activities = getAccountState(accountId)
        let txId = activities.idsMain?.last(where: { getIsIdSuitableForFetchingTimestamp($0) })
        if let txId {
            return activities.byId?[txId]?.timestamp
        }
        return nil
    }
    
    private func updateActivitiesIsHistoryEndReached(accountId: String, slug: String?, isReached: Bool) {
        withAccountState(accountId) {
            if let slug {
                var isHistoryEndReachedBySlug = $0.isHistoryEndReachedBySlug ?? [:]
                isHistoryEndReachedBySlug[slug] = isReached
                $0.isHistoryEndReachedBySlug = isHistoryEndReachedBySlug
            } else {
                $0.isMainHistoryEndReached = isReached
            }
        }
    }
    
    private func notifyAboutNewActivities(newActivities: [ApiActivity]) {
        for activity in newActivities {
            if case .transaction(let tx) = activity,
                tx.isIncoming,
                Date.now.timeIntervalSince(activity.timestampDate) < TX_AGE_TO_PLAY_SOUND,
               !(AppStorageHelper.hideTinyTransfers && activity.isTinyOrScamTransaction),
               // TODO: !getIsTransactionWithPoisoning(activity)
               AppStorageHelper.sounds,
               WalletContextManager.delegate?.isAppUnlocked == true,
               !notifiedIds.contains(activity.id) {
                log.info("notifying about tx: \(activity, .public)")
                AudioHelpers.play(sound: .incomingTransaction)
                break
            }
        }
        notifiedIds = notifiedIds.union(newActivities.map(\.id))
    }
}
