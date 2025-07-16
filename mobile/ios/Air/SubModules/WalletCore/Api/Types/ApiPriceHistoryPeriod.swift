
import Foundation
import WalletContext

public enum ApiPriceHistoryPeriod: String, CaseIterable, Equatable, Hashable, Codable, Sendable {
    case day = "1D"
    case week = "7D"
    case month = "1M"
    case threeMonths = "3M"
    case year = "1Y"
    case all = "ALL"
    
    public var localized: String {
        switch self {
        case .day:
            WStrings.Token_Day.localized
        case .week:
            WStrings.Token_Week.localized
        case .month:
            WStrings.Token_Month.localized
        case .threeMonths:
            WStrings.Token_ThreeMonths.localized
        case .year:
            WStrings.Token_Year.localized
        case .all:
            WStrings.Token_All.localized
        }
    }
}
