import Combine
import MetalKit
import SwiftUI

/// For headers drawn behind a paging/scrolling layer. Only the stone claims touches.
public final class TelegramReceiveDiamondTouchView: UIView {
    public weak var sourceView: UIView?

    public override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        guard isUserInteractionEnabled, !isHidden, alpha > 0.01, let sourceView else { return nil }
        // SwiftUI's hosting hit regions do not track an MTKView's expanding canvas.
        // Resolve the native QR container, whose hit area stays centered at 64 points.
        func target(in view: UIView) -> UIView? {
            guard !view.isHidden, view.alpha > 0.01 else { return nil }
            if let qr = view as? TelegramReceiveQRContainerView {
                return qr.hitTest(qr.convert(point, from: self), with: event)
            }
            for child in view.subviews.reversed() {
                if let hit = target(in: child) { return hit }
            }
            return nil
        }
        return target(in: sourceView)
    }
}

/// Telegram's receive QR, including the stone's centered expansion and QR lens.
public struct TelegramReceiveQRCodeView: View {
    @ObservedObject private var environment = CardBackgroundAnimationEnvironment.shared
    @State private var visible = false
    private let address: String
    private let renderingEnabled: Bool

    public init(address: String, renderingEnabled: Bool = true) {
        self.address = address
        self.renderingEnabled = renderingEnabled
    }

    public var body: some View {
        ReceiveQRRepresentable(address: address, active: visible && renderingEnabled && environment.applicationActive,
            animated: environment.diamondAnimationsEnabled)
            .onAppear { visible = true }
            .onDisappear { visible = false }
    }
}

private struct ReceiveQRRepresentable: UIViewRepresentable {
    let address: String
    let active: Bool
    let animated: Bool

    func makeUIView(context: Context) -> TelegramReceiveQRContainerView {
        TelegramReceiveQRContainerView()
    }

    func updateUIView(_ view: TelegramReceiveQRContainerView, context: Context) {
        view.configure(address: address, active: active, animated: animated)
    }

    static func dismantleUIView(_ view: TelegramReceiveQRContainerView, coordinator: ()) {
        view.configure(address: view.address, active: false)
    }
}

final class TelegramReceiveQRContainerView: UIView {
    private let imageView = UIImageView()
    private let diamond = TelegramDiamondMetalView(diamond: ())
    private var generator: ((TransformImageArguments) -> DrawingContext?)?
    private var moduleCount = 0
    private var imageSize = CGSize.zero
    private(set) var address = ""
    private var active = false

    init() {
        super.init(frame: .zero)
        backgroundColor = .white
        imageView.isUserInteractionEnabled = false
        addSubview(imageView)
        if let diamond {
            addSubview(diamond)
            diamond.accessibilityIdentifier = "receive.telegramDiamond"
            diamond.refractionRect = { [weak self, weak diamond] in
                guard let self, let diamond else { return .zero }
                return self.imageView.convert(self.imageView.bounds, to: diamond)
                    .offsetBy(dx: -diamond.bounds.midX, dy: -diamond.bounds.midY)
            }
        }
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func configure(address: String, active: Bool, animated: Bool = true) {
        if self.address != address {
            self.address = address
            imageSize = .zero
            if let (count, generator) = generateQrCode(string: "ton://transfer/\(address)", color: .black,
                backgroundColor: .white, icon: .cutout, ecl: "Q") {
                moduleCount = count
                self.generator = generator
            }
            setNeedsLayout()
        }
        self.active = active
        diamond?.configure(active: active, animated: animated)
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        let side = min(bounds.width, bounds.height)
        let inset = min(6, max(0, (side - 1) / 2))
        let size = CGSize(width: max(1, side - inset * 2), height: max(1, side - inset * 2))
        if imageSize != size {
            imageSize = size
            imageView.image = generator?(TransformImageArguments(corners: ImageCorners(), imageSize: size,
                boundingSize: size, intrinsicInsets: .zero))?.generateImage()
            diamond?.setRefractionImage(imageView.image)
        }
        imageView.frame = CGRect(origin: CGPoint(x: inset, y: inset), size: size)
        if moduleCount > 0 {
            let (_, cutout, _) = qrCodeCutout(size: moduleCount, dimensions: size, scale: nil)
            diamond?.setRestingFrame(cutout.offsetBy(dx: inset, dy: inset), width: cutout.width * 0.9)
        }
    }

    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        guard active, isUserInteractionEnabled, !isHidden, alpha > 0.01, let diamond else { return nil }
        return diamond.hitTest(diamond.convert(point, from: self), with: event)
    }
}
