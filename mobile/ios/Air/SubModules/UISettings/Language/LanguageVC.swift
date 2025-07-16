//
//  LanguageVC.swift
//  UISettings
//
//  Created by Sina on 7/5/24.
//

import Foundation
import UIKit
import UIComponents
import WalletCore
import WalletContext

struct MLanguage {
    let id: String
    let name: String
    let localName: String
}

fileprivate let languages: [MLanguage] = [
    MLanguage(id: "ar", name: "Arabic", localName: "اَلعربية"),
    MLanguage(id: "en", name: "English", localName: "English"),
    MLanguage(id: "fa", name: "Farsi (Persian)", localName: "فارسی"),
    MLanguage(id: "ru", name: "Russian", localName: "Русский"),
]

public class LanguageVC: WViewController {
    
    private let isModal: Bool
    public init(isModal: Bool = false) {
        self.isModal = isModal
        super.init(nibName: nil, bundle: nil)
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    // MARK: - Load and SetupView Functions
    public override func loadView() {
        super.loadView()
        setupViews()
    }
    
    private var tableView: UITableView!
    private func setupViews() {
        title = WStrings.Language_Title.localized
        
        tableView = UITableView()
        tableView.translatesAutoresizingMaskIntoConstraints = false
        tableView.delegate = self
        tableView.dataSource = self
        tableView.register(SectionHeaderCell.self, forCellReuseIdentifier: "Header")
        tableView.register(TitleSubtitleSelectableCell.self, forCellReuseIdentifier: "CurrencyCell")
        tableView.separatorStyle = .none
        tableView.delaysContentTouches = false
        view.addSubview(tableView)
        NSLayoutConstraint.activate([
            tableView.topAnchor.constraint(equalTo: view.topAnchor),
            tableView.leftAnchor.constraint(equalTo: view.leftAnchor),
            tableView.rightAnchor.constraint(equalTo: view.rightAnchor),
            tableView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
        
        updateTheme()
    }
    
    public override func updateTheme() {
        view.backgroundColor = isModal ? WTheme.groupedBackground : WTheme.groupedBackground
        tableView.backgroundColor = view.backgroundColor
    }

    public override func scrollToTop() {
        tableView?.setContentOffset(CGPoint(x: 0, y: -tableView.adjustedContentInset.top), animated: true)
    }
}

extension LanguageVC: UITableViewDelegate, UITableViewDataSource {
    public func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        return 1 + languages.count
    }
    public func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        if indexPath.row == 0 {
            let cell = tableView.dequeueReusableCell(withIdentifier: "Header", for: indexPath) as! SectionHeaderCell
            cell.configure(title: WStrings.Language_InterfaceLanguage.localized)
            return cell
        }
        let language = languages[indexPath.row - 1]
        let cell = tableView.dequeueReusableCell(withIdentifier: "CurrencyCell", for: indexPath) as! TitleSubtitleSelectableCell
        cell.configure(title: language.name,
                       subtitle: language.localName,
                       isSelected: AppStorageHelper.selectedLanguage == language.id,
                       isFirst: indexPath.row == 1,
                       isLast: indexPath.row == languages.count,
                       isInModal: isModal,
                       onSelect: {
            AppStorageHelper.selectedLanguage = language.id
            UserDefaults.standard.set([language.id], forKey: "AppleLanguages")
            UserDefaults.standard.synchronize()
            WalletContextManager.delegate?.restartApp()
        })
        return cell
    }
}
