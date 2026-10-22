const isApple =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

const symbols: Record<string, string> = {
  Mod: isApple ? '⌘' : 'Ctrl',
  Alt: isApple ? '⌥' : 'Alt',
  Shift: '⇧',
  Enter: '↵',
  Escape: 'Esc',
  Backspace: '⌫',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
};

/**
 * Splits a shortcut definition into display keys.
 * "Mod+Shift+K" → ["⌘","⇧","K"]; "G I" (a sequence) → ["G","then","I"].
 */
export function formatShortcut(definition: string): string[] {
  return definition
    .split(' ')
    .flatMap((step, index) => [
      ...(index > 0 ? ['then'] : []),
      ...step.split('+').map((key) => symbols[key] ?? key.toUpperCase()),
    ]);
}
