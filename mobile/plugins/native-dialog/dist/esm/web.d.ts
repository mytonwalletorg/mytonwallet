import { WebPlugin } from '@capacitor/core';
import type { DialogPlugin, AlertOptions, PromptOptions, PromptResult, ConfirmOptions, ConfirmResult } from './definitions';
export declare class DialogWeb extends WebPlugin implements DialogPlugin {
    alert(options: AlertOptions): Promise<void>;
    prompt(options: PromptOptions): Promise<PromptResult>;
    confirm(options: ConfirmOptions): Promise<ConfirmResult>;
}
