import Testing
@testable import UIDapp

@MainActor
@Suite("Dapp Request Queue")
struct DappRequestQueueTests {
    @Test
    func `handles events one at a time in arrival order`() async {
        let recorder = Recorder()
        let firstHandlerRelease = Gate()
        let queue = makeQueue(recorder: recorder, handle: { item, _ in
            recorder.log.append("start \(item)")
            if item == 1 {
                await firstHandlerRelease.wait()
            }
            recorder.log.append("end \(item)")
            return .done
        })

        queue.enqueue(1)
        queue.enqueue(2)
        await waitUntil { recorder.log == ["start 1"] }
        #expect(recorder.log == ["start 1"])

        firstHandlerRelease.open()
        await waitUntil { recorder.log.count == 4 }
        #expect(recorder.log == ["start 1", "end 1", "start 2", "end 2"])
    }

    @Test
    func `moves on when a handler never finishes`() async {
        let recorder = Recorder()
        let stuckHandlerRelease = Gate()
        let queue = makeQueue(recorder: recorder, watchdog: .milliseconds(50), handle: { item, _ in
            recorder.log.append("start \(item)")
            if item == 1 {
                await stuckHandlerRelease.wait()
            }
            return .done
        })

        queue.enqueue(1)
        queue.enqueue(2)
        await waitUntil { recorder.log.count == 2 }

        #expect(recorder.log == ["start 1", "start 2"])
        stuckHandlerRelease.open()
    }

    @Test
    func `holds events while closed and handles them once opened`() async {
        let recorder = Recorder()
        let queue = makeQueue(recorder: recorder, isOpen: false)

        queue.enqueue(1)
        try? await Task.sleep(for: .milliseconds(20))
        #expect(recorder.handled.isEmpty)

        queue.open()
        await waitUntil { recorder.handled == [1] }
        #expect(recorder.handled == [1])
    }

    @Test
    func `discards events queued before invalidation`() async {
        let recorder = Recorder()
        let queue = makeQueue(recorder: recorder, isOpen: false)

        queue.enqueue(1)
        queue.invalidate()
        queue.enqueue(2)
        queue.open()
        await waitUntil { recorder.handled == [2] }

        #expect(recorder.handled == [2])
        #expect(recorder.discarded == [1])
    }

    @Test
    func `discards an event whose account is gone`() async {
        let recorder = Recorder()
        let queue = makeQueue(recorder: recorder, isStale: { $0 == 1 })

        queue.enqueue(1)
        queue.enqueue(2)
        await waitUntil { recorder.handled == [2] }

        #expect(recorder.discarded == [1])
    }

    @Test
    func `closing with discard drops everything queued`() async {
        let recorder = Recorder()
        let queue = makeQueue(recorder: recorder, isOpen: false)

        queue.enqueue(1)
        queue.enqueue(2)
        queue.close(discardingQueued: true)
        queue.open()
        try? await Task.sleep(for: .milliseconds(20))

        #expect(recorder.handled.isEmpty)
        #expect(recorder.discarded == [1, 2])
    }

    @Test
    func `waits for the next open after it stops being ready`() async {
        let recorder = Recorder()
        let readiness = Flag(value: false)
        let queue = makeQueue(recorder: recorder, isReady: { readiness.value })

        queue.enqueue(1)
        try? await Task.sleep(for: .milliseconds(20))
        readiness.value = true
        try? await Task.sleep(for: .milliseconds(20))
        // Being ready again is not enough: the queue closed itself and waits for the unlock to reopen it
        #expect(recorder.handled.isEmpty)

        queue.open()
        await waitUntil { recorder.handled == [1] }
        #expect(recorder.handled == [1])
    }

    @Test
    func `waits while a presentation is in flight`() async {
        let recorder = Recorder()
        let presentation = Flag(value: true)
        let queue = makeQueue(recorder: recorder, isBusy: { presentation.value })

        queue.enqueue(1)
        try? await Task.sleep(for: .milliseconds(30))
        #expect(recorder.handled.isEmpty)

        presentation.value = false
        await waitUntil { recorder.handled == [1] }
        #expect(recorder.handled == [1])
    }

