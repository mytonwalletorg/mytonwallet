package org.mytonwallet.app_air.walletcontext.secureStorage

import android.app.Activity
import android.content.Context
import org.json.JSONObject
import org.mytonwallet.app_air.walletcontext.helpers.credentialsHelper.NativeBiometric

object WSecureStorage {
    private var secureStorage: WSecureStorageProvider? = null
    private const val STATE_VERSION_KEY = "stateVersion"
    private const val STATE_VERSION_VAL = 17

    fun init(context: Context) {
        secureStorage =
            WSecureStorageProvider(
                context
            )
        if ((getSecValue(STATE_VERSION_KEY).toIntOrNull() ?: 0) < STATE_VERSION_VAL)
            setSecValue(STATE_VERSION_KEY, STATE_VERSION_VAL.toString())
    }

    private const val ACCOUNTS = "accounts"
    private const val PASSCODE_LENGTH = "passcodeLength"
    private const val FAILED_LOGIN_ATTEMPTS = "failedLoginAttempts"
    private const val LAST_FAILED_ATTEMPT = "lastFailedAttempt"

    private val _cachedValues = mutableMapOf<String, String>()

    @Synchronized
    fun allAccounts(): String {
        return getSecValue(ACCOUNTS)
    }

    @Synchronized
    fun getAccounts(): JSONObject {
        val accountsData = getSecValue("accounts")
        return JSONObject(accountsData)
    }

    @Synchronized
    fun getPasscodeLength(): Int {
        val passLength = getSecValue(PASSCODE_LENGTH)
        return if (passLength != "") passLength.toInt() else 4
    }

    @Synchronized
    fun setPasscodeLength(passcodeLength: Int) {
        setSecValue(PASSCODE_LENGTH, passcodeLength.toString())
    }

    @Synchronized
    fun getBiometricPasscode(activity: Activity): String? {
        return NativeBiometric(activity).getPasscode()
    }

    @Synchronized
    fun setBiometricPasscode(activity: Activity, passcode: String): Boolean {
        return NativeBiometric(activity).setCredentials("MyTonWallet", passcode)
    }

    @Synchronized
    fun deleteBiometricPasscode(activity: Activity): Boolean {
        return NativeBiometric(activity).deleteCredentials()
    }

    @Synchronized
    fun setFailedLoginAttempts(failedAttempts: Int) {
        return setSecValue(FAILED_LOGIN_ATTEMPTS, "$failedAttempts")
    }

    @Synchronized
    fun getFailedLoginAttempts(): Int? {
        return getSecValue(FAILED_LOGIN_ATTEMPTS).toIntOrNull()
    }

    @Synchronized
    fun setLastFailedAttempt(dt: Long) {
        return setSecValue(LAST_FAILED_ATTEMPT, "$dt")
    }

    @Synchronized
    fun getLastFailedAttempt(): Long? {
        return getSecValue(LAST_FAILED_ATTEMPT).toLongOrNull()
    }

    @Synchronized
    fun deleteAllWalletValues() {
        val walletKeys = secureStorage!!.keys()
        for (key in walletKeys) {
            _cachedValues.remove(key)
            secureStorage!!.remove(key)
        }
        setSecValue(STATE_VERSION_KEY, STATE_VERSION_VAL.toString())
    }

    @Synchronized
    fun setSecValue(key: String, value: String) {
        _cachedValues[key] = value
        secureStorage!!.setData(key, value)
    }

    @Synchronized
    fun getSecValue(key: String): String {
        if (_cachedValues.contains(key))
            return _cachedValues[key]!!
        val value = secureStorage!!.getStringData(key)
        _cachedValues[key] = value
        return value
    }
}
