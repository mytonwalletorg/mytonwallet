//
//  WalletCreatedView.swift
//
//  Created by Sina on 4/21/23.
//

import UIKit
import UIComponents
import WalletContext

public class WalletCreatedView: WTouchPassView {

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

    var titleLabel: UILabel!
    var subtitleLabel: UILabel!

    private func setupView() {
        translatesAutoresizingMaskIntoConstraints = false

        titleLabel = UILabel()
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        titleLabel.applyTextStyle(.bodyEmphasized)
        titleLabel.numberOfLines = 0
        titleLabel.textAlignment = .center
        addSubview(titleLabel)
        NSLayoutConstraint.activate([
            titleLabel.topAnchor.constraint(equalTo: topAnchor, constant: 38),
            titleLabel.leadingAnchor.constraint(equalTo: leadingAnchor),
            titleLabel.trailingAnchor.constraint(equalTo: trailingAnchor)
        ])

        subtitleLabel = UILabel()
        subtitleLabel.translatesAutoresizingMaskIntoConstraints = false
        subtitleLabel.applyTextStyle(.supporting)
        subtitleLabel.numberOfLines = 0
        subtitleLabel.textAlignment = .center
        addSubview(subtitleLabel)
        NSLayoutConstraint.activate([
            subtitleLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 6),
            subtitleLabel.leadingAnchor.constraint(equalTo: leadingAnchor),
            subtitleLabel.trailingAnchor.constraint(equalTo: trailingAnchor),
            subtitleLabel.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])
        
        configure(title: lang("No Activity"), subtitle: lang("There is no activity history for this wallet yet."))
    }

    func configure(title: String, subtitle: String) {
        titleLabel.attributedText = NSAttributedString(
            string: title,
            attributes: [
                .kern: -0.26,
                .font: titleLabel.font!,
                .foregroundColor: UIColor.air.secondaryLabel
            ]
        )
        subtitleLabel.attributedText = NSAttributedString(
            string: subtitle,
            attributes: [
                .kern: -0.09,
                .font: subtitleLabel.font!,
                .foregroundColor: UIColor.air.secondaryLabel
            ]
        )
    }
}