    @Test
    func `tells a handler its event went stale when the queue is invalidated`() async {
        let recorder = Recorder()
        let release = Gate()
        let queue = makeQueue(recorder: recorder, handle: { _, status in
            await release.wait()
            recorder.log.append("\(status())")
            return .done
        })

        queue.enqueue(1)
        await waitUntil { recorder.handled == [1] }
        queue.invalidate()
        release.open()
        await waitUntil { !recorder.log.isEmpty }

        #expect(recorder.log == ["stale"])
    }

    @Test
    func `tells a handler the watchdog stopped waiting for it`() async {
        let recorder = Recorder()
        let release = Gate()
        let queue = makeQueue(recorder: recorder, watchdog: .milliseconds(30), handle: { item, status in
            guard item == 1 else { return .done }
            await release.wait()
            recorder.log.append("\(status())")
            return .done
        })

        queue.enqueue(1)
        queue.enqueue(2)
        await waitUntil { recorder.handled == [1, 2] }
        release.open()
        await waitUntil { !recorder.log.isEmpty }

        #expect(recorder.log == ["stale"])
    }

    @Test
    func `tells a handler its event went stale when closing with discard`() async {
        let recorder = Recorder()
        let release = Gate()
        let queue = makeQueue(recorder: recorder, handle: { _, status in
            await release.wait()
            recorder.log.append("\(status())")
            return .done
        })

        queue.enqueue(1)
        await waitUntil { recorder.handled == [1] }
        queue.close(discardingQueued: true)
        release.open()
        await waitUntil { !recorder.log.isEmpty }

        #expect(recorder.log == ["stale"])
    }

    @Test
    func `runs a held event again first after the next open`() async {
        let recorder = Recorder()
        let readiness = Flag(value: true)
        let release = Gate()
        let queue = makeQueue(recorder: recorder, isReady: { readiness.value }, handle: { item, status in
            if item == 1 {
                await release.wait()
            }
            let itemStatus = status()
            recorder.log.append("\(item) \(itemStatus)")
            return itemStatus == .held ? .held : .done
        })

        queue.enqueue(1)
        queue.enqueue(2)
        await waitUntil { recorder.handled == [1] }
        // The app locks while the handler awaits
        readiness.value = false
        release.open()
        await waitUntil { !recorder.log.isEmpty }
        try? await Task.sleep(for: .milliseconds(20))
        #expect(recorder.log == ["1 held"])

        readiness.value = true
        queue.open()
        await waitUntil { recorder.log.count == 3 }
        #expect(recorder.log == ["1 held", "1 current", "2 current"])
        #expect(recorder.discarded.isEmpty)
    }

    private func makeQueue(
        recorder: Recorder,
        isOpen: Bool = true,
        watchdog: Duration = .seconds(10),
        isReady: @escaping @MainActor () -> Bool = { true },
        isBusy: @escaping @MainActor () -> Bool = { false },
        isStale: @escaping @MainActor (Int) -> Bool = { _ in false },
        handle: (@MainActor (Int, @escaping @MainActor () -> DappRequestStatus) async -> DappRequestOutcome)? = nil
    ) -> DappRequestQueue<Int> {
        DappRequestQueue<Int>(
            isOpen: isOpen,
            watchdog: watchdog,
            recheckInterval: .milliseconds(5),
            isReady: isReady,
            isBusy: isBusy,
            handle: { item, status in
                recorder.handled.append(item)
                return await handle?(item, status) ?? .done
            },
            discard: { item in
                recorder.discarded.append(item)
            },
            isStale: isStale
        )
    }
}

@MainActor
private final class Recorder {
    var handled: [Int] = []
    var discarded: [Int] = []
    var log: [String] = []
}

@MainActor
private final class Flag {
    var value: Bool

    init(value: Bool) {
        self.value = value
    }
}

@MainActor
private final class Gate {
    private var isOpen = false
    private var waiters: [CheckedContinuation<Void, Never>] = []

    func wait() async {
        guard !isOpen else { return }
        await withCheckedContinuation { waiters.append($0) }
    }

    func open() {
        isOpen = true
        waiters.forEach { $0.resume() }
        waiters.removeAll()
    }
}

@MainActor
private func waitUntil(_ condition: @MainActor () -> Bool) async {
    for _ in 0..<200 where !condition() {
        try? await Task.sleep(for: .milliseconds(5))
    }
}
