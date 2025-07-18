//
//  BaseCurrencyValueText.swift
//  MyTonWalletAir
//
//  Created by nikstar on 22.11.2024.
//

import SwiftUI
import WalletCore
import WalletContext


public struct AddressActions: View {
    
    var address: String
    var showSaveToFavorites: Bool
    
    public init(address: String, showSaveToFavorites: Bool) {
        self.address = address
        self.showSaveToFavorites = showSaveToFavorites
    }
    
    public var body: some View {
        Button(action: onCopy) {
            Label {
                Text(WStrings.Send_Confirm_CopyAddress.localized)
            } icon: {
                Image("SendCopy", bundle: AirBundle)
            }
        }
        Button(action: onOpenExplorer) {
            Label {
                Text(WStrings.Send_Confirm_OpenInExplorer.localized)
            } icon: {
                Image("SendGlobe", bundle: AirBundle)
            }
        }
        if showSaveToFavorites {
            Button(action: onSaveToFavorites) {
                Label {
                    Text(WStrings.Send_Confirm_AddToAddressBook.localized)
                } icon: {
                    Image("SendFavorites", bundle: AirBundle)
                }
            }
        }
    }
    
    func onCopy() {
        UIPasteboard.general.string = address
        topWViewController()?.showToast(animationName: "Copy", message: WStrings.Receive_AddressCopied.localized)
        UIImpactFeedbackGenerator(style: .soft).impactOccurred()
    }
    
    func onOpenExplorer() {
        let chain = availableChains.first(where: { $0.validate(address: address) }) ?? ApiChain.ton
        let url = ExplorerHelper.addressUrl(chain: chain, address: address)
        AppActions.openInBrowser(url)
    }
    
    func onSaveToFavorites() {
        topWViewController()?.showToast(message: "Not implemented")
        UINotificationFeedbackGenerator().notificationOccurred(.error)
    }
}
