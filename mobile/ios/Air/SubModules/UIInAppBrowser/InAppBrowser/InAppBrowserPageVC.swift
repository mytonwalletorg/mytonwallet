
import UIKit
import WebKit
import UIDapp
import UIComponents
import WalletCore
import WalletContext

private var log = Log("InAppBrowserPageVC")


protocol InAppBrowserPageDelegate: AnyObject {
    func inAppBrowserPageStateChanged(_ browserPageVC: InAppBrowserPageVC)
}


public class InAppBrowserPageVC: WViewController {
    
    public struct Config {
        public var url: URL
        public var title: String?
        public let injectTonConnectBridge: Bool
        public init(url: URL, title: String? = nil, injectTonConnectBridge: Bool) {
            self.url = url
            self.title = title
            self.injectTonConnectBridge = injectTonConnectBridge
        }
    }
    
    public private(set) var config: Config
    internal weak var delegate: (any InAppBrowserPageDelegate)?
    
    /// Use WalletCoreData.notify(.openInBrowser(...)) to open a browser window
    internal init(config: Config) {
        self.config = config
        super.init(nibName: nil, bundle: nil)
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    // MARK: - View Model and UI Components
    private(set) internal var webView: WKWebView?
    private var urlObserver: NSKeyValueObservation?
    private var titleObserver: NSKeyValueObservation?
    private var backObserver: NSKeyValueObservation?
    
    var isMinimized: Bool {
        sheetPresentationController?.selectedDetentIdentifier == .init("min")
    }
    
    public override func didMove(toParent parent: UIViewController?) {
        super.didMove(toParent: parent)
    }
    
    // MARK: - Load and SetupView Functions
    public override func loadView() {
        super.loadView()
        setupViews()
        setupObservers()
    }
    
    private func setupViews() {
        view.backgroundColor = WTheme.background
        view.translatesAutoresizingMaskIntoConstraints = false
        
        let webViewConfiguration = WKWebViewConfiguration()
        
        // make logging possible to get results from js promise
        let userContentController = WKUserContentController()
        userContentController.add(self, name: "inAppBrowserHandler")
        
        webViewConfiguration.userContentController = userContentController
        webViewConfiguration.allowsInlineMediaPlayback = true
        
        // create web view
        let webView = WKWebView(frame: CGRect(x: 0, y: 0, width: 100, height: 100),
                            configuration: webViewConfiguration)
        
        // while this is preferrable to setting top constraint constant to 60, it caused jittering when dismissing fragment.com - check if support is better in the future
//        webView.scrollView.contentInset.top = 60
//        webView.scrollView.verticalScrollIndicatorInsets.top = 60
//        webView.scrollView.contentInset.bottom = 30
        
        self.webView = webView
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
#if DEBUG
        if #available(iOS 16.4, *) {
            webView.isInspectable = true
        }
#endif
        webView.isOpaque = false // prevents flashing white during load

        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.topAnchor, constant: 60), // see comment above
            webView.leftAnchor.constraint(equalTo: view.leftAnchor),
            webView.rightAnchor.constraint(equalTo: view.rightAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -30)
        ])
        webView.clipsToBounds = false
        webView.scrollView.clipsToBounds = false // see comment above
        
        if config.injectTonConnectBridge {
            let script = WKUserScript(source: InAppBrowserTonConnectInjectionHelpers.objectToInject(),
                                      injectionTime: .atDocumentStart,
                                      forMainFrameOnly: true)
            webView.configuration.userContentController.addUserScript(script)
        }
        webView.load(URLRequest(url: config.url))
        delegate?.inAppBrowserPageStateChanged(self)
        
        updateTheme()
    }
    
    func setupObservers() {
        self.urlObserver = webView?.observe(\.url) { [weak self] webView, _ in
            if let self, let url = webView.url {
                self.config.url = url
                self.delegate?.inAppBrowserPageStateChanged(self)
            }
        }
        self.titleObserver = webView?.observe(\.title) { [weak self] webView, _ in
            if let self {
                self.config.title = webView.title
                self.delegate?.inAppBrowserPageStateChanged(self)
            }
        }
        self.backObserver = webView?.observe(\.canGoBack) { [weak self] webView, _ in
            if let self {
                self.delegate?.inAppBrowserPageStateChanged(self)
            }
        }
    }
    
    public override func updateTheme() {
        view.backgroundColor = WTheme.background
        webView?.backgroundColor = WTheme.background
        webView?.scrollView.backgroundColor = WTheme.background
    }
    
    func reload() {
        webView?.reload()
    }
    
    func openInSafari() {
        guard UIApplication.shared.canOpenURL(config.url) else { return }
        UIApplication.shared.open(config.url, options: [:], completionHandler: nil)
    }
    
    func copyUrl() {
        UIPasteboard.general.string = config.url.absoluteString
    }
    
    func share() {
        let activityViewController = UIActivityViewController(activityItems: [config.url], applicationActivities: nil)
        activityViewController.excludedActivityTypes = [.assignToContact, .print]
        self.present(activityViewController, animated: true, completion: nil)
    }
    
    // Called after any ton-connect related request to send response into browser
    @MainActor
    private func injectTonConnectResult(invocationId: String, result: Any?, error: String?) {
        let connectionResultMessage: [String: Any]
        if error == nil {
            guard let dict = result as? [String: Any] else {
                return
            }
            connectionResultMessage = [
                "type": InAppBrowserTonConnectInjectionHelpers.WebViewBridgeMessageType.functionResponse.rawValue,
                "invocationId": invocationId,
                "status": "fulfilled",
                "data": dict
            ]
        } else {
            connectionResultMessage = [
                "type": InAppBrowserTonConnectInjectionHelpers.WebViewBridgeMessageType.functionResponse.rawValue,
                "invocationId": invocationId,
                "status": "rejected",
                "data": error!
            ]
        }
        guard let jsonData = try? JSONEncoder().encode(AnyEncodable(dict: connectionResultMessage)),
              let resultInJSON = String(data: jsonData, encoding: .utf8)?.replacingOccurrences(of: "\"", with: "\\\"") else {
            return
        }
        webView?.evaluateJavaScript(
        """
            (function() {
              window.dispatchEvent(new MessageEvent('message', {
                data: "\(resultInJSON)"
              }));
            })();
        """
        )
    }
}

