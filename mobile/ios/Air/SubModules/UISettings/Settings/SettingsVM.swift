//
//  SettingsVM.swift
//  UISettings
//
//  Created by Sina on 6/26/24.
//

import Foundation
import UIKit
import UIComponents
import WalletCore
import WalletContext


class SettingsVM {
    
    var addAccountItem = SettingsItem(id: .addAccount,
                                           icon: UIImage(named: "AddAccountIcon", in: AirBundle, compatibleWith: nil)!.withRenderingMode(.alwaysTemplate),
                                           title: WStrings.Settings_AddAccount.localized,
                                           hasPrimaryColor: true,
                                           hasChild: false,
                                           isDangerous: false)
    var connectedAppsItem = SettingsItem(id: .connectedApps,
                                              icon: UIImage(named: "DappsIcon", in: AirBundle, compatibleWith: nil)!,
                                              title: WStrings.Settings_ConnectedApps.localized,
                                              hasPrimaryColor: false,
                                              hasChild: true,
                                              isDangerous: false)
    
    var settingsSections: [SettingsSection] = {
        var sections: [SettingsSection] = []
        sections.append(contentsOf: [
            SettingsSection(
                id: .header,
                children: [
                SettingsItem(id: .editWalletName,
                             icon: UIImage(named: "EditWalletNameIcon", in: AirBundle, compatibleWith: nil)!.withRenderingMode(.alwaysTemplate),
                             title: WStrings.Settings_EditWalletName.localized,
                             hasPrimaryColor: true,
                             hasChild: false,
                             isDangerous: false)
                ]),
            SettingsSection(
                id: .accounts,
                children: []),
            SettingsSection(
                id: .general,
                children: [
                SettingsItem(id: .appearance,
                             icon: UIImage(named: "AppearanceIcon", in: AirBundle, compatibleWith: nil)!,
                             title: WStrings.Settings_Appearance.localized,
                             hasPrimaryColor: false,
                             hasChild: true,
                             isDangerous: false),
                SettingsItem(id: .assetsAndActivity,
                             icon: UIImage(named: "AssetsAndActivityIcon", in: AirBundle, compatibleWith: nil)!,
                             title: WStrings.Settings_AssetsAndActivity.localized,
                             hasPrimaryColor: false,
                             hasChild: true,
                             isDangerous: false),
            ]),
            SettingsSection(
                id: .walletData,
                children: []
            ),
            SettingsSection(
                id: .questionAndAnswers,
                children: [
                SettingsItem(id: .questionAndAnswers,
                             icon: UIImage(named: "QuestionAnswersIcon", in: AirBundle, compatibleWith: nil)!,
                             title: WStrings.Settings_QuestionAndAnswers.localized,
                             hasPrimaryColor: false,
                             hasChild: true,
                             isDangerous: false),
                SettingsItem(id: .terms,
                             icon: UIImage(named: "TermsIcon", in: AirBundle, compatibleWith: nil)!,
                             title: WStrings.Settings_Terms.localized,
                             hasPrimaryColor: false,
                             hasChild: true,
                             isDangerous: false)
            ])
        ])
        if !DEFAULT_TO_AIR {
            sections.append(        SettingsSection(id: .switchToCapacitor, children: [
                SettingsItem(id: .switchToCapacitor,
                             icon: nil,
                             title: WStrings.Settings_SwitchToCapacitor.localized,
                             hasPrimaryColor: true,
                             hasChild: false,
                             isDangerous: true)
            ]),)
        }
        sections.append(contentsOf: [
            SettingsSection(
                id: .signout,
                children: [
                    SettingsItem(id: .signout,
                                 icon: nil,
                                 title: WStrings.Settings_SignOut.localized,
                                 hasPrimaryColor: false,
                                 hasChild: true,
                                 isDangerous: true),
                ]
            )
        ])
        return sections
    }()
    
    func makeSnapshot() -> NSDiffableDataSourceSnapshot<SettingsVC.Section, SettingsVC.Row> {
        var snapshot = NSDiffableDataSourceSnapshot<SettingsVC.Section, SettingsVC.Row>()
        for section in settingsSections {
            snapshot.appendSections([section.id])
            snapshot.appendItems(section.children.map(\.id))
        }
        return snapshot
    }
    
