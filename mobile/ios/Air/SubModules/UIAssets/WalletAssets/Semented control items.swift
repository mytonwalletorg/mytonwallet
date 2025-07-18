
import SwiftUI
import UIKit
import UIComponents
import WalletCore
import WalletContext

struct AllNftsItem: View {
    
    var accountId: String
    @ObservedObject var menuContext: MenuContext
    
    @EnvironmentObject private var segmentedControl: SegmentedControlModel
    
    @Environment(\.segmentedControlItemSelectionIsClose) private var showAccessory: Bool
    @Environment(\.segmentedControlItemIsTopLayer) private var isTopLayer: Bool
    @Environment(\.segmentedControlItemDistanceToSelection) private var distance: CGFloat
    @Environment(\.segmentedControlItemIsSelected) private var isSelected: Bool
    
    var body: some View {
        let distance = clamp(distance, min: 0, max: 1)
        
        HStack(spacing: 2.666) {
            Text("Collectibles")

            Image(systemName: "ellipsis.circle.fill")
                .imageScale(.small)
                .padding(.trailing, -4)
                .scaleEffect(1 - distance)
                .opacity(isTopLayer ? 1 : 0)
                .frame(width: 12)
                .padding(.trailing, -12 * distance)
        }
        .menuSource(isEnabled: isTopLayer && isSelected, coordinateSpace: .global, menuContext: menuContext, menuContent: {
            PushNavigation { push in
                firstMenu(push: push)
            } second: { pop in
                secondMenu(pop: pop)
            }
        })
        .animation(.snappy, value: showAccessory)
    }
    
    @ViewBuilder
    func firstMenu(push: @escaping () -> ()) -> some View {
        ScrollableMenuContent {
            
            let collections = NftStore.getCollections(accountId: accountId)
            let gifts = collections.telegramGiftsCollections
            let notGifts = collections.notTelegramGiftsCollections
            let hasHidden = NftStore.currentAccountHasHiddenNfts
            
            VStack(spacing: 0) {
                if !gifts.isEmpty {
                    
                    SelectableMenuItem(id: "0-gifts", action: { push() }) {
                        HStack {
                            Text("Telegram Gifts")
                                .lineLimit(1)
                            Spacer()
                            Image(systemName: "chevron.right")
                                .padding(.vertical, -4)

                        }
                    }
                    WideSeparator()
                }
                
                if !notGifts.isEmpty {
                    DividedVStack {
                        ForEach(notGifts) { collection in
                            SelectableMenuItem(id: "0-" + collection.id, action: {
                                AppActions.showAssets(selectedTab: 1, collectionsFilter: .collection(collection))
                                menuContext.dismiss()
                            }) {
                                Text(collection.name)
                                    .lineLimit(1)
                            }
                        }
                        
                    }
                    WideSeparator()
                }
                
                if hasHidden {
                    SelectableMenuItem(id: "0-hidden", action: {
                        AppActions.showHiddenNfts()
                        menuContext.dismiss()
                    }) {
                        Text("Hidden NFTs")
                            .lineLimit(1)
                    }
                    WideSeparator()
                }

                SelectableMenuItem(id: "0-reorder", action: {
                    self.segmentedControl.startReordering()
                    menuContext.dismiss()
                }) {
                    Text("Reorder")
                        .lineLimit(1)
                }

            }
            
        }
        .frame(minHeight: 200, alignment: .top)
        .frame(maxWidth: 250)
    }
    
