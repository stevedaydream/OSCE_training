/**
 * 佈景主題。
 *
 * 三種狀態：system（跟隨作業系統）、light、dark。
 * 選 system 時不在 <html> 上留任何標記，交給 CSS 的 prefers-color-scheme 決定；
 * 明確選擇時才蓋上 data-theme，讓它勝過系統設定。
 *
 * 門前貼紙那一頁不受影響——真實考場門上就是一張白紙，那頁永遠是白底黑字。
 */

const STORAGE_KEY = 'OSCE_THEME';
export const THEMES = ['system', 'light', 'dark'];

export const THEME_LABEL = {
  system: '跟隨系統',
  light: '淺色',
  dark: '深色',
};

export function getTheme() {
  const stored = localStorage.getItem(STORAGE_KEY);
  return THEMES.includes(stored) ? stored : 'system';
}

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

export function setTheme(theme) {
  const next = THEMES.includes(theme) ? theme : 'system';
  localStorage.setItem(STORAGE_KEY, next);
  applyTheme(next);
  return next;
}

/** 在 React 掛載前先套用，避免深色使用者看到一閃而過的白畫面。 */
export function initTheme() {
  applyTheme(getTheme());
}