extension InAppBrowserPageVC: WKNavigationDelegate, WKUIDelegate {
    
    public func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    }
    
    public func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: any Error) {
    }
    
    public func webView(_ webView: WKWebView,
                        didFailProvisionalNavigation navigation: WKNavigation!,
                        withError error: any Error) {
    }
    
    public func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction) async -> WKNavigationActionPolicy {
        return .allow
    }
    
    public func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse) async -> WKNavigationResponsePolicy {
        return .allow
    }
    
    // https://stackoverflow.com/questions/30603671/open-a-wkwebview-target-blank-link-in-safari
    public func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if navigationAction.targetFrame == nil {
            webView.load(navigationAction.request)
        }
        return nil
    }
}


extension InAppBrowserPageVC: WKScriptMessageHandler {
    public func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let data = (message.body as? String)?.data(using: .utf8) else {
            return
        }
        guard let dict = try? JSONSerialization.jsonObject(with: data, options: .mutableContainers) as? [String: Any] else {
            return
        }
        TonConnect.shared.start()
        
        switch dict["type"] as? String {
        case "invokeFunc":
            switch dict["name"] as? String {
            case "connect":
                guard let connectArgs = dict["args"] as? [Any],
                      let invocationId = dict["invocationId"] as? String,
                      let tcVersion = connectArgs[0] as? Int,
                      let tonConnectArgs = connectArgs[1] as? [String: Any],
                      let origin = config.url.origin else {
                    return
                }
                if tcVersion > supportedTonConnectVersion {
                    return
                }
                guard let accountId = AccountStore.accountId else { return }
                let dappArg = DappArg(url: origin, isUrlEnsured: nil, accountId: accountId)
                Api.tonConnect_connect(dapp: dappArg, request: tonConnectArgs, callback: { [weak self] result in
                    guard let self else { return }
                    DispatchQueue.main.async {
                        switch result {
                        case .success(let success):
                            self.injectTonConnectResult(invocationId: invocationId, result: success, error: nil)
                        case .failure(let failure):
                            self.injectTonConnectResult(invocationId: invocationId, result: nil, error: failure.localizedDescription)
                        }
                    }
                })
                
            case "restoreConnection":
                guard let invocationId = dict["invocationId"] as? String else {
                    return
                }
                guard let accountId = AccountStore.accountId, let origin = config.url.origin else { return }
                let dappArg = DappArg(url: origin, isUrlEnsured: nil, accountId: accountId)
                Api.tonConnect_reconnect(dapp: dappArg) { [weak self] res in
                    DispatchQueue.main.async {
                        switch res {
                        case .success(let success):
                            self?.injectTonConnectResult(invocationId: invocationId, result: success, error: nil)
                        case .failure(_):
                            self?.injectTonConnectResult(invocationId: invocationId, result: nil, error: "An error occured!")
                        }
                    }
                }
            case "disconnect":
                guard let invocationId = dict["invocationId"] as? String else {
                    return
                }
                guard let accountId = AccountStore.accountId, let origin = config.url.origin else { return }
                let dappArg = DappArg(url: origin, isUrlEnsured: nil, accountId: accountId)
                Api.tonConnect_disconnect(dapp: dappArg) { [weak self] res in
                    DispatchQueue.main.async {
                        switch res {
                        case .success(let success):
                            self?.injectTonConnectResult(invocationId: invocationId, result: success, error: nil)
                            DappsStore.updateDappCount()
                        case .failure(_):
                            self?.injectTonConnectResult(invocationId: invocationId, result: nil, error: "An error occured!")
                        }
                    }
                }
            case "send":
                guard let invocationId = dict["invocationId"] as? String else {
                    return
                }
                Task { [weak self] in
                    do {
                        let requests = try decodeWalletActionRequestsArray(args: dict["args"])
                        guard let accountId = AccountStore.account?.id, let origin = self?.config.url.origin else {
                            throw NilError()
                        }
                        
                        let request = try requests.first.orThrow() // only the first request is handled to match web version
                        
                        let response = try await Api.tonConnect_sendTransaction(
                            request: .init(url: origin, isUrlEnsured: nil, accountId: accountId, identifier: nil, sseOptions: nil),
                            message: .init(method: request.method.rawValue, params: request.params, id: request.id )
                        )
                        self?.injectTonConnectResult(invocationId: invocationId, result: [
                            "id": response.id,
                            "result": response.result
                        ], error: nil)
                        
                    } catch let error as Api.SendTransactionRpcResponseError {
                        self?.injectTonConnectResult(invocationId: invocationId, result: nil, error: TonConnectErrorCodes[error.error.code] ?? "Bad request")
                    } catch {
                        self?.injectTonConnectResult(invocationId: invocationId, result: nil, error: "Bad request")
                    }
                }
            default:
                break
            }
            break
        default:
            break
        }
    }
}
