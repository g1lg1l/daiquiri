/** Shared by the ThemeProvider and the inline boot script injected into index.html. */
export const THEME_STORAGE_KEY = 'daiq-theme';
export const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * Applies the theme before first paint so dark mode never flashes light.
 * Must stay dependency-free: it is inlined into <head>.
 */
export const themeBootScript = `(function(){try{var p=localStorage.getItem('${THEME_STORAGE_KEY}');var d=p==='dark'||(p!=='light'&&matchMedia('${DARK_QUERY}').matches);document.documentElement.dataset.theme=d?'dark':'light'}catch(e){document.documentElement.dataset.theme='light'}})()`;
