package org.mytonwallet.app_air.walletcore

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class PlayInstallMetadataTest {
    @Test
    fun convertsServerSecondsToWholeMillisecondsAndRetainsOriginalVersion() {
        assertEquals(
            PlayInstallMetadata(1788220800000, "26.8.9"),
            readPlayInstallMetadata(1788220800, "26.8.9")
        )
        assertEquals(
            PlayInstallMetadata(1788220800000, ""),
            readPlayInstallMetadata(1788220800, null)
        )
    }

    @Test
    fun unavailableOrUnrepresentableServerTimestampProducesNoEvidence() {
        for (seconds in listOf(0L, -1L, Long.MAX_VALUE, 9007199254741L)) {
            assertNull(readPlayInstallMetadata(seconds, "26.8.9"))
        }
        assertNull(readPlayInstallMetadata(1788220800, "a".repeat(65)))
    }
}
