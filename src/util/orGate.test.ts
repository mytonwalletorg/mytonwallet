import { OrGate } from './orGate';

describe('OrGate', () => {
  it('should be off initially', () => {
    const onSwitch = jest.fn();
    const gate = new OrGate(onSwitch);
    expect(gate.isOn).toBe(false);
    expect(onSwitch).not.toHaveBeenCalled();
  });

  it('should turn on when an item is enabled', () => {
    const onSwitch = jest.fn();
    const gate = new OrGate(onSwitch);
    gate.on('a');
    expect(gate.isOn).toBe(true);
    expect(onSwitch).toHaveBeenCalledWith(true);
  });

  it('should turn off when all items are disabled', () => {
    const onSwitch = jest.fn();
    const gate = new OrGate(onSwitch);
    gate.on('a');
    gate.off('a');
    expect(gate.isOn).toBe(false);
    expect(onSwitch).toHaveBeenLastCalledWith(false);
  });

  it('should not call onSwitch if state does not change', () => {
    const onSwitch = jest.fn();
    const gate = new OrGate(onSwitch);
    gate.on('a');
    onSwitch.mockClear();
    gate.on('a');
    expect(onSwitch).not.toHaveBeenCalled();
    gate.off('a');
    onSwitch.mockClear();
    gate.off('a');
    expect(onSwitch).not.toHaveBeenCalled();
  });

  it('should stay on if at least one item is enabled', () => {
    const onSwitch = jest.fn();
    const gate = new OrGate(onSwitch);
    gate.on('a');
    gate.on('b');
    gate.off('a');
    expect(gate.isOn).toBe(true);
    expect(onSwitch).toHaveBeenCalledTimes(1); // Only first on triggers
  });
});
