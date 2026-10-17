package org.mytonwallet.app_air.uicomponents.diamond

import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.roundToInt

/** Projects the stone's silhouette for the refraction lens, in points with y down from the canvas center. */
internal class BlueDiamondLens(vertices: FloatArray) {
    private val positions: FloatArray = run {
        val seen = HashSet<Triple<Int, Int, Int>>()
        val unique = ArrayList<Float>()
        for (i in 0 until vertices.size / VERTEX_STRIDE) {
            val offset = i * VERTEX_STRIDE
            val x = vertices[offset]
            val y = vertices[offset + 1]
            val z = vertices[offset + 2]
            if (seen.add(
                    Triple((x * 40).roundToInt(), (y * 40).roundToInt(), (z * 40).roundToInt())
                )
            ) {
                unique += x
                unique += y
                unique += z
            }
        }
        unique.toFloatArray()
    }
    private val count = positions.size / 3
    private val xs = FloatArray(count)
    private val ys = FloatArray(count)
    private val order = Array(count) { it }
    private val hull = IntArray(count * 2)
    private val byPosition = Comparator<Int> { a, b ->
        val byX = xs[a].compareTo(xs[b])
        if (byX != 0) byX else ys[a].compareTo(ys[b])
    }

    val edges = FloatArray(MAX_EDGES * 4)
    var edgeCount = 0
        private set
    var centerX = 0f
        private set
    var centerY = 0f
        private set
    var radius = 0f
        private set

    /** [transform] is projection × model, column-major. Returns false when no hull exists. */
    fun update(transform: FloatArray, halfSize: Float): Boolean {
        project(transform, halfSize, 0f, 0f, 0f)
        centerX = projectedX
        centerY = projectedY
        var maxRadius = 0f
        for (i in 0 until count) {
            project(
                transform,
                halfSize,
                positions[i * 3],
                positions[i * 3 + 1],
                positions[i * 3 + 2]
            )
            xs[i] = centerX + (projectedX - centerX) * 0.96f
            ys[i] = centerY + (projectedY - centerY) * 0.96f
            maxRadius = max(maxRadius, hypot(xs[i] - centerX, ys[i] - centerY))
        }
        radius = maxRadius
        order.sortWith(byPosition)
        var size = 0
        for (point in order) {
            while (size >= 2 && cross(hull[size - 2], hull[size - 1], point) <= 0) size--
            hull[size++] = point
        }
        val lowerSize = size + 1
        for (index in count - 2 downTo 0) {
            val point = order[index]
            while (size >= lowerSize && cross(hull[size - 2], hull[size - 1], point) <= 0) size--
            hull[size++] = point
        }
        val hullSize = size - 1
        if (hullSize < 3) {
            edgeCount = 0
            return false
        }
        edgeCount = minOf(hullSize, MAX_EDGES)
        for (i in 0 until edgeCount) {
            val a = hull[i * hullSize / edgeCount]
            val b = hull[((i + 1) * hullSize / edgeCount) % hullSize]
            val dx = xs[b] - xs[a]
            val dy = ys[b] - ys[a]
            val length = max(hypot(dx, dy), 0.0001f)
            val normalX = -dy / length
            val normalY = dx / length
            edges[i * 4] = normalX
            edges[i * 4 + 1] = normalY
            edges[i * 4 + 2] = -(normalX * xs[a] + normalY * ys[a])
            edges[i * 4 + 3] = 0f
        }
        return true
    }

    private var projectedX = 0f
    private var projectedY = 0f

    private fun project(transform: FloatArray, halfSize: Float, x: Float, y: Float, z: Float) {
        val px = transform[0] * x + transform[4] * y + transform[8] * z + transform[12]
        val py = transform[1] * x + transform[5] * y + transform[9] * z + transform[13]
        val pw = transform[3] * x + transform[7] * y + transform[11] * z + transform[15]
        projectedX = px / pw * halfSize
        projectedY = -py / pw * halfSize
    }

    private fun cross(origin: Int, a: Int, b: Int): Float =
        (xs[a] - xs[origin]) * (ys[b] - ys[origin]) - (ys[a] - ys[origin]) * (xs[b] - xs[origin])

    companion object {
        const val MAX_EDGES = 64
        private const val VERTEX_STRIDE = 12
    }
}
