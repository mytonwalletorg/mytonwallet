
import SwiftUI
import UIKit
import WalletContext

public extension EnvironmentValues {
    @Entry var segmentedControlItemIsTopLayer: Bool = false
    @Entry var segmentedControlItemIsSelected: Bool = false
    @Entry var segmentedControlItemDistanceToSelection: CGFloat = .infinity
    @Entry var segmentedControlItemSelectionIsClose: Bool = false
}

public final class WSegmentedControl: HostingView {
    
    public let model: SegmentedControlModel
    
    public init(model: SegmentedControlModel? = nil) {
        let model = model ?? SegmentedControlModel(items: [])
        self.model = model
        super.init {
            SegmentedControl(model: model)
        }
    }
}


public struct SegmentedControl: View {
    
    @ObservedObject private var model: SegmentedControlModel
    
    @State private var elementSizes: [String: CGRect] = [:]
    
    @Namespace private var ns
    
    public init(model: SegmentedControlModel) {
        self.model = model
    }
    
    public var body: some View {
        ZStack {
//            Color.blue.opacity(0.1)
//                .border(Color.blue, width: 4)
//                .frame(maxWidth: .infinity)
            ViewThatFits(in: .horizontal) {
                content
                    .fixedSize()
                    .compositingGroup()
                    .padding(.horizontal)
//                    .background(Color.red)
                ScrollView(.horizontal) {
                    content
                        .padding(.horizontal)
                }
            }
        }
        .scrollIndicators(.hidden)
        .backportScrollClipDisabled()
        .backportScrollBounceBehaviorBasedOnSize()
        .backportContentMargins(16)
        .allowsHitTesting(!model.isReordering)
        .overlay {
            if model.isReordering {
                ZStack {
                    Color(WTheme.groupedItem)
                        .padding(.vertical, -2) // fully hide main content
                    SegmentedControlReordering(model: model)
                }
            }
        }
        .environmentObject(model)
        .coordinateSpace(name: ns)
    }
    
    var content: some View {
        ZStack {
            makeItems(topLayer: false)
                .foregroundStyle(Color(model.secondaryColor))
                .overlay {
                    GeometryReader { geom in
                        if let selection = model.selection, let frame = frameForSelection(selection) {
                            Capsule()
                                .fill(Color(model.capsuleColor))
                                .matchedGeometryEffect(id: "capsule", in: ns, properties: .frame, anchor: .center, isSource: true)
                                .frame(width: frame.width, height: frame.height)
                                .offset(x: frame.minX, y: frame.minY)
                                .allowsHitTesting(false)
                        }
                    }
                }

            makeItems(topLayer: true)
                .foregroundStyle(Color(model.primaryColor))
                .mask {
                    Capsule()
                        .matchedGeometryEffect(id: "capsule", in: ns, properties: .frame, anchor: .center, isSource: false)
                }
        }
        .font(model.font)
        .coordinateSpace(name: ns)
    }
    
    @ViewBuilder
    func makeItems(topLayer: Bool) -> some View {
        HStack(spacing: 0) {
            HStack(spacing: 8) {
                ForEach(model.items) { item in
                    ZStack {
                        makeItem(item: item, topLayer: topLayer)
                        if !topLayer {
                            Color.clear
                                .contentShape(.capsule)
                                .onTapGesture {
                                    model.onSelect(item)
                                }
                        }
                    }
                }
            }
        }
    }
    
    @ViewBuilder
    func makeItem(item: SegmentedControlItem, topLayer: Bool) -> some View {
        let isSelected = model.selectedItem?.id == item.id
        let distance = model.distanceToItem(itemId: item.id)
        let showAccessory = distance < 0.2
        
        HStack(spacing: 2.667) {
            item.content
                .fixedSize()
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 4.333)
        .onGeometryChange(
            for: CGRect.self,
            of: { $0.frame(in: .named(ns)) },
            action: { newValue in
                elementSizes[item.id] = newValue
            }
        )
        .environment(\.segmentedControlItemIsTopLayer, topLayer)
        .environment(\.segmentedControlItemIsSelected, isSelected)
        .environment(\.segmentedControlItemDistanceToSelection, distance)
        .environment(\.segmentedControlItemSelectionIsClose, showAccessory)
        .allowsHitTesting(isSelected)
    }
    
    func frameForSelection(_ selection: SegmentedControlSelection) -> CGRect? {
        guard let frame1 = elementSizes[selection.item1] else { return nil }
        guard let item2 = selection.item2, let frame2 = elementSizes[item2] else { return frame1 }
        let progress = selection.progress ?? 0
        return interpolate(from: frame1, to: frame2, progress: progress)
    }
}
