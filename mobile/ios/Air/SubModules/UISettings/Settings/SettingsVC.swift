//
//  SettingsVC.swift
//  UISettings
//
//  Created by Sina on 6/26/24.
//

import UIKit
import UIPasscode
import UIComponents
import WalletCore
import WalletContext

private let log = Log("SettingsVC")


@MainActor
public class SettingsVC: WViewController, Sendable {
    
    typealias Section = SettingsSection.Section
    typealias Row = SettingsItem.Identifier
    
    private var settingsVM = SettingsVM()
    private var collectionView: UICollectionView!
    private var dataSource: UICollectionViewDiffableDataSource<Section, Row>!
    private var settingsHeaderView: SettingsHeaderView!
    private var pauseReloadData: Bool = false
    
    public override var hideNavigationBar: Bool {
        true
    }
    
    public override func loadView() {
        super.loadView()
        setupViews()
    }
    
    public override func viewDidLoad() {
        super.viewDidLoad()
        WalletCoreData.add(eventObserver: self)
    }
    
    public override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        pauseReloadData = false
        configHeader()
        fillOtherAccounts()
        updateGeneralSection()
        updateWalletDataSection()
        reloadData(animated: false)
    }
    
    // MARK: - Setup settings
    func setupViews() {
        
        var _configuration = UICollectionLayoutListConfiguration(appearance: .insetGrouped)
        _configuration.trailingSwipeActionsConfigurationProvider = { [weak self] indexPath in
            if case .account(let accountId) = self?.dataSource.itemIdentifier(for: indexPath) {
                let deleteAction = UIContextualAction(style: .destructive, title: WStrings.Settings_DeleteWallet.localized, handler: { contextualAction, view, callback in
                    self?.signoutPressed(removingAccountId: accountId, callback: callback)
                })
                let actions = UISwipeActionsConfiguration(actions: [deleteAction])
                actions.performsFirstActionWithFullSwipe = true
                return actions
            }
            return nil
        }
        _configuration.separatorConfiguration.color = WTheme.separator
        _configuration.separatorConfiguration.bottomSeparatorInsets.leading = 60
        _configuration.headerMode = .none
        
        let layout = UICollectionViewCompositionalLayout(sectionProvider: { [weak self] sectionIdx, env in
            var configuration = _configuration
            configuration.footerMode = sectionIdx + 1 == self?.collectionView.numberOfSections ? .supplementary : .none
            let section = NSCollectionLayoutSection.list(using: configuration, layoutEnvironment: env)
            section.contentInsets.top = 0
            section.contentInsets.bottom = 24
            return section
        })
        
        collectionView = UICollectionView(frame: .zero, collectionViewLayout: layout)
        collectionView.translatesAutoresizingMaskIntoConstraints = false
        collectionView.register(SettingsItemCell.self, forCellWithReuseIdentifier: "settingsItem")
        collectionView.register(SettingsAccountCell.self, forCellWithReuseIdentifier: "account")
        collectionView.register(FooterView.self, forSupplementaryViewOfKind: UICollectionView.elementKindSectionFooter, withReuseIdentifier: UICollectionView.elementKindSectionFooter)
        collectionView.delegate = self
        collectionView.delaysContentTouches = false
        collectionView.allowsSelection = true
        collectionView.contentInset.top = defaultHeight
        
        dataSource = UICollectionViewDiffableDataSource<Section, Row>(collectionView: collectionView) { [weak self] (tableView, indexPath, itemIdentifier) -> UICollectionViewCell? in
            guard let self, settingsVM.settingsSections[indexPath.section].children.count > indexPath.row else {
                return nil
            }
            let settingsItem = settingsVM.settingsSections[indexPath.section].children[indexPath.row]
            switch itemIdentifier {
            case .account(accountId: let accountId):
                guard let cell = tableView.dequeueReusableCell(withReuseIdentifier: "account", for: indexPath) as? SettingsAccountCell else { return nil }
                cell.configure(
                    with: accountId,
                    title: settingsItem.title,
                    subtitle: settingsItem.subtitle,
                    value: settingsVM.value(for: settingsItem)
                )
                return cell
            default:
                guard let cell = tableView.dequeueReusableCell(withReuseIdentifier: "settingsItem", for: indexPath) as? SettingsItemCell else { return nil }
                cell.configure(
                    with: settingsItem,
                    value: settingsVM.value(for: settingsItem)
                )
                return cell
            }
        }
        dataSource.supplementaryViewProvider = { [weak self] collectionView, kind, indexPath in
            switch kind {
            case UICollectionView.elementKindSectionFooter:
                let cell = collectionView.dequeueReusableSupplementaryView(ofKind: kind, withReuseIdentifier: kind, for: indexPath) as! FooterView
                cell.bounds = CGRect(x: 0, y: 0, width: collectionView.contentSize.width, height: 46)
                let g = UILongPressGestureRecognizer(target: self, action: #selector(SettingsVC.onVersionLongTap(_:)))
                cell.addGestureRecognizer(g)
                return cell
            default:
                return nil
            }
        }
        dataSource.apply(settingsVM.makeSnapshot(), animatingDifferences: false)
        
        // Add table view
        view.addSubview(collectionView)
        NSLayoutConstraint.activate([
            collectionView.topAnchor.constraint(equalTo: view.topAnchor),
            collectionView.leftAnchor.constraint(equalTo: view.leftAnchor),
            collectionView.rightAnchor.constraint(equalTo: view.rightAnchor),
            collectionView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
        
        // Add header view
        settingsHeaderView = SettingsHeaderView(vc: self)
        settingsHeaderView.config()
        collectionView.addSubview(settingsHeaderView)
        settingsHeaderView.setupViews()
        NSLayoutConstraint.activate([
            settingsHeaderView.topAnchor.constraint(equalTo: view.topAnchor),
            settingsHeaderView.leftAnchor.constraint(equalTo: view.leftAnchor),
            settingsHeaderView.rightAnchor.constraint(equalTo: view.rightAnchor)
        ])
                
        addBottomBarBlur()
        
        updateTheme()
    }
    
    public override func updateTheme() {
        if !pauseReloadData {
            view.backgroundColor = WTheme.groupedBackground
            collectionView.backgroundColor = WTheme.groupedBackground
            collectionView.reloadData()
        }
    }
    
    public override func scrollToTop() {
        collectionView?.setContentOffset(CGPoint(x: 0, y: -collectionView.adjustedContentInset.top), animated: true)
    }
    
    private func addAccountSelected() {
        let alert = makeAddAccountActions(
            createNew: { [weak self] in
                guard let self else { return }
                UnlockVC.presentAuth(on: self, onDone: { [weak self] passcode in
                    guard let self else {return}
                    settingsVM.createNewWallet(passcode: passcode)
                }, cancellable: true)
            },
            importWallet: { [weak self] in
                guard let self else { return }
                UnlockVC.presentAuth(on: self, onDone: { passcode in
                    Task { @MainActor in
                        guard let importWalletVC = await WalletContextManager.delegate?.importAnotherAccount(passedPasscode: passcode, isLedger: false) else {
                            return
                        }
                        let navVC = WNavigationController(rootViewController: importWalletVC)
                        topViewController()?.present(navVC, animated: true)
                    }
                }, cancellable: true)
            },
            connectLedger: {  [weak self] in
                guard let self else { return }
                UnlockVC.presentAuth(on: self, onDone: { passcode in
                    Task { @MainActor in
                        guard let importWalletVC = await WalletContextManager.delegate?.importAnotherAccount(passedPasscode: passcode, isLedger: true) else {
                            return
                        }
                        let navVC = WNavigationController(rootViewController: importWalletVC)
                        topViewController()?.present(navVC, animated: true)
                    }
                }, cancellable: true)
            },
            viewAnyAddress: {  [weak self] in
                guard let self else { return }
                UnlockVC.presentAuth(on: self, onDone: { passcode in
                    Task { @MainActor in
                        guard let vc = WalletContextManager.delegate?.viewAnyAddress() else {
                            return
                        }
                        let navVC = WNavigationController(rootViewController: vc)
                        topViewController()?.present(navVC, animated: true)
                    }
                }, cancellable: true)
            }
        )
        topViewController()?.present(alert, animated: true, completion: nil)
    }
    
    private func selected(item: SettingsItem.Identifier) {
        switch item {
        case .changeAvatar:
            break
        case .editWalletName:
            let alertController = UIAlertController(title: WStrings.Home_EnterWalletName.localized,
                                                    message: nil,
                                                    preferredStyle: .alert)
            alertController.addTextField()
            let textField = alertController.textFields![0]
            textField.text = AccountStore.account?.title ?? ""
            textField.autocapitalizationType = .words
            textField.autocorrectionType = .yes
            
            let submitAction = UIAlertAction(title: WStrings.Alert_OK.localized, style: .default) { [unowned alertController] _ in
                let walletName = alertController.textFields![0].text ?? ""
                Task {
                    do {
                        try await AccountStore.updateAccountTitle(accountId: AccountStore.accountId!, newTitle: walletName.nilIfEmpty)
                    } catch {
                        log.error("rename failed: \(error, .public)")
                    }
                }
            }
            alertController.addAction(submitAction)
            
            let cancelAction = UIAlertAction(title: WStrings.Home_Cancel.localized, style: .cancel)
            alertController.addAction(cancelAction)
            
            topViewController()?.present(alertController, animated: true)
            
        case .account(let accountId):
            pauseReloadData = true // prevent showing new data while switching away from settings tab
            Task {
                do {
                    _ = try await AccountStore.activateAccount(accountId: accountId)
                } catch {
                    fatalError("failed to activate account: \(accountId)")
                }
            }
            
        case .addAccount:
            addAccountSelected()
            
        case .appearance:
            navigationController?.pushViewController(AppearanceVC(), animated: true)
        case .assetsAndActivity:
            navigationController?.pushViewController(AssetsAndActivityVC(), animated: true)
        case .connectedApps:
            navigationController?.pushViewController(ConnectedAppsVC(), animated: true)
        case .language:
            navigationController?.pushViewController(LanguageVC(), animated: true)
        case .security:
            Task { @MainActor in
                if let password = await UnlockVC.presentAuthAsync(on: self) {
                    self.navigationController?.pushViewController(SecurityVC(password: password), animated: true)
                }
            }
        case .backup:
            guard AccountStore.account?.isHardware != true else {
                 return
            }
            UnlockVC.presentAuth(on: self, onDone: { passcode in
                Task { @MainActor in
                    if let accountId = AccountStore.accountId, let mnemonic = try? await Api.fetchMnemonic(accountId: accountId, password: passcode) {
                        self.navigationController?.pushViewController(RecoveryPhraseVC(wordList: mnemonic), animated: true)
                    }
                }
            }, cancellable: true)
        case .walletVersions:
            navigationController?.pushViewController(WalletVersionsVC(), animated: true)
        case .questionAndAnswers:
            let url = URL(string: "https://mytonwallet.io/privacy-policy")!
            let title = WStrings.Settings_QuestionAndAnswers.localized
            navigationController?.pushPlainWebView(title: title, url: url)
            
        case .terms:
            let url = URL(string: "https://mytonwallet.io/terms-of-use")!
            let title = WStrings.Settings_Terms.localized
            navigationController?.pushPlainWebView(title: title, url: url)
            
        case .switchToCapacitor:
            log.info("switchToCapacitor")
            WalletContextManager.delegate?.switchToCapacitor()
            
        case .signout:
            if let accountId = AccountStore.accountId {
                signoutPressed(removingAccountId: accountId, callback: { _ in })
            }
        }
    }
    
    private func signoutPressed(removingAccountId: String, callback: @escaping (Bool) -> ()) {
        let isCurrentAccount = removingAccountId == AccountStore.accountId
        showAlert(
            title: WStrings.Settings_DeleteWalletTitle.localized,
            text: WStrings.Settings_DeleteWalletInfo.localized,
            button: WStrings.Settings_DeleteWallet.localized,
            buttonStyle: .destructive,
            buttonPressed: { [weak self] in
                guard let self else { return }
                Task { @MainActor in
                    do {
                        if AccountStore.accountsById.count == 1 {
                            // it is the last account id, delete all data and restart app
                            try await AccountStore.resetAccounts()
                        } else {
                            let nextAccount = isCurrentAccount ? AccountStore.accountsById.keys.first(where: { $0 != removingAccountId }) : AccountStore.accountId
                            let _ = try await AccountStore.removeAccount(accountId: removingAccountId, nextAccountId: nextAccount!)
                            if isCurrentAccount {
                                DispatchQueue.main.async {
                                    self.tabBarController?.selectedIndex = 0
                                }
                            }
                        }
                        callback(true)
                    } catch {
                        log.fault("delete account error: \(error)")
                        self.showAlert(error: error)
                        callback(false)
                    }
                }
            },
            secondaryButton: WStrings.Navigation_Cancel.localized,
            secondaryButtonPressed: { [weak self] in
                guard let self else { return }
                settingsVM.fillOtherAccounts()
                reloadData(animated: true)
                callback(false)
            })
    }
    
    @objc func onVersionLongTap(_ gesture: UIGestureRecognizer) {
        if gesture.state == .began {
            (UIApplication.shared.delegate as? MtwAppDelegateProtocol)?.showDebugView()
        }
    }
}


extension SettingsVC: UICollectionViewDelegate {
    
    public func collectionView(_ collectionView: UICollectionView, shouldSelectItemAt indexPath: IndexPath) -> Bool {
        true
    }
    
    public func collectionView(_ collectionView: UICollectionView, didSelectItemAt indexPath: IndexPath) {
        if let id = dataSource.itemIdentifier(for: indexPath) {
            log.info("didSelectItemAt \(indexPath, .public) -> \(id, .public)")
            selected(item: id)
        }
        collectionView.deselectItem(at: indexPath, animated: true)
    }
    
    // scroll delegation
    public func scrollViewWillBeginDragging(_ scrollView: UIScrollView) {
        if collectionView.contentSize.height + view.safeAreaInsets.top + view.safeAreaInsets.bottom > collectionView.frame.height {
            let requiredInset = max(120, collectionView.frame.height + 160 - collectionView.contentSize.height - view.safeAreaInsets.top - view.safeAreaInsets.bottom)
            collectionView.contentInset.bottom = requiredInset
        }
    }
    
    public func scrollViewDidScroll(_ scrollView: UIScrollView) {
        settingsHeaderView.update(scrollOffset: scrollView.contentOffset.y + scrollView.adjustedContentInset.top)
    }
    
    public func scrollViewWillEndDragging(_ scrollView: UIScrollView,
                                          withVelocity velocity: CGPoint,
                                          targetContentOffset: UnsafeMutablePointer<CGPoint>) {
        let topInset = collectionView.adjustedContentInset.top
        let realTargetY = targetContentOffset.pointee.y + topInset
        // snap to views
        if realTargetY > 0 && collectionView.contentSize.height + view.safeAreaInsets.top + view.safeAreaInsets.bottom > collectionView.frame.height {
            if realTargetY < 162 {
                let isGoingDown = targetContentOffset.pointee.y > scrollView.contentOffset.y
                let isStopped = abs(velocity.y) < 5
                if isGoingDown || (isStopped && realTargetY >= 85) {
                    targetContentOffset.pointee.y = 162 - topInset
                } else {
                    targetContentOffset.pointee.y = 0 - topInset
                }
            }
        }
    }
}

extension SettingsVC: WalletCoreData.EventsObserver {
    public nonisolated func walletCore(event: WalletCoreData.Event) {
        DispatchQueue.main.async { [self] in
            switch event {
            case .accountChanged:
                pauseReloadData = true // prevent showing new data while switching away from settings tab
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { [self] in
                    pauseReloadData = false
                    reloadData(animated: false)
                    configHeader()
                    fillOtherAccounts()
                    updateGeneralSection()
                    updateWalletDataSection()
                }

            case .accountNameChanged:
                configHeader()

            case .balanceChanged:
                updateDescriptionLabel()

            case .notActiveAccountBalanceChanged:
                fillOtherAccounts()
                reloadData(animated: true)

            case .baseCurrencyChanged(to: _), .tokensChanged:
                updateDescriptionLabel()
                fillOtherAccounts()
                reloadData(animated: true)
                
            case .stakingAccountData(let data):
                if data.accountId == AccountStore.accountId {
                    updateDescriptionLabel()
                    fillOtherAccounts()
                    reloadData(animated: true)
                }

            case .walletVersionsDataReceived:
                updateWalletDataSection()
                reloadData(animated: true)

            case .dappsCountUpdated:
                updateGeneralSection()
                reloadData(animated: true)

            default:
                break
            }
        }
    }
    
    private func configHeader() {
        if !pauseReloadData {
            settingsHeaderView?.config()
        }
    }
    
    private func updateDescriptionLabel() {
        if !pauseReloadData {
            settingsHeaderView?.updateDescriptionLabel()
        }
    }
    
    private func fillOtherAccounts() {
        if !pauseReloadData {
            settingsVM.fillOtherAccounts()
        }
    }
    
    private func reloadData(animated: Bool) {
        if animated {
            if !pauseReloadData {
                dataSource.apply(settingsVM.makeSnapshot(), animatingDifferences: animated)
            }
        } else {
            UIView.performWithoutAnimation {
                var snapshot = settingsVM.makeSnapshot()
                snapshot.reconfigureItems(snapshot.itemIdentifiers)
                dataSource.apply(snapshot, animatingDifferences: false)
            }
        }
    }

    private func updateGeneralSection() {
        if !pauseReloadData {
            settingsVM.updateGeneralSection()
        }
    }

    private func updateWalletDataSection() {
        if !pauseReloadData {
            settingsVM.updateWalletDataSection()
        }
    }
}
