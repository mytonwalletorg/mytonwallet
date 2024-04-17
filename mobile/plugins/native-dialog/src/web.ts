import { WebPlugin } from '@capacitor/core';

import type {
  DialogPlugin,
  AlertOptions,
  PromptOptions,
  PromptResult,
  ConfirmOptions,
  ConfirmResult,
} from './definitions';

export class DialogWeb extends WebPlugin implements DialogPlugin {
  async alert(options: AlertOptions): Promise<void> {
    window.alert(options.message);
  }

  async prompt(options: PromptOptions): Promise<PromptResult> {
    const val = window.prompt(options.message, options.inputText || '');
    return {
      value: val !== null ? val : '',
      cancelled: val === null,
    };
  }

  async confirm(options: ConfirmOptions): Promise<ConfirmResult> {
    const val = window.confirm(options.message);
    return {
      value: val,
    };
  }
}
