package org.mytonwallet.app_air.walletcore

internal data class PlayInstallMetadata(val installedAt: Long, val installVersion: String)

internal fun readPlayInstallMetadata(
    installBeginTimestampServerSeconds: Long,
    installVersion: String?
): PlayInstallMetadata? {
    val version = installVersion ?: ""
    if (installBeginTimestampServerSeconds <= 0 ||
        installBeginTimestampServerSeconds > 9007199254740L || version.length > 64
    ) {
        return null
    }
    return PlayInstallMetadata(installBeginTimestampServerSeconds * 1000, version)
}