    func value(for item: SettingsItem) -> String? {
        if let value = item.value {
            // item already has a cached value on the item model
            return value
        }
        switch item.id {
        case .language:
            return WStrings.Language_Active.localized
        case .walletVersions:
            return AccountStore.walletVersionsData?.currentVersion
        case .connectedApps:
            return DappsStore.dappsCount != nil ? "\(DappsStore.dappsCount!)" : ""
        default:
            return nil
        }
    }
    
    func fillOtherAccounts() {
        guard let accountsSectionIndex = (settingsSections.firstIndex { it in
            return it.id == .accounts
        }) else { return }
        var items = [SettingsItem]()
        let accounts = AccountStore.allAccounts
        for account in accounts where account.id != AccountStore.accountId {
            let balanceAmount = BalanceStore.getTotalBalanceInBaseCurrency(for: account.id)
            let balance = balanceAmount != nil ? formatAmountText(amount: balanceAmount!,
                                                                  currency: TokenStore.baseCurrency?.sign,
                                                                  decimalsCount: TokenStore.baseCurrency?.decimalsCount) : nil
            let title: String
            let subtitle: String?
            if let t = account.title?.nilIfEmpty {
                title = t
                subtitle = formatStartEndAddress(account.firstAddress ?? "")
            } else {
                title = formatStartEndAddress(account.firstAddress ?? "")
                subtitle = nil
            }
            items.append(SettingsItem(id: .account(accountId: account.id),
                                      icon: .avatar(for: account, withSize: 30) ?? UIImage(),
                                      title: title,
                                      subtitle: subtitle,
                                      value: balance,
                                      hasPrimaryColor: false,
                                      hasChild: false,
                                      isDangerous: false))
        }
        items.append(addAccountItem)
        settingsSections[accountsSectionIndex].children = items
    }
    
    func updateGeneralSection() {
        guard let generalSectionIndex = (settingsSections.firstIndex { it in
            return it.id == .general
        }) else { return }
        if DappsStore.dappsCount ?? 0 > 0 {
            if !settingsSections[generalSectionIndex].children.contains(where: { it in
                it.id == .connectedApps
            }) {
                settingsSections[generalSectionIndex].children.insert(connectedAppsItem, at: settingsSections[generalSectionIndex].children.count - 1)
            }
        } else {
            if let removingItem = settingsSections[generalSectionIndex].children.firstIndex(where: { it in
                it.id == .connectedApps
            }) {
                settingsSections[generalSectionIndex].children.remove(at: removingItem)
            }
        }
    }
    
    func updateWalletDataSection() {
        guard let walletDataSectionIndex = (settingsSections.firstIndex { it in
            return it.id == .walletData
        }) else { return }
        var items = [SettingsItem]()
        items.append(SettingsItem(
            id: .security,
            icon: .airBundle("SecurityIcon"),
            title: "Security",
            hasPrimaryColor: false,
            hasChild: true,
            isDangerous: false
        ))
        if AccountStore.walletVersionsData?.versions.count ?? 0 > 0 {
            items.append(
                SettingsItem(id: .walletVersions,
                             icon: UIImage(named: "WalletVersionsIcon", in: AirBundle, compatibleWith: nil)!,
                             title: WStrings.Settings_WalletVersions.localized,
                             hasPrimaryColor: false,
                             hasChild: true,
                             isDangerous: false)
            )
        }
        settingsSections[walletDataSectionIndex].children = items
    }
    
    // create a new wallet
    func createNewWallet(passcode: String) {
        guard let _ = AccountStore.account?.id else {
            return
        }
        // generate mnemonic!
        Task { @MainActor in
            do {
                let words = try await Api.generateMnemonic()
                guard let walletCreatedVC = WalletContextManager.delegate?.addAnotherAccount(wordList: words,
                                                                                             passedPasscode: passcode) else {
                    return
                }
                let navVC = WNavigationController(rootViewController: walletCreatedVC)
                topViewController()?.present(navVC, animated: true)
            } catch {
                topViewController()?.showAlert(error: error)
            }
        }
    }
}
