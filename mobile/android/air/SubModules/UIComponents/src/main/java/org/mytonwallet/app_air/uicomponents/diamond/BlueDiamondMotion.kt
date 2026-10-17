package org.mytonwallet.app_air.uicomponents.diamond

import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.exp
import kotlin.math.sin
import kotlin.random.Random

internal class BlueDiamondMotion {
    var yaw = 0f
        private set
    var pitch = 0f
        private set
    private var animationStart = 0f
    private var fromYaw = 0f
    private var fromPitch = 0f
    private var toYaw = 0f
    private var toPitch = 0f
    private var phase = Phase.IDLE
    private var spinVelocity = 0f
    private var isPressed = false
    var grip = 0f
        private set
    private var gripFrom = 0f
    private var gripStart = 0f
    private var isGripAnimating = false

    fun update(time: Float) {
        updateGrip(time)
        val elapsed = (time - animationStart).coerceAtLeast(0f)
        when (phase) {
            Phase.IDLE -> if (!isPressed && time >= 0.5f) {
                yaw =
                    fromYaw + 2 * PI.toFloat() * (((elapsed - 0.5f).coerceAtLeast(0f) / 10.54f) % 1)
            }

            Phase.TAP -> {
                val progress = (elapsed / 0.22f).coerceAtMost(1f)
                val shifted = progress - 1
                val ratio = 1 + shifted * shifted * shifted * shifted * shifted
                yaw = fromYaw + (toYaw - fromYaw) * ratio
                pitch = fromPitch + (toPitch - fromPitch) * ratio
                if (progress == 1f) release(time)
            }

            Phase.RELEASE -> {
                val progress = (elapsed / 0.6f).coerceAtMost(1f)
                val shifted = progress - 1
                val ratio = -shifted * shifted * (3 * shifted + 2)
                yaw = fromYaw * ratio
                pitch = fromPitch * ratio
                if (progress == 1f) {
                    phase = Phase.IDLE
                    fromYaw = yaw
                    animationStart = time - 0.5f
                }
            }

            Phase.SPIN -> {
                val fade = exp(-elapsed / SPIN_DECAY)
                yaw = fromYaw + spinVelocity * SPIN_DECAY * (1 - fade)
                val progress = (elapsed / 0.6f).coerceAtMost(1f)
                val shifted = progress - 1
                pitch = fromPitch * -shifted * shifted * (3 * shifted + 2)
                if (progress == 1f && abs(spinVelocity * fade) <= IDLE_SPEED) {
                    yaw = atan2(sin(yaw), cos(yaw))
                    phase = Phase.IDLE
                    fromYaw = yaw
                    animationStart = time - 0.5f
                }
            }

            Phase.DRAG -> Unit
        }
    }

    fun press(time: Float) {
        setHolding(true, time)
        isPressed = true
        phase = Phase.DRAG
    }

    fun drag(dx: Float, dy: Float) {
        yaw += dx * 0.5f * PI.toFloat() / 180
        pitch += dy * 0.05f * PI.toFloat() / 180
    }

    fun release(
        time: Float,
        tapX: Float? = null,
        tapY: Float? = null,
        flingDirection: Float? = null
    ) {
        setHolding(false, time)
        isPressed = false
        fromYaw = yaw
        fromPitch = pitch
        animationStart = time
        if (flingDirection != null) {
            spinVelocity = flingDirection * FLING_IMPULSE
            phase = Phase.SPIN
        } else if (tapX != null && tapY != null && abs(yaw) <= 10 * PI.toFloat() / 180) {
            toYaw = tapX * (40 + Random.nextFloat() * 30) * PI.toFloat() / 180
            toPitch = tapY * (40 + Random.nextFloat() * 30) * PI.toFloat() / 180
            phase = Phase.TAP
        } else {
            phase = Phase.RELEASE
        }
    }

    private fun setHolding(holding: Boolean, time: Float) {
        if (isPressed == holding) return
        updateGrip(time)
        gripFrom = grip
        gripStart = time
        isGripAnimating = true
    }

    private fun updateGrip(time: Float) {
        if (!isGripAnimating) return
        val elapsed = (time - gripStart).coerceAtLeast(0f)
        if (isPressed) {
            val t = (elapsed / 0.46f).coerceAtMost(1f)
            val u = t * t * (3 - 2 * t)
            val settle = 1 - exp(-5.6f * u) * (cos(6.2f * u) + 5.6f / 6.2f * sin(6.2f * u))
            grip = gripFrom + (1 - gripFrom) * settle
            if (t == 1f) {
                grip = 1f
                isGripAnimating = false
            }
        } else {
            grip = gripFrom * exp(-4.2f * elapsed) * cos(7 * elapsed)
            if (elapsed >= 1.96f) {
                grip = 0f
                isGripAnimating = false
            }
        }
    }

    private enum class Phase { IDLE, TAP, RELEASE, DRAG, SPIN }

    private companion object {
        const val FLING_IMPULSE = 3 * 6.5f
        const val SPIN_DECAY = 0.7f
        const val IDLE_SPEED = 2 * PI.toFloat() / 10.54f
    }
}
