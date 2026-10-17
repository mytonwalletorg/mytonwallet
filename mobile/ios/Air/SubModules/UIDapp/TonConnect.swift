
import SwiftUI
import UIKit
import UIComponents
import WalletCore
import WalletContext

public let TonConnectErrorCodes: [Int: String] = [
    0: "unknownError",
    1: "badRequestError",
    2: "manifestNotFoundError",
    3: "manifestContentError",
    100: "unknownAppError",
    300: "userRejectsError",
    400: "methodNotSupported",
]

private let log = Log("TonConnect")

@MainActor
private final class DappRequestNavigationController: WNavigationController {
    var onDidDismiss: (() -> Void)?

    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        guard presentingViewController == nil else { return }
        onDidDismiss?()
        onDidDismiss = nil
    }
}

@MainActor public final class TonConnect: WalletCoreData.EventsObserver {
    
    public static let shared = TonConnect()
    
    private weak var placeholderNc: WNavigationController?
    private weak var lastPresented: UIViewController?
    private var pendingReturnStrategy: ReturnStrategy?
    private var pendingRequestError: ApiAnyDisplayError?

    // Opened by `resumeRequests()` once the wallet is ready and unlocked; a sheet presented earlier would sit on the
    // lock screen and be dismissed together with it
    private lazy var requestQueue = DappRequestQueue<WalletCoreData.Event>(
        isOpen: false,
        isReady: {
            guard let delegate = WalletContextManager.delegate else { return false }
            return delegate.isWalletReady && delegate.isAppUnlocked
        },
        isBusy: {
            Self.isPresentationInFlight()
        },
        handle: { [weak self] event, status in
            await self?.handleEvent(event: event, status: status) ?? .done
        },
        discard: { event in
            Self.cancelRequest(of: event)
        },
        isStale: { event in
            Self.isAccountMissing(for: event)
        }
    )
    
    init() {
        WalletCoreData.add(eventObserver: self)
    }
    
    public func start() {
        // nothing to do, just makes sure shared TonConnect is initialized
    }

    /// Lets queued requests reach the screen. Call it whenever the wallet becomes ready and unlocked.
    public func resumeRequests() {
        requestQueue.open()
    }

    /// Holds requests until the next `resumeRequests()`, or drops (and rejects) the ones already queued.
    public func suspendRequests(discardingQueued: Bool = false) {
        requestQueue.close(discardingQueued: discardingQueued)
    }
    
    public func handleDeeplink(_ url: String) {
        TonConnectTrace.record("tonConnect_handleDeepLink → SDK: \(TonConnectTrace.describeLink(url))")
        Task { @MainActor in
            do {
                let identifier = "\(Date().timeIntervalSince1970)"
                let returnStrategy = try await Api.startSseConnection(params: ApiSseConnectionParams(
                        url: url,
                        isFromInAppBrowser: false,
                        identifier: identifier
                    )
                )
                TonConnectTrace.record("tonConnect_handleDeepLink returned \(describeReturnStrategy(returnStrategy))")
                if let returnStrategy, case .url(let str) = returnStrategy {
                    openReturnUrl(str)
                }
            } catch {
                TonConnectTrace.record("tonConnect_handleDeepLink failed: \(error)")
                log.error("failed to handle deeplink: \(error, .public)")
                AppActions.showError(error: error)
            }
        }
    }

    @MainActor func openReturnUrl(_ returnUrl: String) {
        var str = returnUrl
        if !str.contains("://") {
            str = "https://" + str
        }
        guard let url = URL(string: str) else { return }
        DispatchQueue.main.async {
            UIApplication.shared.open(url)
        }
    }

    public func walletCore(event: WalletCore.WalletCoreData.Event) {
        switch event {
        case .dappLoading, .dappCloseLoading, .dappConnect, .dappSendTransactions, .dappSignData,
             .dappAlreadyConnected, .dappDisconnected, .dappRequestSettled:
            requestQueue.enqueue(event)
        case .accountsReset:
            requestQueue.invalidate()
        default:
            break
        }
    }
    
