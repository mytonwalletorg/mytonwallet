package org.mytonwallet.plugins.nativebottomsheet;

import android.os.Handler;
import android.os.Looper;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.mytonwallet.plugins.nativebottomsheet.airLauncher.AirLauncher;

@CapacitorPlugin(name = "BottomSheet")
public class BottomSheetPlugin extends Plugin {

  private BottomSheet implementation = new BottomSheet();
  private AirLauncher airLauncher;

  @PluginMethod
  public void echo(PluginCall call) {
    String value = call.getString("value");

    JSObject ret = new JSObject();
    ret.put("value", implementation.echo(value));
    call.resolve(ret);
  }

  @PluginMethod
  public void switchToAir(PluginCall call) {
    if (airLauncher == null)
      airLauncher = new AirLauncher(getActivity());
    AirLauncher.setInstance(airLauncher);
    new Handler(Looper.getMainLooper()).post(() -> airLauncher.soarIntoAir(true));
    call.resolve();
  }
}
