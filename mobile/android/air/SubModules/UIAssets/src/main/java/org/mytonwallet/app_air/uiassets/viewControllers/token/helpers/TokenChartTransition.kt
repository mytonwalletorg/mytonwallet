package org.mytonwallet.app_air.uiassets.viewControllers.token.helpers

import com.github.mikephil.charting.data.Entry

// Pans through time when the windows overlap; otherwise morphs the old line into the new one.
class TokenChartTransition private constructor(
    private val timestamps: DoubleArray,
    private val fromValues: DoubleArray,
    private val toValues: DoubleArray,
    private val fromWindow: Window,
    private val toWindow: Window
) {
    class Window(val minX: Double, val maxX: Double, val minY: Double, val maxY: Double)

    fun entries(fraction: Float): List<Entry> = timestamps.indices.map { i ->
        Entry(
            timestamps[i].toFloat(),
            lerp(fromValues[i], toValues[i], fraction).toFloat()
        )
    }

    fun window(fraction: Float) = Window(
        lerp(fromWindow.minX, toWindow.minX, fraction),
        lerp(fromWindow.maxX, toWindow.maxX, fraction),
        lerp(fromWindow.minY, toWindow.minY, fraction),
        lerp(fromWindow.maxY, toWindow.maxY, fraction)
    )

    companion object {
        fun create(
            from: Array<Array<Double>>,
            to: Array<Array<Double>>,
            spaceTopPercent: Float
        ): TokenChartTransition? {
            if (from.size < 2 || to.size < 2) return null
            val fromStart = from.first()[0]
            val fromEnd = from.last()[0]
            val toStart = to.first()[0]
            val toEnd = to.last()[0]
            if (fromEnd <= fromStart || toEnd <= toStart) return null

            val timestamps = ArrayList<Double>(from.size + to.size)
            val fromValues = ArrayList<Double>(from.size + to.size)
            val toValues = ArrayList<Double>(from.size + to.size)
            fun add(timestamp: Double, fromValue: Double, toValue: Double) {
                timestamps.add(timestamp)
                fromValues.add(fromValue)
                toValues.add(toValue)
            }

            val fromY = valueRange(from, spaceTopPercent)
            val toY = valueRange(to, spaceTopPercent)
            val isPan = toStart >= fromStart && toEnd >= fromEnd && fromEnd > toStart
            val fromWindow: Window
            if (isPan) {
                val enteringOffset = valueAt(from, fromEnd) - valueAt(to, fromEnd)
                from.forEach { if (it[0] < toStart) add(it[0], it[1], it[1]) }
                to.forEach {
                    val fromValue =
                        if (it[0] <= fromEnd) valueAt(from, it[0]) else it[1] + enteringOffset
                    add(it[0], fromValue, it[1])
                }
                fromWindow = Window(fromStart, fromEnd, fromY.first, fromY.second)
            } else {
                to.forEach {
                    val progress = (it[0] - toStart) / (toEnd - toStart)
                    add(it[0], valueAt(from, fromStart + progress * (fromEnd - fromStart)), it[1])
                }
                fromWindow = Window(toStart, toEnd, fromY.first, fromY.second)
            }
            return TokenChartTransition(
                timestamps.toDoubleArray(),
                fromValues.toDoubleArray(),
                toValues.toDoubleArray(),
                fromWindow,
                Window(toStart, toEnd, toY.first, toY.second)
            )
        }

        // Mirrors the chart's own y-axis bounds: top spacing only, ±1 around a flat line.
        private fun valueRange(
            data: Array<Array<Double>>,
            spaceTopPercent: Float
        ): Pair<Double, Double> {
            val min = data.minOf { it[1] }
            val max = data.maxOf { it[1] }
            val range = max - min
            if (range == 0.0) return Pair(min - 1, max + 1)
            return Pair(min, max + range / 100 * spaceTopPercent)
        }

        private fun valueAt(data: Array<Array<Double>>, timestamp: Double): Double {
            if (timestamp <= data.first()[0]) return data.first()[1]
            if (timestamp >= data.last()[0]) return data.last()[1]
            var low = 0
            var high = data.size - 1
            while (high - low > 1) {
                val mid = (low + high) ushr 1
                if (data[mid][0] <= timestamp) low = mid else high = mid
            }
            val (t0, v0) = data[low]
            val (t1, v1) = data[high]
            if (t1 == t0) return v1
            return v0 + (v1 - v0) * (timestamp - t0) / (t1 - t0)
        }

        private fun lerp(from: Double, to: Double, fraction: Float) = from + (to - from) * fraction
    }
}
