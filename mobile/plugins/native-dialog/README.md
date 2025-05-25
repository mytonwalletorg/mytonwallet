# @capacitor/dialog

The Dialog API provides methods for triggering native dialog windows for alerts, confirmations, and input prompts

## Install

```bash
npm install @capacitor/dialog
npx cap sync
```

## Example

```typescript
import { Dialog } from '@capacitor/dialog';

const showAlert = async () => {
  await Dialog.alert({
    title: 'Stop',
    message: 'this is an error',
  });
};

const showConfirm = async () => {
  const { value } = await Dialog.confirm({
    title: 'Confirm',
    message: `Are you sure you'd like to press the red button?`,
  });

  console.log('Confirmed:', value);
};

const showPrompt = async () => {
  const { value, cancelled } = await Dialog.prompt({
    title: 'Hello',
    message: `What's your name?`,
  });

  console.log('Name:', value);
  console.log('Cancelled:', cancelled);
};
```

## API

<docgen-index>

* [`alert(...)`](#alert)
* [`prompt(...)`](#prompt)
* [`confirm(...)`](#confirm)
* [Interfaces](#interfaces)

</docgen-index>

<docgen-api>
<!--Update the source file JSDoc comments and rerun docgen to update the docs below-->

### alert(...)

```typescript
alert(options: AlertOptions) => Promise<void>
```

Show an alert dialog

| Param         | Type                                                  |
| ------------- | ----------------------------------------------------- |
| **`options`** | <code><a href="#alertoptions">AlertOptions</a></code> |

**Since:** 1.0.0

--------------------


### prompt(...)

```typescript
prompt(options: PromptOptions) => Promise<PromptResult>
```

Show a prompt dialog

| Param         | Type                                                    |
| ------------- | ------------------------------------------------------- |
| **`options`** | <code><a href="#promptoptions">PromptOptions</a></code> |

**Returns:** <code>Promise&lt;<a href="#promptresult">PromptResult</a>&gt;</code>

**Since:** 1.0.0

--------------------


### confirm(...)

```typescript
confirm(options: ConfirmOptions) => Promise<ConfirmResult>
```

Show a confirmation dialog

| Param         | Type                                                      |
| ------------- | --------------------------------------------------------- |
| **`options`** | <code><a href="#confirmoptions">ConfirmOptions</a></code> |

**Returns:** <code>Promise&lt;<a href="#confirmresult">ConfirmResult</a>&gt;</code>

**Since:** 1.0.0

--------------------


### Interfaces


#### AlertOptions

| Prop              | Type                | Description                       | Default           | Since |
| ----------------- | ------------------- | --------------------------------- | ----------------- | ----- |
| **`title`**       | <code>string</code> | Title of the dialog.              |                   | 1.0.0 |
| **`message`**     | <code>string</code> | Message to show on the dialog.    |                   | 1.0.0 |
| **`buttonTitle`** | <code>string</code> | Text to use on the action button. | <code>"OK"</code> | 1.0.0 |


#### PromptResult

| Prop            | Type                 | Description                                     | Since |
| --------------- | -------------------- | ----------------------------------------------- | ----- |
| **`value`**     | <code>string</code>  | Text entered on the prompt.                     | 1.0.0 |
| **`cancelled`** | <code>boolean</code> | Whether if the prompt was canceled or accepted. | 1.0.0 |


#### PromptOptions

| Prop                    | Type                | Description                                | Default               | Since |
| ----------------------- | ------------------- | ------------------------------------------ | --------------------- | ----- |
| **`title`**             | <code>string</code> | Title of the dialog.                       |                       | 1.0.0 |
| **`message`**           | <code>string</code> | Message to show on the dialog.             |                       | 1.0.0 |
| **`okButtonTitle`**     | <code>string</code> | Text to use on the positive action button. | <code>"OK"</code>     | 1.0.0 |
| **`cancelButtonTitle`** | <code>string</code> | Text to use on the negative action button. | <code>"Cancel"</code> | 1.0.0 |
| **`inputPlaceholder`**  | <code>string</code> | Placeholder text for hints.                |                       | 1.0.0 |
| **`inputText`**         | <code>string</code> | Prepopulated text.                         |                       | 1.0.0 |


#### ConfirmResult

| Prop        | Type                 | Description                                               | Since |
| ----------- | -------------------- | --------------------------------------------------------- | ----- |
| **`value`** | <code>boolean</code> | true if the positive button was clicked, false otherwise. | 1.0.0 |


#### ConfirmOptions

| Prop                    | Type                | Description                                | Default               | Since |
| ----------------------- | ------------------- | ------------------------------------------ | --------------------- | ----- |
| **`title`**             | <code>string</code> | Title of the dialog.                       |                       | 1.0.0 |
| **`message`**           | <code>string</code> | Message to show on the dialog.             |                       | 1.0.0 |
| **`okButtonTitle`**     | <code>string</code> | Text to use on the positive action button. | <code>"OK"</code>     | 1.0.0 |
| **`cancelButtonTitle`** | <code>string</code> | Text to use on the negative action button. | <code>"Cancel"</code> | 1.0.0 |

</docgen-api>