    func handleEvent(
        event: WalletCoreData.Event,
        status: @escaping @MainActor () -> DappRequestStatus
    ) async -> DappRequestOutcome {
        switch event {
        case .dappLoading(let update):
            return await handleLoading(update: update, status: status)
        case .dappCloseLoading(let update):
            await handleCloseLoading(update: update)
        case .dappConnect(let update):
            return await handleConnect(update: update, status: status)
        case .dappSendTransactions(let update):
            return await handleSendTransactions(update: update, status: status)
        case .dappSignData(let update):
            return await handleSignData(update: update, status: status)
        case .dappAlreadyConnected(let update):
            await handleAlreadyConnected(update: update)
        case .dappDisconnected(let update):
            await handleDisconnected(update: update)
        case .dappRequestSettled(let update):
            handleRequestSettled(update: update)
        default:
            break
        }
        return .done
    }

    @MainActor func handleLoading(
        update: ApiUpdate.DappLoading,
        status: @MainActor () -> DappRequestStatus
    ) async -> DappRequestOutcome {
        // The SSE request event may arrive before the wake deeplink; if a request modal is already shown, ignore the placeholder.
        if update.isWaitingForRequest == true, lastPresented != nil {
            TonConnectTrace.record("dappLoading: skips the waiting placeholder, a request sheet is already shown")
            return .done
        }
        if let accountId = update.accountId, update.connectionType != .connect {
            await switchAccountIfNeeded(accountId: accountId)
            if let outcome = Self.interruptedOutcome(status()) {
                return outcome
            }
        }
        // The real request emits a typed `dappLoading` of its own; keep the matching placeholder, or swap it on a type change.
        if let nc = placeholderNc, let top = nc.visibleViewController {
            let matchesType = switch update.connectionType {
            case .connect: top is ConnectDappVC
            case .sendTransaction: top is SendDappVC
            case .signData: top is SignDataVC
            }
            if matchesType {
                TonConnectTrace.record("dappLoading: keeps the \(update.connectionType) placeholder")
                return .done
            }
            TonConnectTrace.record("dappLoading: dismisses the placeholder for a \(update.connectionType) one")
            placeholderNc = nil
            await dismissAndWait(nc, animated: false)
            if let outcome = Self.interruptedOutcome(status()) {
                return outcome
            }
        }
        let vc: UIViewController
        switch update.connectionType {
        case .connect:
            vc = ConnectDappVC(placeholderAccountId: update.accountId)
        case .sendTransaction:
            vc = SendDappVC(
                placeholderAccountId: update.accountId,
                isWaitingForRequest: update.isWaitingForRequest == true,
                returnUrl: update.returnUrl
            )
        case .signData:
            vc = SignDataVC(placeholderAccountId: update.accountId)
        }
        let nc = makeRequestNavigationController(rootViewController: vc)
        self.placeholderNc = nc
        TonConnectTrace.record("dappLoading: \(update.connectionType) placeholder, waiting for request=\(update.isWaitingForRequest == true)")
        presentAndRecord(nc)
        return .done
    }

    @MainActor func handleCloseLoading(update: ApiUpdate.DappCloseLoading) async {
        guard let nc = placeholderNc,
              isPlaceholder(nc.visibleViewController, for: update.connectionType) else {
            TonConnectTrace.record("dappCloseLoading: no \(update.connectionType) placeholder to close")
            return
        }
        TonConnectTrace.record("dappCloseLoading: dismisses the \(update.connectionType) placeholder")
        placeholderNc = nil
        if lastPresented === nc {
            lastPresented = nil
        }
        await dismissAndWait(nc, animated: true)
    }

    @MainActor private func isPlaceholder(_ vc: UIViewController?, for connectionType: ApiDappConnectionType) -> Bool {
        switch connectionType {
        case .connect:
            guard let vc = vc as? ConnectDappVC else { return false }
            return vc.viewModel.update == nil
        case .sendTransaction:
            guard let vc = vc as? SendDappVC else { return false }
            return vc.request == nil
        case .signData:
            guard let vc = vc as? SignDataVC else { return false }
            return vc.update == nil
        }
    }

