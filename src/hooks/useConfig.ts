import { useState } from 'react';
import { DEFAULT_CONFIG, type AppConfig } from '../types';

const STORAGE_KEY = 'elared_config';

export function useConfig() {
  const [config, setConfig] = useState<AppConfig>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? { ...DEFAULT_CONFIG, ...JSON.parse(raw) } : DEFAULT_CONFIG;
    } catch {
      return DEFAULT_CONFIG;
    }
  });

  const saveConfig = (newConfig: AppConfig) => {
    setConfig(newConfig);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
  };

  return { config, saveConfig };
}
