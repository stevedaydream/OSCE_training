import { useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { getTheme, setTheme, THEME_LABEL, THEMES } from '../lib/theme';

const ICON = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

/** 三態循環：跟隨系統 → 淺色 → 深色 → 跟隨系統。 */
export default function ThemeToggle() {
  const [theme, setLocalTheme] = useState(getTheme);
  const Icon = ICON[theme];

  function cycle() {
    const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    setLocalTheme(setTheme(next));
  }

  return (
    <button
      type="button"
      className="btn btn-ghost"
      onClick={cycle}
      title={`外觀：${THEME_LABEL[theme]}（點擊切換）`}
      aria-label={`外觀：${THEME_LABEL[theme]}`}
    >
      <Icon size={16} />
    </button>
  );
}
