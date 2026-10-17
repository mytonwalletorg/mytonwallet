package org.mytonwallet.app_air.uicomponents.diamond

import android.content.res.AssetManager
import android.graphics.Bitmap
import android.graphics.RectF
import android.opengl.GLES30.GL_ARRAY_BUFFER
import android.opengl.GLES30.GL_BLEND
import android.opengl.GLES30.GL_CLAMP_TO_EDGE
import android.opengl.GLES30.GL_COLOR_BUFFER_BIT
import android.opengl.GLES30.GL_COMPILE_STATUS
import android.opengl.GLES30.GL_CULL_FACE
import android.opengl.GLES30.GL_DEPTH_BUFFER_BIT
import android.opengl.GLES30.GL_DEPTH_TEST
import android.opengl.GLES30.GL_FLOAT
import android.opengl.GLES30.GL_FRAGMENT_SHADER
import android.opengl.GLES30.GL_LEQUAL
import android.opengl.GLES30.GL_LINEAR
import android.opengl.GLES30.GL_LINK_STATUS
import android.opengl.GLES30.GL_ONE
import android.opengl.GLES30.GL_ONE_MINUS_SRC_ALPHA
import android.opengl.GLES30.GL_STATIC_DRAW
import android.opengl.GLES30.GL_TEXTURE0
import android.opengl.GLES30.GL_TEXTURE_2D
import android.opengl.GLES30.GL_TEXTURE_MAG_FILTER
import android.opengl.GLES30.GL_TEXTURE_MIN_FILTER
import android.opengl.GLES30.GL_TEXTURE_WRAP_S
import android.opengl.GLES30.GL_TEXTURE_WRAP_T
import android.opengl.GLES30.GL_TRIANGLES
import android.opengl.GLES30.GL_VERTEX_SHADER
import android.opengl.GLES30.glActiveTexture
import android.opengl.GLES30.glAttachShader
import android.opengl.GLES30.glBindBuffer
import android.opengl.GLES30.glBindTexture
import android.opengl.GLES30.glBindVertexArray
import android.opengl.GLES30.glBlendFunc
import android.opengl.GLES30.glBufferData
import android.opengl.GLES30.glClear
import android.opengl.GLES30.glClearColor
import android.opengl.GLES30.glCompileShader
import android.opengl.GLES30.glCreateProgram
import android.opengl.GLES30.glCreateShader
import android.opengl.GLES30.glDeleteShader
import android.opengl.GLES30.glDeleteTextures
import android.opengl.GLES30.glDepthFunc
import android.opengl.GLES30.glDisable
import android.opengl.GLES30.glDrawArrays
import android.opengl.GLES30.glDrawArraysInstanced
import android.opengl.GLES30.glEnable
import android.opengl.GLES30.glEnableVertexAttribArray
import android.opengl.GLES30.glGenBuffers
import android.opengl.GLES30.glGenTextures
import android.opengl.GLES30.glGenVertexArrays
import android.opengl.GLES30.glGetProgramInfoLog
import android.opengl.GLES30.glGetProgramiv
import android.opengl.GLES30.glGetShaderInfoLog
import android.opengl.GLES30.glGetShaderiv
import android.opengl.GLES30.glGetUniformLocation
import android.opengl.GLES30.glLinkProgram
import android.opengl.GLES30.glShaderSource
import android.opengl.GLES30.glTexParameteri
import android.opengl.GLES30.glUniform1i
import android.opengl.GLES30.glUniform1ui
import android.opengl.GLES30.glUniform4f
import android.opengl.GLES30.glUniform4fv
import android.opengl.GLES30.glUniformMatrix4fv
import android.opengl.GLES30.glUseProgram
import android.opengl.GLES30.glVertexAttribPointer
import android.opengl.GLES30.glViewport
import android.opengl.GLUtils
import android.opengl.Matrix
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.acos
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.round
import kotlin.math.sin

internal class BlueDiamondScene(private val assets: AssetManager) {
    private val frames = loadFloats("frames")
    private val widths = loadFloats("widths")
    private val camera = loadFloats("camera")
    private val planes = loadFloats("planes")
    private val anchors = loadFloats("anchors")
    private val facetProjection = loadFloats("facetProjection")
    private val frame = FloatArray(42)
    private val model = FloatArray(16)
    private val inverseModel = FloatArray(16)
    private val projection = buildProjection()
    private val scaledProjection = FloatArray(16)
    private val horizontalScale = projection[0]
    private val diamondProgram = createProgram("diamond")
    private val sparkleProgram = createProgram("sparkle")
    private val diamondVertices = loadFloats("vertices")
    private val diamond = createMesh(diamondVertices, 3)
    private val lens = BlueDiamondLens(diamondVertices)
    private val lensProgram by lazy {
        val stone = readShader("diamondFragment").substringBefore("out vec4 fragColor;")
        createProgram("diamond", stone + readShader("diamondLens")).also(::setupProgram)
    }
    private val lensTransform = FloatArray(16)
    private var lensTexture = 0
    private val lensRect = RectF()
    private val mainSparkle = createMesh("main", 2)
    private val smallSparkles = createMesh("small", 2)
    private var lastYaw: Float? = null
    private var lastTilt: Float? = null

