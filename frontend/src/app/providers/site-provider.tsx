import { createContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { SiteSettings } from '../../entities/site/model/types';
import { contentApi } from '../../features/content/api/content-api';

type Theme = 'light' | 'dark';
export type SiteContextValue = { settings: SiteSettings | null; settingsLoading: boolean; settingsError: string | null; theme: Theme; toggleTheme: () => void; applySettings: (settings: SiteSettings) => void };
export const SiteContext = createContext<SiteContextValue>({ settings: null, settingsLoading: true, settingsError: null, theme: 'light', toggleTheme: () => undefined, applySettings: () => undefined });

export function SiteProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('inkfold_theme') as Theme) || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  useEffect(() => { contentApi.getSettings().then(setSettings).catch(err => setSettingsError(err instanceof Error ? err.message : '站点设置加载失败')).finally(() => setSettingsLoading(false)); }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('inkfold_theme', theme); }, [theme]);
  const value = useMemo(() => ({ settings, settingsLoading, settingsError, theme, toggleTheme: () => setTheme((current) => current === 'light' ? 'dark' : 'light'), applySettings: setSettings }), [settings, settingsLoading, settingsError, theme]);
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}
