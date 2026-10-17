// Ported from Telegram-iOS f1dd7a2dbd, PremiumDiamondComponent.
import UIKit
import Metal

struct DiamondStyle: Equatable {
    typealias Appearance = InteractiveDiamondComponent.Appearance
    var appearance: Appearance = .blue
    enum AnimationMode: String, CaseIterable, Sendable {
        case continuous
        case reference
        case entrance
    }
    var animationMode: AnimationMode = .entrance
    var referenceAnimationLoops: Bool = true
    var animateOnAppear: Bool = false
    var rotationSpeed: Float = 2 * .pi / 18 * 1.70775
    var isRotating: Bool = true
    var sparkles: Bool = true
    var mainSparkleOnRotation: Bool = false
    var backgroundStars: Bool = true
    var widthCompensation: Bool = true
    var refraction: Float = 0.72
    var brightness: Float = 1
    var zoom: Float = 0.72
    var whiten: Float = 0
    var swayScale: Float = 0
    var floatAmplitude: Float = 0
    var floatPeriod: Float = 3.2
    var tilt: Float = 0
    var lean: Float = 0
    var releaseDecay: Float = 0
    var releaseTilt: Float = 0
    var tapToSpin: Bool = false
    var dragGrow: Float = 1
    var growShift: Float = 0
    var verticalOffset: Float = 0
    var growDamping: Float = 0.42
    var widthPoints: Float = 0
    var starOpacity: Float = 1
    var starZoom: Float = 1
    var starReferenceSize: Float = 0 // Fixed shorter canvas side in points; zero follows the canvas.
    var starEmission: Float = 1
    var rightwardStars: Bool = false
    var burstSize: Float = 1
    var burstFadeInDuration: Float = 0.5
    var steadyStars: Bool = true
    init() {}
}

struct DiamondPose {
    let yaw: Float
    let pitch: Float
    let grow: Float
    let shift: Float
}

enum InteractiveDiamondComponent {
    enum Appearance: UInt32, CaseIterable, Sendable {
        case blue = 0
        case white = 1
        case cool = 2
    }
    struct RefractionGeometry {
        var center: CGPoint
        var hull: [CGPoint]
        let strength: CGFloat
        let rotation: Float
    }
    struct RefractionSource {
        let texture: MTLTexture
        let uv: SIMD4<Float>
        let rect: CGRect
        let preservesColors: Bool
    }
}
