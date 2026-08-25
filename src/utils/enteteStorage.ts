import { EnteteConfig, defaultEnteteConfig } from '../types';

const STORAGE_KEY = 'suivi_assurance_entete_config';

export function getStoredEnteteConfig(): EnteteConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultEnteteConfig;
    const parsed = JSON.parse(raw);
    return { ...defaultEnteteConfig, ...parsed };
  } catch {
    return defaultEnteteConfig;
  }
}

export function saveStoredEnteteConfig(config: EnteteConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    console.error('Error saving entete config:', err);
  }
}

export function resetStoredEnteteConfig(): EnteteConfig {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
  return defaultEnteteConfig;
}
