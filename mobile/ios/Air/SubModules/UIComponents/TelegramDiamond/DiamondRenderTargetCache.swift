import Metal

/// MetalKit can keep the previous drawable during a canvas resize. Build every
/// attachment from that drawable, rather than from the requested drawableSize.
final class DiamondRenderTargetCache {
    private struct Targets {
        let width: Int
        let height: Int
        let pixelFormat: MTLPixelFormat
        let sampleCount: Int
        let multisampleColor: MTLTexture?
        let depth: MTLTexture

        init?(resolving texture: MTLTexture, sampleCount: Int) {
            width = texture.width
            height = texture.height
            pixelFormat = texture.pixelFormat
            self.sampleCount = sampleCount
            guard width > 0, height > 0 else { return nil }
            let descriptor = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: pixelFormat,
                width: width, height: height, mipmapped: false)
            descriptor.storageMode = .private
            descriptor.usage = .renderTarget
            descriptor.sampleCount = sampleCount
            if sampleCount > 1 {
                descriptor.textureType = .type2DMultisample
                guard let color = texture.device.makeTexture(descriptor: descriptor) else { return nil }
                multisampleColor = color
            } else {
                multisampleColor = nil
            }
            descriptor.pixelFormat = .depth32Float
            guard let depth = texture.device.makeTexture(descriptor: descriptor) else { return nil }
            self.depth = depth
        }

        func matches(_ texture: MTLTexture, sampleCount: Int) -> Bool {
            width == texture.width && height == texture.height && pixelFormat == texture.pixelFormat
                && self.sampleCount == sampleCount && depth.device === texture.device
        }
    }

    private var targets: Targets?

    func renderPass(resolving texture: MTLTexture, sampleCount: Int) -> MTLRenderPassDescriptor? {
        if targets?.matches(texture, sampleCount: sampleCount) != true {
            targets = Targets(resolving: texture, sampleCount: sampleCount)
        }
        guard let targets else { return nil }
        let pass = MTLRenderPassDescriptor()
        pass.colorAttachments[0].texture = targets.multisampleColor ?? texture
        pass.colorAttachments[0].loadAction = .clear
        pass.colorAttachments[0].clearColor = MTLClearColorMake(0, 0, 0, 0)
        if targets.multisampleColor != nil {
            pass.colorAttachments[0].resolveTexture = texture
            pass.colorAttachments[0].storeAction = .multisampleResolve
        } else {
            pass.colorAttachments[0].storeAction = .store
        }
        pass.depthAttachment.texture = targets.depth
        pass.depthAttachment.loadAction = .clear
        pass.depthAttachment.storeAction = .dontCare
        pass.depthAttachment.clearDepth = 1
        return pass
    }

    func clear() {
        targets = nil
    }
}
