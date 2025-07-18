//
//  SettingsItem.swift
//  UISettings
//
//  Created by Sina on 6/26/24.
//

import Foundation
import UIKit
import WalletCore
import WalletContext

struct SettingsItem: Equatable, Identifiable {
    
    enum Identifier: Equatable, Hashable {
        case changeAvatar
        case editWalletName
        case account(accountId: String)
        case addAccount
        case appearance
        case assetsAndActivity
        case connectedApps
        case language
        case security
        case backup
        case walletVersions
        case questionAndAnswers
        case terms
        case switchToCapacitor
        case signout
    }
    let id: Identifier
    let icon: UIImage?
    let title: String
    var subtitle: String? = nil
    var value: String? = nil
    let hasPrimaryColor: Bool
    let hasChild: Bool
    let isDangerous: Bool
}
