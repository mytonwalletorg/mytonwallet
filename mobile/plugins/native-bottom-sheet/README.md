# native-bottom-sheet

Allows to open a native BottomSheet/FloatingPanel on iOS

## Install

```bash
npm install native-bottom-sheet
npx cap sync
```

## API

<docgen-index>

* [`prepare()`](#prepare)
* [`applyScrollPatch()`](#applyscrollpatch)
* [`clearScrollPatch()`](#clearscrollpatch)
* [`delegate(...)`](#delegate)
* [`release(...)`](#release)
* [`openSelf(...)`](#openself)
* [`closeSelf(...)`](#closeself)
* [`setSelfSize(...)`](#setselfsize)
* [`callActionInMain(...)`](#callactioninmain)
* [`callActionInNative(...)`](#callactioninnative)
* [`openInMain(...)`](#openinmain)
* [`addListener('delegate', ...)`](#addlistenerdelegate)
* [`addListener('move', ...)`](#addlistenermove)
* [`addListener('callActionInMain', ...)`](#addlistenercallactioninmain)
* [`addListener('callActionInNative', ...)`](#addlistenercallactioninnative)
* [`addListener('openInMain', ...)`](#addlisteneropeninmain)
* [Interfaces](#interfaces)
* [Type Aliases](#type-aliases)

</docgen-index>

<docgen-api>
<!--Update the source file JSDoc comments and rerun docgen to update the docs below-->

### prepare()

```typescript
prepare() => Promise<void>
```

--------------------


### applyScrollPatch()

```typescript
applyScrollPatch() => Promise<void>
```

--------------------


### clearScrollPatch()

```typescript
clearScrollPatch() => Promise<void>
```

--------------------


### delegate(...)

```typescript
delegate(options: { key: BottomSheetKeys; globalJson: string; }) => Promise<void>
```

| Param         | Type                                                                                      |
| ------------- | ----------------------------------------------------------------------------------------- |
| **`options`** | <code>{ key: <a href="#bottomsheetkeys">BottomSheetKeys</a>; globalJson: string; }</code> |

--------------------


### release(...)

```typescript
release(options: { key: BottomSheetKeys | '*'; }) => Promise<void>
```

| Param         | Type                                                                         |
| ------------- | ---------------------------------------------------------------------------- |
| **`options`** | <code>{ key: <a href="#bottomsheetkeys">BottomSheetKeys</a> \| '*'; }</code> |

--------------------


### openSelf(...)

```typescript
openSelf(options: { key: BottomSheetKeys; height: string; backgroundColor: string; }) => Promise<void>
```

| Param         | Type                                                                                                           |
| ------------- | -------------------------------------------------------------------------------------------------------------- |
| **`options`** | <code>{ key: <a href="#bottomsheetkeys">BottomSheetKeys</a>; height: string; backgroundColor: string; }</code> |

--------------------


### closeSelf(...)

```typescript
closeSelf(options: { key: BottomSheetKeys; }) => Promise<void>
```

| Param         | Type                                                                  |
| ------------- | --------------------------------------------------------------------- |
| **`options`** | <code>{ key: <a href="#bottomsheetkeys">BottomSheetKeys</a>; }</code> |

--------------------


### setSelfSize(...)

```typescript
setSelfSize(options: { size: 'half' | 'full'; }) => Promise<void>
```

| Param         | Type                                     |
| ------------- | ---------------------------------------- |
| **`options`** | <code>{ size: 'half' \| 'full'; }</code> |

--------------------


### callActionInMain(...)

```typescript
callActionInMain(options: { name: string; optionsJson: string; }) => Promise<void>
```

| Param         | Type                                                |
| ------------- | --------------------------------------------------- |
| **`options`** | <code>{ name: string; optionsJson: string; }</code> |

--------------------


### callActionInNative(...)

```typescript
callActionInNative(options: { name: string; optionsJson: string; }) => Promise<void>
```

| Param         | Type                                                |
| ------------- | --------------------------------------------------- |
| **`options`** | <code>{ name: string; optionsJson: string; }</code> |

--------------------


### openInMain(...)

```typescript
openInMain(options: { key: BottomSheetKeys; }) => Promise<void>
```

| Param         | Type                                                                  |
| ------------- | --------------------------------------------------------------------- |
| **`options`** | <code>{ key: <a href="#bottomsheetkeys">BottomSheetKeys</a>; }</code> |

--------------------


### addListener('delegate', ...)

```typescript
addListener(eventName: 'delegate', handler: (options: { key: BottomSheetKeys; globalJson: string; }) => void) => Promise<PluginListenerHandle> & PluginListenerHandle
```

| Param           | Type                                                                                                            |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| **`eventName`** | <code>'delegate'</code>                                                                                         |
| **`handler`**   | <code>(options: { key: <a href="#bottomsheetkeys">BottomSheetKeys</a>; globalJson: string; }) =&gt; void</code> |

**Returns:** <code>Promise&lt;<a href="#pluginlistenerhandle">PluginListenerHandle</a>&gt; & <a href="#pluginlistenerhandle">PluginListenerHandle</a></code>

--------------------


### addListener('move', ...)

```typescript
addListener(eventName: 'move', handler: () => void) => Promise<PluginListenerHandle> & PluginListenerHandle
```

| Param           | Type                       |
| --------------- | -------------------------- |
| **`eventName`** | <code>'move'</code>        |
| **`handler`**   | <code>() =&gt; void</code> |

**Returns:** <code>Promise&lt;<a href="#pluginlistenerhandle">PluginListenerHandle</a>&gt; & <a href="#pluginlistenerhandle">PluginListenerHandle</a></code>

--------------------


### addListener('callActionInMain', ...)

```typescript
addListener(eventName: 'callActionInMain', handler: (options: { name: string; optionsJson: string; }) => void) => Promise<PluginListenerHandle> & PluginListenerHandle
```

| Param           | Type                                                                      |
| --------------- | ------------------------------------------------------------------------- |
| **`eventName`** | <code>'callActionInMain'</code>                                           |
| **`handler`**   | <code>(options: { name: string; optionsJson: string; }) =&gt; void</code> |

**Returns:** <code>Promise&lt;<a href="#pluginlistenerhandle">PluginListenerHandle</a>&gt; & <a href="#pluginlistenerhandle">PluginListenerHandle</a></code>

--------------------


### addListener('callActionInNative', ...)

```typescript
addListener(eventName: 'callActionInNative', handler: (options: { name: string; optionsJson: string; }) => void) => Promise<PluginListenerHandle> & PluginListenerHandle
```

| Param           | Type                                                                      |
| --------------- | ------------------------------------------------------------------------- |
| **`eventName`** | <code>'callActionInNative'</code>                                         |
| **`handler`**   | <code>(options: { name: string; optionsJson: string; }) =&gt; void</code> |

**Returns:** <code>Promise&lt;<a href="#pluginlistenerhandle">PluginListenerHandle</a>&gt; & <a href="#pluginlistenerhandle">PluginListenerHandle</a></code>

--------------------


### addListener('openInMain', ...)

```typescript
addListener(eventName: 'openInMain', handler: (options: { key: BottomSheetKeys; }) => void) => Promise<PluginListenerHandle> & PluginListenerHandle
```

| Param           | Type                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------- |
| **`eventName`** | <code>'openInMain'</code>                                                                   |
| **`handler`**   | <code>(options: { key: <a href="#bottomsheetkeys">BottomSheetKeys</a>; }) =&gt; void</code> |

**Returns:** <code>Promise&lt;<a href="#pluginlistenerhandle">PluginListenerHandle</a>&gt; & <a href="#pluginlistenerhandle">PluginListenerHandle</a></code>

--------------------


### Interfaces


#### PluginListenerHandle

| Prop         | Type                                      |
| ------------ | ----------------------------------------- |
| **`remove`** | <code>() =&gt; Promise&lt;void&gt;</code> |


### Type Aliases


#### BottomSheetKeys

<code>'initial' | 'receive' | 'invoice' | 'transfer' | 'swap' | 'stake' | 'unstake' | 'staking-info' | 'transaction-info' | 'swap-activity' | 'backup' | 'add-account' | 'settings' | 'qr-scanner' | 'dapp-connect' | 'dapp-transaction' | 'disclaimer' | 'backup-warning'</code>

</docgen-api>
