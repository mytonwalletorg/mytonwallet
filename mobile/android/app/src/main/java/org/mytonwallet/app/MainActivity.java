package org.mytonwallet.app;

import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.animation.AnimatorSet;
import android.animation.ObjectAnimator;
import android.os.Bundle;
import android.os.Handler;
import android.view.View;
import androidx.core.splashscreen.SplashScreen;
import androidx.interpolator.view.animation.FastOutSlowInInterpolator;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  private boolean keep = true;
  private final int DELAY = 1000;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
    splashScreen.setKeepOnScreenCondition(() -> keep);
    splashScreen.setOnExitAnimationListener(splashScreenView -> {
      AnimatorSet animationSet = new AnimatorSet();

      View view = splashScreenView.getView();
      ObjectAnimator scaleY = ObjectAnimator.ofFloat(view, View.SCALE_Y, 4f);
      ObjectAnimator scaleX = ObjectAnimator.ofFloat(view, View.SCALE_X, 4f);
      ObjectAnimator opacity = ObjectAnimator.ofFloat(view, View.ALPHA, 0.0f);

      animationSet.setInterpolator(new FastOutSlowInInterpolator());
      animationSet.setDuration(350L);
      animationSet.playTogether(scaleX, scaleY, opacity);

      animationSet.addListener(new AnimatorListenerAdapter() {
        @Override
        public void onAnimationEnd(Animator animation) {
          splashScreenView.remove();
        }
      });

      animationSet.start();
    });

    Handler handler = new Handler();
    handler.postDelayed(() -> keep = false, DELAY);
  }
}
