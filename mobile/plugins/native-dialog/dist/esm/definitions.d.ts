export interface AlertOptions {
    /**
     * Title of the dialog.
     *
     * @since 1.0.0
     */
    title?: string;
    /**
     * Message to show on the dialog.
     *
     * @since 1.0.0
     */
    message: string;
    /**
     * Text to use on the action button.
     *
     * @default "OK"
     * @since 1.0.0
     */
    buttonTitle?: string;
}
export interface PromptOptions {
    /**
     * Title of the dialog.
     *
     * @since 1.0.0
     */
    title?: string;
    /**
     * Message to show on the dialog.
     *
     * @since 1.0.0
     */
    message: string;
    /**
     * Text to use on the positive action button.
     *
     * @default "OK"
     * @since 1.0.0
     */
    okButtonTitle?: string;
    /**
     * Text to use on the negative action button.
     *
     * @default "Cancel"
     * @since 1.0.0
     */
    cancelButtonTitle?: string;
    /**
     * Placeholder text for hints.
     *
     * @since 1.0.0
     */
    inputPlaceholder?: string;
    /**
     * Prepopulated text.
     *
     * @since 1.0.0
     */
    inputText?: string;
}
export interface ConfirmOptions {
    /**
     * Title of the dialog.
     *
     * @since 1.0.0
     */
    title?: string;
    /**
     * Message to show on the dialog.
     *
     * @since 1.0.0
     */
    message: string;
    /**
     * Text to use on the positive action button.
     *
     * @default "OK"
     * @since 1.0.0
     */
    okButtonTitle?: string;
    /**
     * Text to use on the negative action button.
     *
     * @default "Cancel"
     * @since 1.0.0
     */
    cancelButtonTitle?: string;
}
export interface PromptResult {
    /**
     * Text entered on the prompt.
     *
     * @since 1.0.0
     */
    value: string;
    /**
     * Whether if the prompt was canceled or accepted.
     *
     * @since 1.0.0
     */
    cancelled: boolean;
}
export interface ConfirmResult {
    /**
     * true if the positive button was clicked, false otherwise.
     *
     * @since 1.0.0
     */
    value: boolean;
}
export interface DialogPlugin {
    /**
     * Show an alert dialog
     *
     * @since 1.0.0
     */
    alert(options: AlertOptions): Promise<void>;
    /**
     * Show a prompt dialog
     *
     * @since 1.0.0
     */
    prompt(options: PromptOptions): Promise<PromptResult>;
    /**
     * Show a confirmation dialog
     *
     * @since 1.0.0
     */
    confirm(options: ConfirmOptions): Promise<ConfirmResult>;
}