    @MainActor func handleAlreadyConnected(update: ApiUpdate.DappAlreadyConnected) async {
        let url = update.url
        TonConnectTrace.record("dappAlreadyConnected: alert on \(describeTopViewController())")
        topViewController()?.showAlert(
            title: lang("Already Connected"),
            text: lang("Return to the dapp to proceed, or reconnect."),
            button: lang("OK"),
            buttonPressed: { [weak self] in
                if let url {
                    self?.openReturnUrl(url)
                }
            },
            secondaryButton: url != nil ? lang("Cancel") : nil
        )
    }

    @MainActor func handleDisconnected(update: ApiUpdate.DappDisconnected) async {
        let url = update.url
        TonConnectTrace.record("dappDisconnected: alert on \(describeTopViewController())")
        topViewController()?.showAlert(
            title: lang("Dapp Disconnected"),
            text: lang("Please reconnect your wallet from the dapp."),
            button: lang("OK"),
            buttonPressed: { [weak self] in
                if let url {
                    self?.openReturnUrl(url)
                }
            },
            secondaryButton: url != nil ? lang("Cancel") : nil
        )
    }

    @MainActor func handleConnect(
        update: ApiUpdate.DappConnect,
        status: @MainActor () -> DappRequestStatus
    ) async -> DappRequestOutcome {
        if update.multichainResolution != .switchedAccount {
            await switchAccountIfNeeded(accountId: update.accountId)
        }
        if let outcome = Self.interruptedOutcome(accountId: update.accountId, promiseId: update.promiseId, status: status) {
            return outcome
        }
        Api.recordTonConnectEvent(eventName: "wallet-connect-request-ui-displayed", promiseId: update.promiseId)
        if let vc = placeholderNc?.visibleViewController as? ConnectDappVC {
            TonConnectTrace.record("dappConnect: fills the placeholder")
            vc.replacePlaceholder(
                request: update,
                onCreateMultichainWallet: { [weak self] in
                    self?.createMultichainWallet(request: update)
                }
            )
            self.placeholderNc = nil
        } else {
            let vc = ConnectDappVC(
                request: update,
                onCreateMultichainWallet: { [weak self] in
                    self?.createMultichainWallet(request: update)
                }
            )
            presentAndRecord(makeRequestNavigationController(rootViewController: vc))
        }
        return .done
    }
    
    func prepareConnect(
        request: ApiUpdate.DappConnect,
        accountId: String,
        enclaveToken: EnclaveToken,
        resolver: ConnectRequestResolver
    ) async throws -> DappConnectSubmitResult {
        Api.recordTonConnectEvent(eventName: "wallet-connect-accepted", promiseId: request.promiseId)
        var signatures: [String]? = nil
        var publicKeys: [String]? = nil
        let account = AccountStore.get(accountId: accountId)
        if let proof = request.proof {
            guard let tonAddress = account.getAddress(chain: .ton) else {
                throw DisplayError(text: lang("No matching chains"))
            }
            let dappChains = [
                ApiDappSessionChain(chain: .ton, address: tonAddress, network: account.network),
            ]
            let result = try await Api.signDappProof(
                dappChains: dappChains,
                accountId: accountId,
                proof: proof,
                enclaveToken: enclaveToken
            )
            signatures = result.signatures
            publicKeys = result.publicKeys
        }
        return DappConnectSubmitResult(
            accountId: accountId,
            proofSignatures: signatures,
            proofPublicKeys: publicKeys,
            resolver: resolver
        )
    }

    func createMultichainWallet(request: ApiUpdate.DappConnect) {
        let network = AccountStore.get(accountId: request.accountId).network
        AppActions.showAddWallet(network: network)
    }