    @ViewBuilder
    func secondMenu(pop: @escaping () -> ()) -> some View {
        ScrollableMenuContent {
            
            let collections = NftStore.getCollections(accountId: accountId)
            let gifts = collections.telegramGiftsCollections
            
            VStack(spacing: 0) {
                SelectableMenuItem(id: "1-back", action: { pop() }) {
                    HStack(spacing: 10) {
                        Image.airBundle("MenuBack")
                            .padding(.vertical, -4)
                        Text("Back")
                            .lineLimit(1)
                    }
                }

                WideSeparator()

                DividedVStack {
                    SelectableMenuItem(id: "1-all-gifts", action: {
                        AppActions.showAssets(selectedTab: 1, collectionsFilter: .telegramGifts)
                        menuContext.dismiss()
                    }) {
                        HStack(spacing: 10) {
                            Text("All Telegram Gifts")
                                .lineLimit(1)
                            Spacer()
                            Image.airBundle("MenuGift")
                                .padding(.vertical, -4)
                        }
                    }
                
                    ForEach(gifts) { collection in
                        SelectableMenuItem(id: "1-" + collection.id, action: {
                            AppActions.showAssets(selectedTab: 1, collectionsFilter: .collection(collection))
                            menuContext.dismiss()
                        }) {
                            HStack(spacing: 10) {
                                Text(collection.name)
                                    .lineLimit(1)
                                Spacer()
//                                    Image.airBundle("MenuGift")
//                                        .padding(.vertical, -4)
                            }
                        }
                    }
                }
            }
            .frame(maxHeight: .infinity, alignment: .top)
        }
        .frame(maxWidth: 250)
    }
}

struct NftCollectionItem<Content: View>: View {
    
    @ObservedObject var menuContext: MenuContext
    var hideAction: (() -> ())?
    var content: () -> Content
    
    @EnvironmentObject private var segmentedControl: SegmentedControlModel
    
    @Environment(\.segmentedControlItemSelectionIsClose) private var showAccessory: Bool
    @Environment(\.segmentedControlItemIsTopLayer) private var isTopLayer: Bool
    @Environment(\.segmentedControlItemDistanceToSelection) private var distance: CGFloat
    @Environment(\.segmentedControlItemIsSelected) private var isSelected: Bool

    init(menuContext: MenuContext, hideAction: (() -> ())?, @ViewBuilder content: @escaping () -> Content) {
        self.menuContext = menuContext
        self.hideAction = hideAction
        self.content = content
    }
    
    var body: some View {
        HStack(spacing: 2.666) {
            content()
            
            Image(systemName: "ellipsis.circle.fill")
                .imageScale(.small)
                .padding(.trailing, -4)
                .scaleEffect(1 - distance)
                .opacity(isTopLayer ? 1 : 0)
                .frame(width: 12)
                .padding(.trailing, -12 * distance)
        }
            .menuSource(isEnabled: true, coordinateSpace: .global, menuContext: menuContext) {
                ScrollableMenuContent {
                    DividedVStack {
                        SelectableMenuItem(id: "0-reorder", action: {
                            self.segmentedControl.startReordering()
                            menuContext.dismiss()
                        }) {
                            Text("Reorder")
                                .lineLimit(1)
                        }
                        if let hideAction {
                            SelectableMenuItem(id: "0-hide", action: {
                                hideAction()
                                menuContext.dismiss()
                            }) {
                                Text("Hide tab")
                                    .lineLimit(1)
                            }
                        }
                    }
                }
                .frame(minHeight: 200, alignment: .top)
                .frame(maxWidth: 150)
            }
    }
}


struct TokensItem<Content: View>: View {
    
    @ObservedObject var menuContext: MenuContext
    var content: () -> Content
    
    @EnvironmentObject private var segmentedControl: SegmentedControlModel
    
    init(menuContext: MenuContext, @ViewBuilder content: @escaping () -> Content) {
        self.menuContext = menuContext
        self.content = content
    }
    
    var body: some View {
        content()
            .menuSource(isEnabled: true, coordinateSpace: .global, menuContext: menuContext) {
                ScrollableMenuContent {
                    DividedVStack {
                        SelectableMenuItem(id: "0-reorder", action: {
                            self.segmentedControl.startReordering()
                            menuContext.dismiss()
                        }) {
                            Text("Reorder")
                                .lineLimit(1)
                        }
                    }
                }
                .frame(minHeight: 200, alignment: .top)
                .frame(maxWidth: 150)
            }
    }
}
