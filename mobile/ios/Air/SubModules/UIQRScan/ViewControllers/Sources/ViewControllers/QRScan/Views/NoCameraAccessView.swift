//
//  NoCameraAccessView.swift
//  UIQRScan
//
//  Created by Sina on 5/13/23.
//

import UIKit
import UIComponents
import WalletContext

public class NoCameraAccessView: UIView {
    
    public init() {
        super.init(frame: CGRect.zero)
        setupView()
    }
    
    override public init(frame: CGRect) {
        fatalError()
    }
    
    required public init?(coder: NSCoder) {
        fatalError()
    }
    
    private func setupView() {
        translatesAutoresizingMaskIntoConstraints = false

        // bottom actions view
        let bottomActionsView = BottomActionsView(primaryAction: BottomAction(title: WStrings.QRScan_NoAccessOpenSettings.localized, onPress: {
            if let url = URL(string: UIApplication.openSettingsURLString) {
                UIApplication.shared.open(url)
            }
        }))
        addSubview(bottomActionsView)
        NSLayoutConstraint.activate([
            bottomActionsView.bottomAnchor.constraint(equalTo: safeAreaLayoutGuide.bottomAnchor, constant: -58),
            bottomActionsView.leftAnchor.constraint(equalTo: safeAreaLayoutGuide.leftAnchor, constant: 48),
            bottomActionsView.rightAnchor.constraint(equalTo: safeAreaLayoutGuide.rightAnchor, constant: -48),
        ])

        // top view
        let topView = UIView()
        topView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(topView)
        NSLayoutConstraint.activate([
            topView.topAnchor.constraint(equalTo: safeAreaLayoutGuide.topAnchor),
            topView.leftAnchor.constraint(equalTo: safeAreaLayoutGuide.leftAnchor),
            topView.rightAnchor.constraint(equalTo: safeAreaLayoutGuide.rightAnchor),
            topView.bottomAnchor.constraint(equalTo: bottomActionsView.topAnchor)
        ])

        // header, center of top view
        let headerView = HeaderView(title: WStrings.QRScan_NoAccessTitle.localized,
                                    description: WStrings.QRScan_NoAccessCamera.localized)
        headerView.lblTitle.textColor = .white
        headerView.lblDescription.textColor = .white
        topView.addSubview(headerView)
        NSLayoutConstraint.activate([
            headerView.leftAnchor.constraint(equalTo: topView.leftAnchor, constant: 32),
            headerView.rightAnchor.constraint(equalTo: topView.rightAnchor, constant: -32),
            headerView.centerYAnchor.constraint(equalTo: topView.centerYAnchor)
        ])
    }
    
}
