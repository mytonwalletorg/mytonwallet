
import Foundation
import WalletContext
import OrderedCollections

func mergeActivityIdsToMaxTime(_ array1: [String], _ array2: [String], byId: [String: ApiActivity]) -> [String] {
    if array1.isEmpty && array2.isEmpty {
        return []
    } else if array1.isEmpty && !array2.isEmpty {
        return Set(array2) // TODO: workaround for backend bug: normally ids should be unique
            .sorted { idA, idB in
                compareActivityIds(idA, idB, byId: byId)
            }
    } else if array2.isEmpty && !array1.isEmpty {
        return Set(array1) // TODO: workaround for backend bug: normally ids should be unique
            .sorted { idA, idB in
                compareActivityIds(idA, idB, byId: byId)
            }
    }
    
    let timestamp1 = byId[array1.last!]?.timestamp ?? 0
    let timestamp2 = byId[array2.last!]?.timestamp ?? 0
    let fromTimestamp = max(timestamp1, timestamp2)
    
    let filteredIds = Set(array1 + array2)
        .filter { id in
            (byId[id]?.timestamp ?? 0) >= fromTimestamp
        }
        .sorted { idA, idB in
            compareActivityIds(idA, idB, byId: byId)
        }
    return filteredIds
}

func mergeSortedActivityIds(_ ids0: [String], _ ids1: [String], byId: [String: ApiActivity]) -> [String] {
    // Not the best performance, but ok for now
    return Set(ids0 + ids1)
        .sorted { id0, id1 in
            compareActivityIds(id0, id1, byId: byId)
        }
}

func _getNewestActivitiesBySlug(
    byId: [String: ApiActivity],
    idsBySlug: [String: [String]],
    newestActivitiesBySlug: [String: ApiActivity]?,
    tokenSlugs: any Sequence<String>
) -> [String: ApiActivity] {
    var newestActivitiesBySlug = newestActivitiesBySlug ?? [:]
    
    for tokenSlug in tokenSlugs {
        // The `idsBySlug` arrays must be sorted from the newest to the oldest
        let ids = idsBySlug[tokenSlug] ?? [];
        let newestActivityId = ids.first { id in
            getIsIdSuitableForFetchingTimestamp(id) && byId[id] != nil
        }
        if let newestActivityId {
            newestActivitiesBySlug[tokenSlug] = byId[newestActivityId]
        } else {
            newestActivitiesBySlug[tokenSlug] = nil
        }
    }
    
    return newestActivitiesBySlug;
}

func getIsIdSuitableForFetchingTimestamp(_ id: String) -> Bool {
    !getIsIdLocal(id) && !getIsBackendSwapId(id)
}

func getIsIdLocal(_ id: String) -> Bool {
    id.hasSuffix(":local")
}

func getIsBackendSwapId(_ id: String) -> Bool {
    id.hasSuffix(":backend-swap")
}

func compareActivityIds(_ idA: String, _ idB: String, byId: [String: ApiActivity]) -> Bool {
    if let activityA = byId[idA], let activityB = byId[idB] {
        return activityA < activityB
    }
    assertionFailure("logic error")
    return idA > idB
}

/** Decides whether the local activity matches the activity from the blockchain */
func doesLocalActivityMatch(localActivity: ApiActivity, chainActivity: ApiActivity) -> Bool {
    
    if localActivity.extra?.withW5Gasless == true {
        if let localActivity = localActivity.transaction, let chainActivity = chainActivity.transaction {
            return !chainActivity.isIncoming && localActivity.normalizedAddress == chainActivity.normalizedAddress
            && localActivity.amount == chainActivity.amount
            && localActivity.slug == chainActivity.slug
        } else if let localActivity = localActivity.swap, let chainActivity = chainActivity.swap {
            return localActivity.from == chainActivity.from
            && localActivity.to == chainActivity.to
            && localActivity.fromAmount == chainActivity.fromAmount
        }
    }
    
    if let localActivityExternalMsgHash = localActivity.externalMsgHash {
        return localActivityExternalMsgHash == chainActivity.externalMsgHash && chainActivity.shouldHide != true
    }
    
    return localActivity.parsedTxId.hash == chainActivity.parsedTxId.hash
}

/**
 * Finds the ids of the local activities that match any of the new blockchain activities (those are to be replaced).
 * Also finds the ids of the blockchain activities that have no matching local activities (those are to be notified about).
 */
func splitReplacedAndNewActivities(localActivities: [ApiActivity], incomingActivities: [ApiActivity]) -> (replacedLocalIds: [String: String], newActivities: [ApiActivity]) {
    
    var replacedLocalIds: [String: String] = [:]
    var newActivities: [ApiActivity] = []
    
    for  incomingActivity in incomingActivities {
        var hasLocalMatch = false
        
        for localActivity in localActivities where doesLocalActivityMatch(localActivity: localActivity, chainActivity: incomingActivity) {
            replacedLocalIds[localActivity.id] = incomingActivity.id
            hasLocalMatch = true
        }
        
        if !hasLocalMatch {
            newActivities.append(incomingActivity)
        }
    }
    
    return (replacedLocalIds, newActivities)
}

func buildActivityIdsBySlug(_ activities: [ApiActivity]) -> [String: [String]] {
    return activities.reduce(into: [:]) { acc, activity in
        for slug in getActivityTokenSlugs(activity) {
            acc[slug, default: []].append(activity.id)
        }
    }
}

func getActivityTokenSlugs(_ activity: ApiActivity) -> [String] {
    switch activity {
    case .transaction(let tx):
        if tx.nft != nil {
            return [] // We don't want NFT activities to get into any token activity list
        }
        return [tx.slug]
    case .swap(let swap):
        return [swap.from, swap.to]
    }
}

func getActivityListTokenSlugs(activityIds: Set<String>, byId: [String: ApiActivity]) -> Set<String> {
    var tokenSlugs = Set<String>()
    
    for id in activityIds {
        if let activity = byId[id] {
            for tokenSlug in getActivityTokenSlugs(activity) {
                tokenSlugs.insert(tokenSlug)
            }
        }
    }
    
    return tokenSlugs
}
