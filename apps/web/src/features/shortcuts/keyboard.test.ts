import { eventToKeys, isTypingTarget, register } from './keyboard';

const press = (key: string, init: KeyboardEventInit = {}, target: EventTarget = document.body) => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
};

describe('keyboard dispatcher', () => {
  it('normalises events to registry notation', () => {
    expect(eventToKeys(new KeyboardEvent('keydown', { key: 'c' }))).toBe('C');
    expect(eventToKeys(new KeyboardEvent('keydown', { key: '?', shiftKey: true }))).toBe('?');
    expect(eventToKeys(new KeyboardEvent('keydown', { key: 'P', shiftKey: true }))).toBe('Shift+P');
    expect(eventToKeys(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))).toBe('Mod+K');
    expect(eventToKeys(new KeyboardEvent('keydown', { key: ' ' }))).toBe('Space');
  });

  it('dispatches to the innermost registration and supports sequences', () => {
    const outer = vi.fn<() => void>();
    const inner = vi.fn<() => void>();
    const inbox = vi.fn<() => void>();
    const disposeOuter = register({ create: outer, goInbox: inbox });
    const disposeInner = register({ create: inner });
    press('c');
    expect(inner).toHaveBeenCalledOnce();
    expect(outer).not.toHaveBeenCalled();
    disposeInner();
    press('c');
    expect(outer).toHaveBeenCalledOnce();
    press('g');
    press('i');
    expect(inbox).toHaveBeenCalledOnce();
    disposeOuter();
  });

  it('ignores single keys while typing but not modifier shortcuts', () => {
    const create = vi.fn<() => void>();
    const palette = vi.fn<() => void>();
    const dispose = register({ create, palette });
    const input = document.createElement('input');
    document.body.append(input);
    press('c', {}, input);
    press('k', { ctrlKey: true }, input);
    expect(create).not.toHaveBeenCalled();
    expect(palette).toHaveBeenCalledOnce();
    expect(isTypingTarget(input)).toBe(true);
    input.remove();
    dispose();
  });
});
