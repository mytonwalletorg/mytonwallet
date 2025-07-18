//
//  EmptyEarnView.swift
//  UIEarn
//
//  Created by Sina on 5/13/24.
//

import SwiftUI
import UIKit
import UIComponents
import WalletContext

public class EmptyEarnView: WTouchPassStackView, WThemedView {
    
    public init() {
        super.init(frame: .zero)
        setupViews()
    }
    
    required init(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    private let notFoundImageView = {
        let iv = UIImageView(image: UIImage(named: "EarnNotFound", in: AirBundle, compatibleWith: nil))
        return iv
    }()
    
    private let earnFromTokensLabel = {
        let lbl = UILabel()
        lbl.font = .systemFont(ofSize: 17)
        lbl.text = WStrings.Earn_EarnWhileHolding.localized
        lbl.textAlignment = .center
        lbl.numberOfLines = 0
        return lbl
    }()
    
    let estimatedAPYLabel = {
        let lbl = UILabel()
        lbl.font = .systemFont(ofSize: 16)
        lbl.text = WStrings.Earn_EstimatedAPY.localized
        lbl.textAlignment = .center
        lbl.numberOfLines = 0
        return lbl
    }()
    
    private lazy var whyThisIsSafeButton = {
        let button = WButton(style: .clearBackground)
        button.setTitle(WStrings.Earn_WhyThisIsSafe.localized, for: .normal)
        button.addTarget(self, action: #selector(self.whyThisIsSafePressed), for: .touchUpInside)
        return button
    }()
    
    private func setupViews() {
        spacing = 16
        axis = .vertical
        alignment = .center
        addArrangedSubview(notFoundImageView)
        addArrangedSubview(earnFromTokensLabel)
        addArrangedSubview(estimatedAPYLabel)
        addArrangedSubview(whyThisIsSafeButton)
        updateTheme()
    }
    
    public func updateTheme() {
        estimatedAPYLabel.textColor = WTheme.secondaryLabel
    }
    
    @objc func whyThisIsSafePressed() {
        showWhyIsSafe()
    }
    
}


@MainActor func showWhyIsSafe() {
    
    if let vc = topWViewController() {
        
        let lines = WStrings.Earn_WhyStakingIsSafeDesc.localized.split(separator: "|").map { String($0) }
        
        vc.showTip(title: WStrings.Earn_WhyStakingIsSafe.localized) {
            
            if #available(iOS 16.0, *) {
                Grid(alignment: .leadingFirstTextBaseline, horizontalSpacing: 4, verticalSpacing: 12) {
                    ForEach(Array(lines.indices), id: \.self) { i in
                        GridRow {
                            Text("\(i + 1).")
                            Text(LocalizedStringKey(lines[i]))
                        }
                    }
                }
            } else {
                Text(lines.joined(separator: "\n\n"))
            }
        }
    }
}
