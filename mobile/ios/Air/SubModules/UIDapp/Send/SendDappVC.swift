
import SwiftUI
import UIKit
import Ledger
import UIPasscode
import UIComponents
import WalletCore
import WalletContext

public class SendDappVC: WViewController {
    
    var request: MDappSendTransactions
    var onConfirm: (String?) -> ()
    
    public init(
        request: MDappSendTransactions,
        onConfirm: @escaping (String?) -> ()
    ) {
        self.request = request
        self.onConfirm = onConfirm
        super.init(nibName: nil, bundle: nil)
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    public override func loadView() {
        super.loadView()
        setupViews()
    }

    private lazy var appIconView = {
        let img = UIImageView()
        img.translatesAutoresizingMaskIntoConstraints = false
        img.layer.cornerRadius = 16
        img.layer.masksToBounds = true
        return img
    }()
    
    private lazy var titleLabel = {
        let lbl = UILabel()
        lbl.translatesAutoresizingMaskIntoConstraints = false
        lbl.font = UIFont.systemFont(ofSize: 24, weight: .semibold)
        lbl.textAlignment = .center
        return lbl
    }()
    
    private lazy var subtitleLabel = {
        let lbl = UILabel()
        lbl.translatesAutoresizingMaskIntoConstraints = false
        lbl.font = UIFont.systemFont(ofSize: 17, weight: .regular)
        lbl.textAlignment = .center
        return lbl
    }()
    
    private lazy var hintLabel = {
        let lbl = UILabel()
        lbl.translatesAutoresizingMaskIntoConstraints = false
        lbl.font = UIFont.systemFont(ofSize: 17, weight: .regular)
        lbl.textAlignment = .center
        lbl.text = WStrings.ConnectDapp_Hint.localized
        lbl.numberOfLines = 0
        return lbl
    }()
    
    private lazy var cancelButton = {
        let btn = WButton(style: .secondary)
        btn.translatesAutoresizingMaskIntoConstraints = false
        btn.setTitle(WStrings.Navigation_Cancel.localized, for: .normal)
        btn.addTarget(self, action: #selector(onCancel), for: .touchUpInside)
        return btn
    }()
    
    private lazy var sendButton = {
        let btn = WButton(style: .primary)
        btn.translatesAutoresizingMaskIntoConstraints = false
        btn.setTitle(WStrings.SendConfirm_Confirm.localized, for: .normal)
        btn.addTarget(self, action: #selector(onSend), for: .touchUpInside)
        return btn
    }()
    
    private lazy var contentView = {
        var constraints = [NSLayoutConstraint]()
        
        let v = UIView()
        v.translatesAutoresizingMaskIntoConstraints = false
        
        v.addSubview(appIconView)
        constraints.append(contentsOf: [
            appIconView.widthAnchor.constraint(equalToConstant: 64),
            appIconView.heightAnchor.constraint(equalToConstant: 64),
            appIconView.topAnchor.constraint(equalTo: v.topAnchor, constant: 48),
            appIconView.centerXAnchor.constraint(equalTo: v.centerXAnchor)
        ])
        
        v.addSubview(titleLabel)
        constraints.append(contentsOf: [
            titleLabel.topAnchor.constraint(equalTo: appIconView.bottomAnchor, constant: 16),
            titleLabel.leadingAnchor.constraint(equalTo: v.leadingAnchor, constant: 35),
            titleLabel.trailingAnchor.constraint(equalTo: v.trailingAnchor, constant: -35),
        ])
        
        v.addSubview(subtitleLabel)
        constraints.append(contentsOf: [
            subtitleLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 4),
            subtitleLabel.leadingAnchor.constraint(equalTo: v.leadingAnchor, constant: 35),
            subtitleLabel.trailingAnchor.constraint(equalTo: v.trailingAnchor, constant: -35),
        ])
        
        // hosting goes here
        
        v.addSubview(cancelButton)
        v.addSubview(sendButton)
        constraints.append(contentsOf: [
            sendButton.bottomAnchor.constraint(equalTo: v.bottomAnchor, constant: -16),
            sendButton.leadingAnchor.constraint(equalTo: cancelButton.trailingAnchor, constant: 12),
            sendButton.trailingAnchor.constraint(equalTo: v.trailingAnchor, constant: -16),
            cancelButton.leadingAnchor.constraint(equalTo: v.leadingAnchor, constant: 16),
            cancelButton.topAnchor.constraint(equalTo: sendButton.topAnchor),
            cancelButton.bottomAnchor.constraint(equalTo: sendButton.bottomAnchor),
            cancelButton.widthAnchor.constraint(equalTo: sendButton.widthAnchor),
        ])
        
        NSLayoutConstraint.activate(constraints)
        
        return v
    }()
    
    private func setupViews() {
        var constraints = [NSLayoutConstraint]()
        
        addNavigationBar(title: nil, subtitle: nil, closeIcon: true)

        view.insertSubview(contentView, at: 0)
        let contentToTopConstraint = contentView.topAnchor.constraint(equalTo: view.topAnchor)
        let contentToBottomConstraint = contentView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor)
        contentToBottomConstraint.priority = UILayoutPriority(500)
        constraints.append(contentsOf: [
            contentToTopConstraint,
            contentToBottomConstraint,
            contentView.leftAnchor.constraint(equalTo: view.leftAnchor),
            contentView.rightAnchor.constraint(equalTo: view.rightAnchor)
        ])
        
        NSLayoutConstraint.activate(constraints)
        
        let hc = addHostingController(makeView(), constraints: { [self] h in
            NSLayoutConstraint.activate([
                h.topAnchor.constraint(equalTo: subtitleLabel.bottomAnchor, constant: 24),
                h.leadingAnchor.constraint(equalTo: view.leadingAnchor),
                h.trailingAnchor.constraint(equalTo: view.trailingAnchor),
                h.bottomAnchor.constraint(lessThanOrEqualTo: sendButton.topAnchor, constant: -16),
            ])
        })
        hc.view.backgroundColor = .clear

        updateDappViews()
        
        bringNavigationBarToFront()
        
        updateTheme()
    }
    
    private func makeView() -> SendDappContentView {
        SendDappContentView(request: request, onShowDetail: showDetail(_:))
    }
    
    private func showDetail(_ tx: ApiDappTransfer) {
        navigationController?.pushViewController(DappSendTransactionDetailVC(message: tx), animated: true)
    }
    
    private func updateDappViews() {
        titleLabel.text = request.dapp.name
        if let url = URL(string: request.dapp.url) {
            subtitleLabel.text = url.host(percentEncoded: false)
        }
        if let imageUrl = URL(string: request.dapp.iconUrl) {
            appIconView.kf.setImage(with: imageUrl)
        }
        view.layoutIfNeeded()
    }
        
    public override func updateTheme() {
        view.backgroundColor = WTheme.sheetBackground
        subtitleLabel.textColor = WTheme.tint
        if WTheme.tint == .label {
            subtitleLabel.textColor = WTheme.backgroundReverse
        } else {
            subtitleLabel.textColor = WTheme.tint
        }
    }
    
    @objc func onSend() {
        if AccountStore.account?.isHardware == true {
            Task {
                await confirmLedger()
            }
        } else {
            confirmMnemonic()
        }
    }
    
    private func confirmMnemonic() {
        UnlockVC.presentAuth(
            on: self,
            title: WStrings.SendConfirm_ConfirmSend.localized,
            subtitle: request.dapp.url,
            onDone: { [weak self] passcode in
                self?.onConfirm(passcode)
                self?.dismiss(animated: true)
            },
            cancellable: true
        )
    }
    
    private func confirmLedger() async {
        guard
            let account = AccountStore.account,
            let fromAddress = account.tonAddress?.nilIfEmpty,
            let ledger = account.ledger
        else { return }
        
        let signModel = await LedgerSignModel(
            accountId: account.id,
            fromAddress: fromAddress,
            ledger: ledger,
            signData: .signDappTransfers(update: request)
        )
        let vc = LedgerSignVC(
            model: signModel,
            title: WStrings.SendConfirm_ConfirmSend.localized,
            headerView: EmptyView()
        )
        vc.onDone = { vc in
            self.onConfirm("ledger")
            self.dismiss(animated: true, completion: {
                self.presentingViewController?.dismiss(animated: true)
            })
        }
        vc.onCancel = { vc in
            self.onConfirm(nil)
            self.dismiss(animated: true, completion: {
                self.presentingViewController?.dismiss(animated: true)
            })
        }
        present(vc, animated: true)
    }
    
    
    
    @objc func onCancel() {
        onConfirm(nil)
        self.dismiss(animated: true)
    }
}