    init {
        require(frames.size == 1441 * 42 && widths.size == 91 && camera.size == 3)
        require(planes.size == 17 * 4 && anchors.size == 8 * 8 && facetProjection.size == 4)
        glClearColor(0f, 0f, 0f, 0f)
        glDepthFunc(GL_LEQUAL)
        glBlendFunc(GL_ONE, GL_ONE_MINUS_SRC_ALPHA)
        setupProgram(diamondProgram)
        setupProgram(sparkleProgram)
    }

    /** [rect] is the source's frame in points, relative to the canvas center. */
    fun setLensSource(mask: Bitmap?, rect: RectF) {
        if (lensTexture != 0) {
            glDeleteTextures(1, intArrayOf(lensTexture), 0)
            lensTexture = 0
        }
        lensRect.set(rect)
        mask ?: return
        lensProgram
        val texture = IntArray(1)
        glGenTextures(1, texture, 0)
        lensTexture = texture[0]
        glBindTexture(GL_TEXTURE_2D, lensTexture)
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR)
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR)
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE)
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE)
        GLUtils.texImage2D(GL_TEXTURE_2D, 0, mask, 0)
    }

    private fun setupProgram(program: Program) {
        glUseProgram(program.id)
        glUniform4f(program.uniform("u.appearance"), 0f, 0f, 0f, 0f)
        glUniform4fv(program.uniform("planes[0]"), 17, planes, 0)
        glUniform4fv(program.uniform("u.facetProjection"), 1, facetProjection, 0)
        for (i in 0 until 8) {
            glUniform4fv(program.uniform("anchors[$i].position"), 1, anchors, i * 8)
            glUniform4fv(program.uniform("anchors[$i].normal"), 1, anchors, i * 8 + 4)
        }
    }

    fun draw(
        size: Int,
        time: Float,
        frameTime: Float,
        yaw: Float,
        pitch: Float,
        scale: Float,
        lensStrength: Float,
        pixelsPerPoint: Float
    ) {
        val position = (time * 240) % 1440
        val index = position.toInt()
        val fraction = position - index
        for (i in frame.indices) {
            frame[i] = lerp(frames[index * 42 + i], frames[(index + 1) * 42 + i], fraction)
        }
        val tilt = pitch + camera[0]
        updateModel(tilt, yaw)
        val widthScale = getWidthScale(yaw, tilt)
        projection[0] = horizontalScale * widthScale
        for (i in projection.indices) {
            scaledProjection[i] = if (i % 4 < 2) projection[i] * scale else projection[i]
        }
        var anchor = 0f
        var maxFacing = -1f
        for (i in 0 until 4) {
            val angle = i * PI.toFloat() / 2
            val facing = cos(pitch) * cos(yaw + angle)
            if (facing > maxFacing) {
                maxFacing = facing
                anchor = angle
            }
        }
        val previousYaw = lastYaw
        val previousTilt = lastTilt
        val speed = if (previousYaw == null || previousTilt == null || frameTime <= 0) {
            0.596f
        } else {
            hypot(atan2(sin(yaw - previousYaw), cos(yaw - previousYaw)), tilt - previousTilt) /
                frameTime
        }
        lastYaw = yaw
        lastTilt = tilt
        val facingRatio = (
            1 - acos(
                maxFacing.coerceIn(-1f, 1f)
            ) / (PI.toFloat() / 15)
            ).coerceIn(0f, 1f)
        val calmRatio = (
            (
                PI.toFloat() * (2f / 15) / max(
                    speed,
                    0.001f
                ) - 0.06f
                ) / 0.34f
            ).coerceIn(0f, 1f)
        val visibility = smooth(calmRatio) * smooth(facingRatio)

        glViewport(0, 0, size, size)
        glClear(GL_COLOR_BUFFER_BIT or GL_DEPTH_BUFFER_BIT)
        val refractingProgram = if (lensTexture != 0 && lensStrength > 0.001f) {
            applyLens(size, yaw, lensStrength, pixelsPerPoint)
        } else {
            null
        }
        val stoneProgram = refractingProgram ?: diamondProgram
        applyUniforms(stoneProgram, size, time, anchor, widthScale, visibility)
        glDisable(GL_BLEND)
        glEnable(GL_DEPTH_TEST)
        glEnable(GL_CULL_FACE)
        glBindVertexArray(diamond.vao)
        glDrawArrays(GL_TRIANGLES, 0, diamond.count)
        applyUniforms(sparkleProgram, size, time, anchor, widthScale, visibility)
        glEnable(GL_BLEND)
        glDisable(GL_CULL_FACE)
        glDisable(GL_DEPTH_TEST)
        glBindVertexArray(mainSparkle.vao)
        glUniform1ui(sparkleProgram.uniform("baseInstance"), 0)
        glDrawArraysInstanced(GL_TRIANGLES, 0, mainSparkle.count, 1)
        glBindVertexArray(smallSparkles.vao)
        glUniform1ui(sparkleProgram.uniform("baseInstance"), 1)
        glDrawArraysInstanced(GL_TRIANGLES, 0, smallSparkles.count, 7)
    }

    private fun applyLens(size: Int, yaw: Float, strength: Float, pixelsPerPoint: Float): Program? {
        Matrix.multiplyMM(lensTransform, 0, scaledProjection, 0, model, 0)
        if (!lens.update(lensTransform, size / (2 * pixelsPerPoint))) return null
        val program = lensProgram
        glUseProgram(program.id)
        glUniform4f(
            program.uniform("lensRect"),
            lensRect.left,
            lensRect.top,
            lensRect.width(),
            lensRect.height()
        )
        glUniform4f(
            program.uniform("lensViewport"),
            size / 2f,
            size / 2f,
            pixelsPerPoint,
            lens.edgeCount.toFloat()
        )
        glUniform4f(program.uniform("lensParameters"), min(1f, strength), yaw, lens.radius, 0f)
        glUniform4f(program.uniform("lensCenter"), lens.centerX, lens.centerY, 1f, 0f)
        glUniform4fv(program.uniform("lensEdges[0]"), lens.edgeCount, lens.edges, 0)
        glActiveTexture(GL_TEXTURE0)
        glBindTexture(GL_TEXTURE_2D, lensTexture)
        glUniform1i(program.uniform("lensSource"), 0)
        return program
    }

    private fun updateModel(tilt: Float, turn: Float) {
        val sinTilt = sin(tilt)
        val cosTilt = cos(tilt)
        val sinTurn = sin(turn)
        val cosTurn = cos(turn)
        model[0] = cosTurn
        model[1] = sinTilt * sinTurn
        model[2] = -cosTilt * sinTurn
        model[5] = cosTilt
        model[6] = sinTilt
        model[8] = sinTurn
        model[9] = -sinTilt * cosTurn
        model[10] = cosTilt * cosTurn
        model[15] = 1f
        for (column in 0 until 4) {
            for (row in 0 until 4) inverseModel[column * 4 + row] = model[row * 4 + column]
        }
    }

    private fun applyUniforms(
        program: Program,
        size: Int,
        time: Float,
        anchor: Float,
        widthScale: Float,
        visibility: Float
    ) {
        glUseProgram(program.id)
        glUniform4f(program.uniform("u.viewport"), size.toFloat(), size.toFloat(), 17f, 0f)
        glUniformMatrix4fv(program.uniform("u.model"), 1, false, model, 0)
        glUniformMatrix4fv(program.uniform("u.inverseModel"), 1, false, inverseModel, 0)
        glUniformMatrix4fv(program.uniform("u.projection"), 1, false, scaledProjection, 0)
        glUniform4f(program.uniform("u.parameters"), time, 0.72f, 1f, 1f)
        glUniform4fv(program.uniform("u.sparkleShape"), 1, frame, 36)
        glUniform4f(program.uniform("u.sparkleHalo"), frame[40], anchor, widthScale, visibility)
        SWEEP_UNIFORMS.forEachIndexed { i, name ->
            glUniform4fv(program.uniform("u.$name"), 1, frame, i * 4)
        }
    }

    private fun buildProjection(): FloatArray {
        val scale = 1.52f * widths[0] / 0.9975f
        val depthScale = 1 / camera[2]
        val perspective = -depthScale / camera[1]
        val shift = 0.12f / scale
        return floatArrayOf(
            1 / scale, 0f, 0f, 0f,
            0f, 1 / scale, 0f, 0f,
            0f, shift * perspective, -depthScale / 6, perspective,
            0f, shift * depthScale, 0.5f * depthScale, depthScale
        )
    }

    private fun getWidthScale(yaw: Float, tilt: Float): Float {
        val quarterTurn = PI.toFloat() / 2
        val angle = abs(yaw - round(yaw / quarterTurn) * quarterTurn)
        val position = min(90f, angle * (360 / PI.toFloat()))
        val index = min(89, position.toInt())
        val t = position - index
        val from = widths[index]
        val to = widths[index + 1]
        val fromSlope = if (index == 0) 0f else (to - widths[index - 1]) / 2
        val toSlope = if (index + 2 >= widths.size) 0f else (widths[index + 2] - from) / 2
        val width =
            (
                (
                    ((from - to) * 2 + fromSlope + toSlope) * t +
                        ((to - from) * 3 - fromSlope * 2 - toSlope)
                    ) *
                    t +
                    fromSlope
                ) *
                t +
                from
        val targetWidth = (1 - 0.035f * sin(2 * angle).pow(2)) * widths[0]
        val fade =
            smooth(((abs(sin(tilt)) - sin(0.25f)) / (sin(0.96f) - sin(0.25f))).coerceIn(0f, 1f))
        return 1 + (1 - fade) * (targetWidth / width - 1)
    }

    private fun loadFloats(name: String): FloatArray {
        val bytes = assets.open("blue_diamond/models/$name.bin").use { it.readBytes() }
        val buffer = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN).asFloatBuffer()
        return FloatArray(buffer.remaining()).also { buffer.get(it) }
    }

    private fun readShader(name: String): String =
        assets.open("blue_diamond/shaders/$name.glsl").bufferedReader().use { it.readText() }

    private fun createProgram(name: String, fragmentSource: String? = null): Program {
        val program = glCreateProgram()
        for ((suffix, type) in listOf(
            "Vertex" to GL_VERTEX_SHADER,
            "Fragment" to GL_FRAGMENT_SHADER
        )) {
            val shader = glCreateShader(type)
            val source = if (type == GL_FRAGMENT_SHADER && fragmentSource != null) {
                fragmentSource
            } else {
                readShader("$name$suffix")
            }
            glShaderSource(shader, source)
            glCompileShader(shader)
            val status = IntArray(1)
            glGetShaderiv(shader, GL_COMPILE_STATUS, status, 0)
            check(status[0] != 0) { glGetShaderInfoLog(shader) }
            glAttachShader(program, shader)
            glDeleteShader(shader)
        }
        glLinkProgram(program)
        val status = IntArray(1)
        glGetProgramiv(program, GL_LINK_STATUS, status, 0)
        check(status[0] != 0) { glGetProgramInfoLog(program) }
        return Program(program)
    }

    private fun createMesh(name: String, attributeCount: Int): Mesh =
        createMesh(loadFloats(name), attributeCount)

    private fun createMesh(values: FloatArray, attributeCount: Int): Mesh {
        val data = ByteBuffer.allocateDirect(
            values.size * 4
        ).order(ByteOrder.nativeOrder()).asFloatBuffer()
        data.put(values).position(0)
        val vao = IntArray(1)
        val buffer = IntArray(1)
        glGenVertexArrays(1, vao, 0)
        glBindVertexArray(vao[0])
        glGenBuffers(1, buffer, 0)
        glBindBuffer(GL_ARRAY_BUFFER, buffer[0])
        glBufferData(GL_ARRAY_BUFFER, values.size * 4, data, GL_STATIC_DRAW)
        for (i in 0 until attributeCount) {
            glEnableVertexAttribArray(i)
            glVertexAttribPointer(i, 4, GL_FLOAT, false, attributeCount * 16, i * 16)
        }
        return Mesh(vao[0], values.size / (attributeCount * 4))
    }

    private class Program(val id: Int) {
        private val uniforms = HashMap<String, Int>()
        fun uniform(name: String): Int = uniforms.getOrPut(name) { glGetUniformLocation(id, name) }
    }

    private class Mesh(val vao: Int, val count: Int)

    private companion object {
        val SWEEP_UNIFORMS = listOf(
            "crownGradient",
            "pavilionGradient",
            "lightSweep",
            "crownSweep",
            "rightCrownSweep",
            "leftCrownSweep",
            "pavilionSweep",
            "rightPavilionSweep",
            "leftPavilionSweep"
        )
        fun lerp(from: Float, to: Float, t: Float) = from + (to - from) * t
        fun smooth(x: Float) = x * x * (3 - 2 * x)
    }
}