    @MainActor  func handleSendTransactions(
        update: ApiUpdate.DappSendTransactions,
        status: @MainActor () -> DappRequestStatus
    ) async -> DappRequestOutcome {
        await switchAccountIfNeeded(accountId: update.accountId)
        if let outcome = Self.interruptedOutcome(accountId: update.accountId, promiseId: update.promiseId, status: status) {
            return outcome
        }
        Api.recordTonConnectEvent(eventName: "wallet-transaction-confirmation-ui-displayed", promiseId: update.promiseId)
        if let vc = placeholderNc?.visibleViewController as? SendDappVC {
            TonConnectTrace.record("dappSendTransactions: fills the placeholder")
            vc.replacePlaceholder(
                request: update,
                onCancel: { self.cancelSendTransactions(request: update) }
            )
            self.placeholderNc = nil
        } else {
            let vc = SendDappVC(
                request: update,
                onCancel: { self.cancelSendTransactions(request: update) }
            )
            let nc = makeRequestNavigationController(rootViewController: vc)
            if let sheet = nc.sheetPresentationController {
                sheet.detents = [.large()]
            }
            presentAndRecord(nc)
        }
        return .done
    }
    
    func submitSendTransactions(request: ApiUpdate.DappSendTransactions, enclaveToken: EnclaveToken?) async throws -> DappSendSubmitResult {
        Api.recordTonConnectEvent(eventName: "wallet-transaction-accepted", promiseId: request.promiseId)
        let account = AccountStore.get(accountId: request.accountId)
        let chain = request.operationChain
        guard let address = account.getAddress(chain: chain) else {
            throw DisplayError(text: lang("No matching chains"))
        }
        guard request.transactions.allSatisfy({ $0.chain == nil || $0.chain == chain }) else {
            throw DisplayError(text: lang("Unexpected error"))
        }
        let dappChain = ApiDappSessionChain(chain: chain, address: address, network: account.network)
        let result = try await Api.signDappTransfersProtected(
            dappChain: dappChain,
            accountId: request.accountId,
            messages: request.transactions.map { ApiTransferToSign($0, chain: chain) },
            options: .init(
                enclaveToken: enclaveToken,
                vestingAddress: request.vestingAddress,
                validUntil: request.validUntil,
                isLegacyOutput: request.isLegacyOutput,
            )
        )
        if let signedTransfers = result.signedTransfers {
            try await Api.confirmDappRequestSendTransaction(
                promiseId: request.promiseId,
                data: signedTransfers
            )
        }
        return DappSendSubmitResult(
            promiseId: request.promiseId,
            result: result
        )
    }
    
    func cancelSendTransactions(request: ApiUpdate.DappSendTransactions) {
        Api.recordTonConnectEvent(eventName: "wallet-transaction-declined", promiseId: request.promiseId)
        Task {
            do {
                try await Api.cancelDappRequest(promiseId: request.promiseId, reason: lang("Canceled by the user"))
            } catch {
                log.error("cancelSendTransactions \(error, .public)")
            }
        }
    }
    
    @MainActor func handleSignData(
        update: ApiUpdate.DappSignData,
        status: @MainActor () -> DappRequestStatus
    ) async -> DappRequestOutcome {
        await switchAccountIfNeeded(accountId: update.accountId)
        if let outcome = Self.interruptedOutcome(accountId: update.accountId, promiseId: update.promiseId, status: status) {
            return outcome
        }
        Api.recordTonConnectEvent(eventName: "wallet-sign-data-confirmation-ui-displayed", promiseId: update.promiseId)
        if let vc = placeholderNc?.visibleViewController as? SignDataVC {
            TonConnectTrace.record("dappSignData: fills the placeholder")
            vc.replacePlaceholder(
                update: update,
                onCancel: { self.cancelSignData(update: update) }
            )
            self.placeholderNc = nil
        } else {
            let vc = SignDataVC(
                update: update,
                onCancel: { self.cancelSignData(update: update) }
            )
            let nc = makeRequestNavigationController(rootViewController: vc)
            presentAndRecord(nc)
        }
        return .done
    }

    @MainActor private func makeRequestNavigationController(
        rootViewController: UIViewController
    ) -> DappRequestNavigationController {
        let nc = DappRequestNavigationController(rootViewController: rootViewController)
        nc.onDidDismiss = { [weak self] in
            self?.requestNavigationControllerDidDismiss()
        }
        return nc
    }

