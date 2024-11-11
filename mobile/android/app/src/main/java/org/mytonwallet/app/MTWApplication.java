package org.mytonwallet.app;

import android.app.Application;

import com.capacitorjs.plugins.statusbar.StatusBarPluginDelegate;

public class MTWApplication extends Application implements StatusBarPluginDelegate {

  @Override
  public void onCreate() {
    super.onCreate();
  }

  private String currentStatusBar;

  @Override
  public void didUpdateStatusBar(String newStatusBar) {
    currentStatusBar = newStatusBar;
  }

  public String getCurrentStatusBar() {
    return currentStatusBar;
  }
}
