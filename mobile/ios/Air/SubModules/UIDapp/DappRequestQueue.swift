import Foundation

/// Handles dApp request events one at a time, in the order they arrived, and only while they can be shown.
///
/// A handler that awaits (an account switch, a sheet dismissal) finishes before the next event starts, so two events
/// can never interleave and leave the wrong sheet on screen. An event queued before `invalidate()`, or one whose
/// account no longer exists, is discarded instead of handled.
///
/// A handler checks `status` before any UI work that follows a suspension. A stale event is rejected; a held one is
/// returned as `.held` and runs again, first in line, after the next `open()`.
///
/// Events wait while the queue is closed. An open queue closes itself when `isReady` turns false (the app locked
/// again) and waits for the next `open()`; while `isBusy` reports a presentation in flight it re-checks shortly.
@MainActor
final class DappRequestQueue<Item> {
    private struct Entry {
        let item: Item
        let epoch: Int
    }

    private var entries: [Entry] = []
    private var epoch = 0
    private var isDraining = false
    private var isOpen: Bool
    private var openWaiter: CheckedContinuation<Void, Never>?

    private let handle: @MainActor (Item, _ status: @escaping @MainActor () -> DappRequestStatus) async -> DappRequestOutcome
    private let discard: @MainActor (Item) -> Void
    private let isStale: @MainActor (Item) -> Bool
    private let isReady: @MainActor () -> Bool
    private let isBusy: @MainActor () -> Bool
    private let watchdog: Duration
    private let recheckInterval: Duration

    init(
        isOpen: Bool,
        watchdog: Duration = .seconds(10),
        recheckInterval: Duration = .milliseconds(250),
        isReady: @escaping @MainActor () -> Bool = { true },
        isBusy: @escaping @MainActor () -> Bool = { false },
        handle: @escaping @MainActor (Item, _ status: @escaping @MainActor () -> DappRequestStatus) async -> DappRequestOutcome,
        discard: @escaping @MainActor (Item) -> Void,
        isStale: @escaping @MainActor (Item) -> Bool
    ) {
        self.isOpen = isOpen
        self.watchdog = watchdog
        self.recheckInterval = recheckInterval
        self.isReady = isReady
        self.isBusy = isBusy
        self.handle = handle
        self.discard = discard
        self.isStale = isStale
    }

    var count: Int { entries.count }

    func enqueue(_ item: Item) {
        entries.append(Entry(item: item, epoch: epoch))
        drainIfNeeded()
    }

    /// Discards every event queued so far, as each one reaches the front.
    func invalidate() {
        epoch += 1
    }

    func open() {
        isOpen = true
        openWaiter?.resume()
        openWaiter = nil
        drainIfNeeded()
    }

    /// Holds events until the next `open()`, or discards the queued ones and makes the one being handled stale.
    func close(discardingQueued: Bool) {
        isOpen = false
        guard discardingQueued else { return }
        invalidate()
        let queued = entries
        entries.removeAll()
        for entry in queued {
            discard(entry.item)
        }
    }

    private func drainIfNeeded() {
        guard !isDraining, !entries.isEmpty else { return }
        isDraining = true
        Task {
            await drain()
        }
    }

    private func drain() async {
        defer { isDraining = false }
        while !entries.isEmpty {
            await waitUntilOpen()
            guard !entries.isEmpty else { return }
            let entry = entries.removeFirst()
            if entry.epoch != epoch || isStale(entry.item) {
                discard(entry.item)
                continue
            }
            let outcome = await runWithWatchdog(entry.item) { [weak self] in
                self?.status(of: entry) ?? .stale
            }
            if outcome == .held {
                entries.insert(entry, at: 0)
                isOpen = false
            }
        }
    }

    private func status(of entry: Entry) -> DappRequestStatus {
        if Task.isCancelled || entry.epoch != epoch {
            return .stale
        }
        if !isOpen || !isReady() {
            return .held
        }
        return .current
    }

    private func waitUntilOpen() async {
        while true {
            if !isOpen {
                await withCheckedContinuation { continuation in
                    openWaiter = continuation
                }
            } else if !isReady() {
                isOpen = false
            } else if isBusy() {
                try? await Task.sleep(for: recheckInterval)
            } else {
                return
            }
        }
    }

    /// A handler that never returns (a bridge call that hangs) must not stall every request after it.
    private func runWithWatchdog(
        _ item: Item,
        status: @escaping @MainActor () -> DappRequestStatus
    ) async -> DappRequestOutcome {
        await withCheckedContinuation { (continuation: CheckedContinuation<DappRequestOutcome, Never>) in
            let once = ResumeOnce(continuation)
            let handlerTask = Task {
                once.resume(returning: await handle(item, status))
            }
            Task {
                try? await Task.sleep(for: watchdog)
                // From here on the handler would run beside the next event, so it stops at its next check
                handlerTask.cancel()
                once.resume(returning: .done)
            }
        }
    }
}

/// What a handler finds when it checks its event after a suspension.
enum DappRequestStatus {
    case current
    /// The queue was invalidated or the watchdog stopped waiting for the handler: reject the request
    case stale
    /// The app locked or the queue closed: return `.held` instead of showing anything
    case held
}

enum DappRequestOutcome {
    case done
    /// Runs the event again, first in line, after the next `open()`
    case held
}

/// Resumes a continuation the first time it is called, and ignores every later call.
@MainActor
final class ResumeOnce<Value: Sendable> {
    private var continuation: CheckedContinuation<Value, Never>?

    init(_ continuation: CheckedContinuation<Value, Never>) {
        self.continuation = continuation
    }

    func resume(returning value: Value) {
        continuation?.resume(returning: value)
        continuation = nil
    }
}

extension ResumeOnce where Value == Void {
    func resume() {
        resume(returning: ())
    }
}