    @MainActor private func handleRequestSettled(update: ApiUpdate.DappRequestSettled) {
        TonConnectTrace.record("dappRequestSettled: error=\(update.error != nil) return=\(describeReturnStrategy(update.returnStrategy)) sheetShown=\(lastPresented?.presentingViewController != nil)")
        if let error = update.error {
            pendingReturnStrategy = nil
            if let lastPresented, lastPresented.presentingViewController != nil {
                pendingRequestError = error
            } else {
                AppActions.showError(error: error)
            }
            return
        }
        guard update.returnStrategy != .none else { return }

        if let lastPresented, lastPresented.presentingViewController != nil {
            pendingReturnStrategy = update.returnStrategy
        } else {
            performReturnStrategy(update.returnStrategy)
        }
    }

    @MainActor private func requestNavigationControllerDidDismiss() {
        lastPresented = nil
        if let pendingRequestError {
            self.pendingRequestError = nil
            AppActions.showError(error: pendingRequestError)
            return
        }
        if let pendingReturnStrategy {
            self.pendingReturnStrategy = nil
            performReturnStrategy(pendingReturnStrategy)
        }
    }

    @MainActor private func performReturnStrategy(_ strategy: ReturnStrategy) {
        guard case .url(let value) = strategy, let url = URL(string: value) else {
            showReturnToDappIndicator()
            return
        }
        UIApplication.shared.open(url, options: [:]) { success in
            guard !success else { return }
            Task { @MainActor in
                self.showReturnToDappIndicator()
            }
        }
    }

    @MainActor private func showReturnToDappIndicator() {
        AppActions.showToast(message: lang("Return to the dapp to proceed, or reconnect."))
    }
    
    func submitSignData(update: ApiUpdate.DappSignData, enclaveToken: EnclaveToken?) async throws -> ApiMfaProtectedResult {
        Api.recordTonConnectEvent(eventName: "wallet-sign-data-accepted", promiseId: update.promiseId)
        let account = AccountStore.get(accountId: update.accountId)
        let chain = update.operationChain
        guard let address = account.getAddress(chain: chain) else {
            throw DisplayError(text: lang("No matching chains"))
        }
        let dappChain = ApiDappSessionChain(chain: chain, address: address, network: account.network)
        let result = try await Api.signDappData(
            dappChain: dappChain,
            accountId: update.accountId,
            dappUrl: update.dapp.url,
            payloadToSign: update.payloadToSign,
            enclaveToken: enclaveToken
        )
        try await Api.confirmDappRequestSignData(promiseId: update.promiseId, data: AnyEncodable(result))
        return ApiMfaProtectedResult()
    }
    
    func cancelSignData(update: ApiUpdate.DappSignData) {
        Api.recordTonConnectEvent(eventName: "wallet-sign-data-declined", promiseId: update.promiseId)
        Task {
            do {
                try await Api.cancelDappRequest(promiseId: update.promiseId, reason: nil)
            } catch {
                log.error("cancelSignData: \(error)")
            }
        }
    }
    
    func switchAccountIfNeeded(accountId: String) async {
        do {
            if AccountStore.accountId != accountId {
                _ = try await AccountStore.activateAccount(accountId: accountId)
            }
        } catch {
            log.error("failed to switch to account \(accountId, .public) error:\(error, .public)")
        }
    }
    
    @MainActor func presentAndRecord(_ vc: UIViewController) {
        // Without a top view controller the sheet is not presented and nothing else reports it.
        TonConnectTrace.record("presents \(describeViewController(vc)) on \(describeTopViewController())")
        // Only one dapp request modal at a time: if one is still on screen (e.g. a connect deeplink
        // tapped twice in a row), replace it instead of stacking a second sheet.
        if let previous = lastPresented, previous.presentingViewController != nil {
            cancelReplacedRequest(in: previous)
            previous.dismiss(animated: false) { [weak self] in
                self?.lastPresented = vc
                topViewController()?.present(vc, animated: true)
            }
        } else {
            lastPresented = vc
            topViewController()?.present(vc, animated: true)
        }
    }
}

