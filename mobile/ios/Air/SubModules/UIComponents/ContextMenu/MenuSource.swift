
import UIKit
import SwiftUI


extension View {
    
    @ViewBuilder
    public func menuSource<MenuContent: View>(
        isEnabled: Bool,
        coordinateSpace: CoordinateSpace,
        menuContext: MenuContext,
        @ViewBuilder menuContent: @escaping () -> MenuContent
    ) -> some View {
        if isEnabled {
            modifier(MenuSourceViewModifier(coordinateSpace: coordinateSpace, menuContext: menuContext, menuContent: menuContent))
        } else {
            self
        }
    }
}

struct MenuSourceViewModifier<MenuContent: View>: ViewModifier {
    
    private var coordinateSpace: CoordinateSpace
    private var menuContext: MenuContext
    private let target: CGFloat = 10
    private var menuContent: () -> MenuContent
    
    init(coordinateSpace: CoordinateSpace, menuContext: MenuContext, @ViewBuilder menuContent: @escaping () -> MenuContent) {
        self.coordinateSpace = coordinateSpace
        self.menuContext = menuContext
        self.menuContent = menuContent
    }
    
    func body(content: Content) -> some View {
        content
            .padding(8)
            .contentShape(.rect)
            .gesture(tapGesture)
            .gesture(holdAndDragGesture)
            .padding(-8)
            .onGeometryChange(for: CGRect.self, of: { $0.frame(in: coordinateSpace) }, action: { menuContext.sourceFrame = $0 })
            .animation(.snappy, value: menuContext.menuShown)
            .environmentObject(menuContext)
    }
    
    var tapGesture: some Gesture {
        TapGesture().onEnded({
            showMenu()
        })
    }
    
    var holdAndDragGesture: some Gesture {
        LongPressGesture(minimumDuration: 0.25, maximumDistance: 10)
            .sequenced(before: DragGesture(minimumDistance: 0, coordinateSpace: .global))
            .onChanged { v in
                switch v {
                case .first:
                    break
                case .second(_, let drag):
                    showMenu()
                    if let drag {
                        menuContext.update(location: drag.location)
                    }
                }
            }
            .onEnded { v in
                switch v {
                case .first(_):
                    break
                case .second(_, _):
                    menuContext.triggerCurrentAction()
                }
            }
    }
    
    func showMenu() {
        if !menuContext.menuShown {
            if let view = getMenuLayerView() {
                view.showMenu(menuContext: menuContext, content: menuContent)
            }
        }
    }
}
