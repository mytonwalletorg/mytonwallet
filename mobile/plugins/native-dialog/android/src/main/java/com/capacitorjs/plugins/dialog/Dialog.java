package org.mytonwallet.plugins.nativedialog;

import android.app.AlertDialog;
import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.widget.EditText;

public class Dialog {

    public interface OnResultListener {
        void onResult(boolean value, boolean didCancel, String inputValue);
    }

    public interface OnCancelListener {
        void onCancel();
    }

    /**
     * Show a simple alert with a message and default values for
     * title and ok button
     * @param message the message to show
     */
    public static void alert(final Context context, final String message, final Dialog.OnResultListener listener) {
        alert(context, message, null, null, listener);
    }

    /**
     * Show an alert window
     * @param context the context
     * @param message the message for the alert
     * @param title the title for the alert
     * @param okButtonTitle the title for the OK button
     * @param listener the listener for returning data back
     */
    public static void alert(
        final Context context,
        final String message,
        final String title,
        final String okButtonTitle,
        final Dialog.OnResultListener listener
    ) {
        final String alertOkButtonTitle = okButtonTitle == null ? "OK" : okButtonTitle;

        new Handler(Looper.getMainLooper())
            .post(
                () -> {
                    AlertDialog.Builder builder = new AlertDialog.Builder(context);

                    if (title != null) {
                        builder.setTitle(title);
                    }
                    builder
                        .setMessage(message)
                        .setPositiveButton(
                            alertOkButtonTitle,
                            (dialog, buttonIndex) -> {
                                dialog.dismiss();
                                listener.onResult(true, false, null);
                            }
                        )
                        .setOnCancelListener(
                            dialog -> {
                                dialog.dismiss();
                                listener.onResult(false, true, null);
                            }
                        );

                    AlertDialog dialog = builder.create();

                    dialog.show();
                }
            );
    }

    public static void confirm(final Context context, final String message, final Dialog.OnResultListener listener) {
        confirm(context, message, null, null, null, listener);
    }

    public static void confirm(
        final Context context,
        final String message,
        final String title,
        final String okButtonTitle,
        final String cancelButtonTitle,
        final Dialog.OnResultListener listener
    ) {
        final String confirmOkButtonTitle = okButtonTitle == null ? "OK" : okButtonTitle;
        final String confirmCancelButtonTitle = cancelButtonTitle == null ? "Cancel" : cancelButtonTitle;

        new Handler(Looper.getMainLooper())
            .post(
                () -> {
                    final AlertDialog.Builder builder = new AlertDialog.Builder(context);
                    if (title != null) {
                        builder.setTitle(title);
                    }
                    builder
                        .setMessage(message)
                        .setPositiveButton(
                            confirmOkButtonTitle,
                            (dialog, buttonIndex) -> {
                                dialog.dismiss();
                                listener.onResult(true, false, null);
                            }
                        )
                        .setNegativeButton(
                            confirmCancelButtonTitle,
                            (dialog, buttonIndex) -> {
                                dialog.dismiss();
                                listener.onResult(false, false, null);
                            }
                        )
                        .setOnCancelListener(
                            dialog -> {
                                dialog.dismiss();
                                listener.onResult(false, true, null);
                            }
                        );

                    AlertDialog dialog = builder.create();

                    dialog.show();
                }
            );
    }

    public static void prompt(final Context context, final String message, final Dialog.OnResultListener listener) {
        prompt(context, message, null, null, null, null, null, listener);
    }

    public static void prompt(
        final Context context,
        final String message,
        final String title,
        final String okButtonTitle,
        final String cancelButtonTitle,
        final String inputPlaceholder,
        final String inputText,
        final Dialog.OnResultListener listener
    ) {
        final String promptOkButtonTitle = okButtonTitle == null ? "OK" : okButtonTitle;
        final String promptCancelButtonTitle = cancelButtonTitle == null ? "Cancel" : cancelButtonTitle;
        final String promptInputPlaceholder = inputPlaceholder == null ? "" : inputPlaceholder;
        final String promptInputText = inputText == null ? "" : inputText;

        new Handler(Looper.getMainLooper())
            .post(
                () -> {
                    final AlertDialog.Builder builder = new AlertDialog.Builder(context);
                    final EditText input = new EditText(context);

                    input.setHint(promptInputPlaceholder);
                    input.setText(promptInputText);
                    if (title != null) {
                        builder.setTitle(title);
                    }
                    builder
                        .setMessage(message)
                        .setView(input)
                        .setPositiveButton(
                            promptOkButtonTitle,
                            (dialog, buttonIndex) -> {
                                dialog.dismiss();

                                String inputText1 = input.getText().toString().trim();
                                listener.onResult(true, false, inputText1);
                            }
                        )
                        .setNegativeButton(
                            promptCancelButtonTitle,
                            (dialog, buttonIndex) -> {
                                dialog.dismiss();
                                listener.onResult(false, true, null);
                            }
                        )
                        .setOnCancelListener(
                            dialog -> {
                                dialog.dismiss();
                                listener.onResult(false, true, null);
                            }
                        );

                    AlertDialog dialog = builder.create();

                    dialog.show();
                }
            );
    }
}