extension TonConnect {
    /// Waits for the dismissal, but only briefly: UIKit never calls the completion of a dismissal it can't start.
    private func dismissAndWait(_ viewController: UIViewController, animated: Bool) async {
        guard viewController.presentingViewController != nil else { return }
        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            let once = ResumeOnce(continuation)
            viewController.dismiss(animated: animated) {
                once.resume()
            }
            Task {
                try? await Task.sleep(for: .seconds(2))
                once.resume()
            }
        }
    }

    /// A sheet dismissed for a newer request rejects its own request the way a swipe-down would, so it never hangs.
    /// Each sheet's cancel path does nothing for a placeholder or a request the user already answered.
    private func cancelReplacedRequest(in viewController: UIViewController) {
        let content = (viewController as? UINavigationController)?.viewControllers.first ?? viewController
        switch content {
        case let sendVC as SendDappVC:
            sendVC.onCancel?()
            sendVC.onCancel = nil
        case let signDataVC as SignDataVC:
            signDataVC.onCancel?()
            signDataVC.onCancel = nil
        case let connectVC as ConnectDappVC:
            connectVC.viewModel.cancel()
        default:
            break
        }
    }

    /// The unlock screen is still animating away right after the unlock flag flips.
    private static func isPresentationInFlight() -> Bool {
        var viewController = UIApplication.shared.sceneKeyWindow?.rootViewController
        while let current = viewController {
            if current.isBeingPresented || current.isBeingDismissed {
                return true
            }
            viewController = current.presentedViewController
        }
        return false
    }

    /// A request for an account that was removed must not reach the screen, where another wallet could answer it.
    private static func isAccountMissing(for event: WalletCoreData.Event) -> Bool {
        let accountId: String? = switch event {
        case .dappLoading(let update): update.accountId
        case .dappConnect(let update): update.accountId
        case .dappSendTransactions(let update): update.accountId
        case .dappSignData(let update): update.accountId
        default: nil
        }
        guard let accountId else { return false }
        return isAccountMissing(accountId: accountId)
    }

    private static func isAccountMissing(accountId: String) -> Bool {
        AccountStore.accountsById[accountId] == nil
    }

    /// The account switch suspends: the wallets may be reset meanwhile, the queue may stop waiting for this handler, or
    /// the app may lock. Account ids are reused, so the queue's own check is what tells a new wallet from the one the
    /// request was for. Returns `nil` when the request can still be shown; a stale one is rejected here.
    private static func interruptedOutcome(
        accountId: String,
        promiseId: String,
        status: @MainActor () -> DappRequestStatus
    ) -> DappRequestOutcome? {
        let requestStatus: DappRequestStatus = isAccountMissing(accountId: accountId) ? .stale : status()
        if requestStatus == .stale {
            cancelRequest(promiseId: promiseId)
        }
        return interruptedOutcome(requestStatus)
    }

    private static func interruptedOutcome(_ status: DappRequestStatus) -> DappRequestOutcome? {
        switch status {
        case .current:
            return nil
        case .stale:
            TonConnectTrace.record("drops a request that went stale while it was being handled")
            return .done
        case .held:
            TonConnectTrace.record("holds a request until requests resume")
            return .held
        }
    }

    private static func cancelRequest(of event: WalletCoreData.Event) {
        let promiseId: String? = switch event {
        case .dappConnect(let update): update.promiseId
        case .dappSendTransactions(let update): update.promiseId
        case .dappSignData(let update): update.promiseId
        default: nil
        }
        guard let promiseId else { return }
        cancelRequest(promiseId: promiseId)
    }

    private static func cancelRequest(promiseId: String) {
        TonConnectTrace.record("cancels a request that can no longer be shown")
        Task {
            do {
                try await Api.cancelDappRequest(promiseId: promiseId, reason: nil)
            } catch {
                log.error("cancelRequest: \(error, .public)")
            }
        }
    }
}

private func describeReturnStrategy(_ strategy: ReturnStrategy?) -> String {
    switch strategy {
    case nil: "nil"
    case .some(.none): "none"
    case .some(.back): "back"
    case .some(.url(let url)): TonConnectTrace.describeURL(url)
    }
}

@MainActor private func describeTopViewController() -> String {
    topViewController().map { describeViewController($0) } ?? "nil (nothing to present on)"
}

@MainActor private func describeViewController(_ vc: UIViewController) -> String {
    let content = (vc as? UINavigationController)?.viewControllers.first ?? vc
    return String(describing: type(of: content))
}
