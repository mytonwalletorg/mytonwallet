//
//  PecentChartRenderer.swift
//  GraphTest
//
//  Created by Andrei Salavei on 4/7/19.
//  Copyright © 2019 Andrei Salavei. All rights reserved.
//

import Foundation
#if os(macOS)
import Cocoa
#else
import UIKit
#endif

class PecentChartRenderer: BaseChartRenderer {
    struct PercentageData {
        static let blank = PecentChartRenderer.PercentageData(locations: [], components: [])
        var locations: [CGFloat]
        var components: [Component]
        
        struct Component {
            var color: GColor
            var values: [CGFloat]
        }
    }
    
    override func setup(verticalRange: ClosedRange<CGFloat>, animated: Bool, timeFunction: TimeFunction? = nil) {
        super.setup(verticalRange: 0...1, animated: animated, timeFunction: timeFunction)
    }
    
    private var componentsAnimators: [AnimationController<CGFloat>] = []
    var percentageData: PercentageData = PercentageData(locations: [], components: []) {
        willSet {
            if percentageData.components.count != newValue.components.count {
                componentsAnimators = newValue.components.map { _ in AnimationController<CGFloat>(current: 1, refreshClosure: self.refreshClosure) }
            }
        }
        didSet {
            setNeedsDisplay()
        }
    }
    
    func setComponentVisible(_ isVisible: Bool, at index: Int, animated: Bool) {
        componentsAnimators[index].animate(to: isVisible ? 1 : 0, duration: animated ? .defaultDuration : 0)
    }
    
    override func render(context: CGContext, bounds: CGRect, chartFrame: CGRect) {
        guard isEnabled && horizontalRange.current.distance > 0 && verticalRange.current.distance > 0 else { return }
        let alpha = chartAlphaAnimator.current
        guard alpha > 0 else { return }
        
        let range = renderRange(bounds: bounds, chartFrame: chartFrame)
        
        let paths: [CGMutablePath] = percentageData.components.map { _ in CGMutablePath() }
        let visibility = componentsAnimators.map { $0.current }
        var vertices: [CGFloat] = Array<CGFloat>(repeating: 0, count: percentageData.components.count)
        var segmentIsOpen = false
        let baseline = transform(toChartCoordinateVertical: 0, chartFrame: chartFrame)

        func closeSegment(at x: CGFloat) {
            guard segmentIsOpen else { return }
            for (index, path) in paths.enumerated() {
                path.addLine(to: CGPoint(x: x, y: transform(toChartCoordinateVertical: vertices[index], chartFrame: chartFrame)))
                path.addLine(to: CGPoint(x: x, y: baseline))
                path.closeSubpath()
            }
            segmentIsOpen = false
        }

        if var locationIndex = percentageData.locations.firstIndex(where: { $0 > range.lowerBound }) {
            locationIndex = max(0, locationIndex - 1)
            
            var currentLocation = transform(toChartCoordinateHorizontal: percentageData.locations[locationIndex], chartFrame: chartFrame)

            while locationIndex < percentageData.locations.count {
                currentLocation = transform(toChartCoordinateHorizontal: percentageData.locations[locationIndex], chartFrame: chartFrame)
                var total: CGFloat = 0
                for (index, component) in percentageData.components.enumerated() {
                    total += component.values[locationIndex] * visibility[index]
                }

                if total > 0 {
                    var cumulativeValue: CGFloat = 0
                    for (index, component) in percentageData.components.enumerated() {
                        if !segmentIsOpen {
                            paths[index].move(to: CGPoint(x: currentLocation, y: baseline))
                        }
                        cumulativeValue += component.values[locationIndex] * visibility[index]
                        vertices[index] = cumulativeValue / total
                        paths[index].addLine(to: CGPoint(
                            x: currentLocation,
                            y: transform(toChartCoordinateVertical: vertices[index], chartFrame: chartFrame)
                        ))
                    }
                    segmentIsOpen = true
                } else {
                    // Shares are undefined at a zero total. End at this sample without bridging the gap.
                    closeSegment(at: currentLocation)
                }

                if percentageData.locations[locationIndex] > range.upperBound {
                    break
                }
                
                locationIndex += 1
            }
            
            closeSegment(at: currentLocation)
            
            for (index, path) in paths.enumerated().reversed() {
                if visibility[index] == 0 { continue }
                
                context.saveGState()
                context.beginPath()
                context.addPath(path)
                
                context.setFillColor(percentageData.components[index].color.cgColor)
                context.fillPath()
                context.restoreGState()
            }
        }
    }
}

extension PecentChartRenderer.PercentageData {
    static func horizontalRange(data: PecentChartRenderer.PercentageData) -> ClosedRange<CGFloat>? {
        guard let firstPoint = data.locations.first,
            let lastPoint = data.locations.last,
            firstPoint <= lastPoint else {
                return nil
        }
        
        return firstPoint...lastPoint
    }
}
