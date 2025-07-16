//
//  DateUtils.swift
//  WalletContext
//
//  Created by Sina on 5/18/23.
//

import Foundation

extension Date {
    
    public init(unixMs: Int) {
        self = Date(timeIntervalSince1970: Double(unixMs) / 1000.0)
    }
    
    func isEqual(to date: Date, toGranularity component: Calendar.Component, in calendar: Calendar = .current) -> Bool {
        calendar.isDate(self, equalTo: date, toGranularity: component)
    }

    public func isInSameDay(as date: Date) -> Bool { Calendar.current.isDate(self, inSameDayAs: date) }

    public func isInSameYear(as date: Date) -> Bool { isEqual(to: date, toGranularity: .year) }
    
    public var remainingFromNow: String {
        let calendar = Calendar.current
        let components = calendar.dateComponents([.hour, .minute, .second], from: Date(), to: self)
        
        if let hours = components.hour, let minutes = components.minute, let seconds = components.second {
            if hours > 0 {
                return String(format: "%02d:%02d:%02d", hours, minutes, seconds)
            } else if minutes >= 0 && seconds >= 0 {
                return String(format: "%02d:%02d", minutes, seconds)
            }
        }
        
        return "00:00"
    }

}

public func formatTimeInterval(_ s: TimeInterval) -> String {
    Duration.UnitsFormatStyle(allowedUnits: [.minutes, .seconds], width: .wide).format(.seconds(s))
}
