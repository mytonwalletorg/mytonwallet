export function createCallbackManager<T extends AnyToVoidFunction = AnyToVoidFunction>() {
  const callbacks = new Set<T>();

  function addCallback(cb: T) {
    callbacks.add(cb);

    return () => {
      removeCallback(cb);
    };
  }

  function removeCallback(cb: T) {
    callbacks.delete(cb);
  }

  function runCallbacks(...args: Parameters<T>) {
    callbacks.forEach((callback) => {
      callback(...args);
    });
  }

  function hasCallbacks() {
    return Boolean(callbacks.size);
  }

  return {
    runCallbacks,
    addCallback,
    removeCallback,
    hasCallbacks,
  };
}

export type CallbackManager<T extends AnyToVoidFunction = AnyToVoidFunction>
  = ReturnType<typeof createCallbackManager<T>>;

export class EventEmitter {
  private channels = new Map<string, CallbackManager>();

  on(name: string, handler: AnyToVoidFunction) {
    this.resolveChannel(name).addCallback(handler);
    return this;
  }

  removeListener(name: string, handler: AnyToVoidFunction) {
    this.resolveChannel(name).removeCallback(handler);
    return this;
  }

  emit(name: string, ...args: any) {
    this.resolveChannel(name).runCallbacks(...args);
    return this;
  }

  private resolveChannel(name: string) {
    let channel = this.channels.get(name);
    if (!channel) {
      channel = createCallbackManager();
      this.channels.set(name, channel);
    }

    return channel;
  }
}
