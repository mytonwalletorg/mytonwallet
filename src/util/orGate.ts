type OnSwitch = (isOn: boolean) => void;

/**
 * A virtual multi-input OR gate (https://en.wikipedia.org/wiki/OR_gate).
 * Triggers the callback when the gate output changes.
 */
export class OrGate<T> {
  #enabledItems = new Set<T>();
  #onSwitch: OnSwitch;

  constructor(onSwitch: OnSwitch) {
    this.#onSwitch = onSwitch;
  }

  get isOn() {
    return this.#enabledItems.size > 0;
  }

  on(item: T) {
    this.toggle(item, true);
  }

  off(item: T) {
    this.toggle(item, false);
  }

  toggle(item: T, isItemOn: boolean) {
    const prevIsOn = this.isOn;
    this.#enabledItems[isItemOn ? 'add' : 'delete'](item);
    const nextIsOn = this.isOn;

    if (prevIsOn !== nextIsOn) {
      this.#onSwitch(nextIsOn);
    }
  }
}
