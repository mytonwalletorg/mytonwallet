import Foundation
import WebKit
import WalletContext

extension TonConnectTrace {

    #if DEBUG
    /// Wraps the SDK page's `EventSource`, which carries the TON Connect SSE bridge, so the connection reports its
    /// creation, opening, errors, incoming messages and closing. `console.error` does not reach native, so the tags of
    /// SDK errors about TON Connect are repeated as well. Each report is a console line starting with `consoleLinePrefix`.
    @MainActor static var sdkPageUserScript: WKUserScript {
        WKUserScript(source: sdkPageScriptSource, injectionTime: .atDocumentStart, forMainFrameOnly: true)
    }

    private static let sdkPageScriptSource = """
        (() => {
            const trace = (line) => console.log('\(consoleLinePrefix)' + line);

            const NativeEventSource = window.EventSource;
            if (typeof NativeEventSource === 'function') {
                const STATES = ['connecting', 'open', 'closed'];
                let lastId = 0;
                window.EventSource = class extends NativeEventSource {
                    #id = ++lastId;

                    constructor(url, init) {
                        super(url, init);
                        let target = '<unparsed url>';
                        try {
                            const parsed = new URL(String(url), location.href);
                            const clients = (parsed.searchParams.get('client_id') || '').split(',').filter(Boolean).length;
                            const lastEventId = parsed.searchParams.get('last_event_id') || 'none';
                            target = `${parsed.host}${parsed.pathname} clients=${clients} last_event_id=${lastEventId}`;
                        } catch {}
                        trace(`sse#${this.#id} create ${target}`);
                        this.addEventListener('open', () => trace(`sse#${this.#id} open`));
                        this.addEventListener('error', () => trace(`sse#${this.#id} error readyState=${STATES[this.readyState]}`));
                        this.addEventListener('message', (event) => {
                            let from = '?';
                            try {
                                from = `${String(JSON.parse(event.data).from).slice(0, 8)}…`;
                            } catch {}
                            const eventId = event.lastEventId || 'none';
                            trace(`sse#${this.#id} message event_id=${eventId} from=${from} length=${String(event.data).length}`);
                        });
                    }

                    close() {
                        trace(`sse#${this.#id} close readyState=${STATES[this.readyState]}`);
                        super.close();
                    }
                };
            }

            // Only the log tag and error names leave the page: the other arguments can carry request or signing data
            const nativeConsoleError = console.error;
            console.error = function (...args) {
                const [tag] = args;
                if (typeof tag === 'string' && /tonConnect|DappProtocolManager/.test(tag)) {
                    const errorNames = args.filter((arg) => arg instanceof Error).map((error) => error.name);
                    trace(`sdk error ${tag}${errorNames.length ? ` ${errorNames.join(' ')}` : ''}`);
                }
                return nativeConsoleError.apply(this, args);
            };
        })();
        """

    private static let updateTypes: Set<String> = [
        "dappLoading",
        "dappCloseLoading",
        "dappConnect",
        "dappConnectComplete",
        "dappSendTransactions",
        "dappSignData",
        "dappTransferComplete",
        "dappSignDataComplete",
        "dappRequestSettled",
        "dappAlreadyConnected",
        "dappDisconnected",
        "dappDisconnect",
        "updateDapps",
        "tonConnectOnline",
        "showError",
        "openUrl",
    ]
    private static let updateSummaryKeys = [
        "connectionType",
        "isSse",
        "isWaitingForRequest",
        "accountId",
        "promiseId",
        "returnStrategy",
        "url",
        "isExternal",
        "error",
    ]

    private static func describe(_ value: Any, key: String) -> String {
        if let number = value as? NSNumber, CFGetTypeID(number) == CFBooleanGetTypeID() {
            return number.boolValue ? "true" : "false"
        }
        // These carry the dApp's return URL
        if key == "url" || key == "returnStrategy", let target = value as? String {
            return describeReturnTarget(target)
        }
        return String(describing: value)
    }
    #endif

    /// Records an SDK update that drives the dApp request UI, without its request payload.
    static func recordUpdate(type: String, data: [String: Any]) {
        #if DEBUG
        guard updateTypes.contains(type) else { return }
        var parts = ["onUpdate \(type)"]
        for key in updateSummaryKeys {
            if let value = data[key] {
                parts.append("\(key)=\(describe(value, key: key))")
            }
        }
        if let dappUrl = (data["dapp"] as? [String: Any])?["url"] as? String {
            parts.append("dapp=\(describeURL(dappUrl))")
        }
        if let transactions = data["transactions"] as? [Any] {
            parts.append("transactions=\(transactions.count)")
        }
        record(parts.joined(separator: " "))
        #endif
    }
}
