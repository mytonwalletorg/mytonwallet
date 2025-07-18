package org.mytonwallet.plugins.nativebottomsheet.airLauncher;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;

import org.mytonwallet.app_air.airasframework.AirAsFrameworkApplication;
import org.mytonwallet.app_air.airasframework.LaunchConfig;
import org.mytonwallet.app_air.airasframework.MainWindow;
import org.mytonwallet.app_air.airasframework.splash.SplashVC;
import org.mytonwallet.app_air.walletcontext.globalStorage.IGlobalStorageProvider;
import org.mytonwallet.app_air.walletcore.deeplink.Deeplink;
import org.mytonwallet.app_air.walletcore.deeplink.DeeplinkNavigator;
import org.mytonwallet.app_air.walletcore.deeplink.DeeplinkParser;

public class AirLauncher {
  @SuppressLint("StaticFieldLeak")
  private static AirLauncher airLauncher;
  private final Activity activity;

  private boolean isOnTheAir;
  private CapacitorGlobalStorageProvider capacitorGlobalStorageProvider;

  public AirLauncher(Activity activity) {
    this.activity = activity;
    isOnTheAir = false;
  }

  public static AirLauncher getInstance() {
    return airLauncher;
  }

  public static void setInstance(AirLauncher instance) {
    airLauncher = instance;
  }

  public boolean getIsOnTheAir() {
    return isOnTheAir;
  }

  public void soarIntoAir(Boolean fromLegacy) {
    if (isOnTheAir)
      return;
    isOnTheAir = true;
    Context applicationContext = activity.getApplicationContext();
    capacitorGlobalStorageProvider = new CapacitorGlobalStorageProvider(applicationContext, success -> {
      if (fromLegacy) {
        // Token price history may be invalid due to base currency change
        capacitorGlobalStorageProvider.setEmptyObject("tokenPriceHistory.bySlug", IGlobalStorageProvider.PERSIST_NO);
      }
      openAir();
    });
  }

  private void openAir() {
    AirAsFrameworkApplication.Companion.onCreate(activity, capacitorGlobalStorageProvider);
    Intent intent = new Intent(activity, MainWindow.class);
    intent.addFlags(Intent.FLAG_ACTIVITY_NO_ANIMATION);
    activity.startActivity(intent);
    LaunchConfig.Companion.setShouldStartOnAir(activity, true);
    activity.finish();
  }

  public void handle(Intent intent) {
    Deeplink deeplink = DeeplinkParser.Companion.parse(intent);
    if (deeplink != null) {
      DeeplinkNavigator deeplinkNavigator = SplashVC.Companion.getSharedInstance();
      if (deeplinkNavigator != null) {
        deeplinkNavigator.handle(deeplink);
      } else {
        SplashVC.Companion.setPendingDeeplink(deeplink);
      }
    }
  }
}
