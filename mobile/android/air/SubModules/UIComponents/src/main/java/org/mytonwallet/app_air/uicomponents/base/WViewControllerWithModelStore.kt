package org.mytonwallet.app_air.uicomponents.base

import android.annotation.SuppressLint
import android.content.Context
import android.util.Log
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner

@SuppressLint("ViewConstructor")
open class WViewControllerWithModelStore(context: Context) : WViewController(context),
    ViewModelStoreOwner, LifecycleOwner {

    private val lifecycleRegistry = LifecycleRegistry(this)

    init {
        lifecycleRegistry.currentState = Lifecycle.State.STARTED
        Log.i("WTH_DEBUG", "ViewModelStore Create")
    }

    override val viewModelStore = ViewModelStore()
    override val lifecycle = lifecycleRegistry

    override fun onDestroy() {
        super.onDestroy()
        lifecycleRegistry.currentState = Lifecycle.State.DESTROYED
        viewModelStore.clear()
        Log.i("WTH_DEBUG", "ViewModelStore Destroy")
    }
}
