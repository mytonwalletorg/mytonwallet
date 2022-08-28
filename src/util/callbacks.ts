export function createCallbackManager() {
  const callbacks: AnyToVoidFunction[] = [];

  function addCallback(cb: AnyToVoidFunction) {
    callbacks.push(cb);

    return () => {
      removeCallback(cb);
    };
  }

  function removeCallback(cb: AnyToVoidFunction) {
    const index = callbacks.indexOf(cb);
    if (index !== -1) {
      callbacks.splice(index, 1);
    }
  }

  function runCallbacks(...args: any[]) {
    callbacks.forEach((callback) => {
      callback(...args);
    });
  }

  function hasCallbacks() {
    return Boolean(callbacks.length);
  }

  return {
    runCallbacks,
    addCallback,
    removeCallback,
    hasCallbacks,
  };
}

export type CallbackManager = ReturnType<typeof createCallbackManager>;

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
