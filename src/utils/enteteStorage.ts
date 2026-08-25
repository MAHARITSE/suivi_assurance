/**
 * Gestion de la configuration de l'en-tête (logo, établissement, styles…).
 *
 * - VERSION WAMP (npm run build:wamp) : STRICTEMENT MYSQL — la configuration
 *   est persistée dans la table `parametres` de la base MySQL WAMP. Un cache
 *   mémoire synchrone (rechargé depuis MySQL au démarrage) sert les lectures.
 *
 * - AUTRES VERSIONS (dev / preview / hébergé) : comportement d'origine,
 *   persistance dans localStorage du navigateur.
 */

import { EnteteConfig, defaultEnteteConfig } from '../types';
import { IS_WAMP_BUILD } from './buildTarget';
import { fetchWampParametre, saveWampParametre } from './wampApi';

const STORAGE_KEY = 'suivi_assurance_entete_config';
const PARAM_KEY = 'entete_config';

/** Cache mémoire (synchrone) alimenté depuis MySQL — utilisé en version WAMP. */
let cache: EnteteConfig = { ...defaultEnteteConfig };
let loadedFromDb = false;

export function getStoredEnteteConfig(): EnteteConfig {
  if (IS_WAMP_BUILD) {
    // Version WAMP : lecture du cache alimenté STRICTEMENT depuis MySQL
    return cache;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultEnteteConfig;
    const parsed = JSON.parse(raw);
    return { ...defaultEnteteConfig, ...parsed };
  } catch {
    return defaultEnteteConfig;
  }
}

/** Indique si la configuration a déjà été chargée depuis MySQL (version WAMP). */
export function isEnteteConfigLoaded(): boolean {
  return IS_WAMP_BUILD ? loadedFromDb : true;
}

/**
 * Charge la configuration en-tête depuis MySQL (table `parametres`).
 * N'a d'effet qu'en version WAMP ; ailleurs, renvoie la config locale.
 */
export async function loadEnteteConfigFromDb(): Promise<EnteteConfig> {
  if (!IS_WAMP_BUILD) {
    return getStoredEnteteConfig();
  }
  try {
    const data = await fetchWampParametre<Partial<EnteteConfig>>(PARAM_KEY);
    if (data && typeof data === 'object') {
      cache = { ...defaultEnteteConfig, ...data };
    } else {
      cache = { ...defaultEnteteConfig };
    }
  } catch (err) {
    console.error('[enteteStorage] Erreur de chargement depuis MySQL:', err);
    cache = { ...defaultEnteteConfig };
  }
  loadedFromDb = true;
  return cache;
}

/**
 * Enregistre la configuration.
 * Version WAMP : écriture dans MySQL (table `parametres`).
 * Autres versions : écriture dans localStorage.
 */
export async function saveStoredEnteteConfig(config: EnteteConfig): Promise<boolean> {
  if (IS_WAMP_BUILD) {
    cache = { ...config };
    const ok = await saveWampParametre(PARAM_KEY, config);
    if (!ok) {
      console.error('[enteteStorage] Échec de l\'enregistrement de la configuration dans MySQL.');
    }
    return ok;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    return true;
  } catch (err) {
    console.error('Error saving entete config:', err);
    return false;
  }
}

/** Réinitialise l'en-tête avec les valeurs par défaut SALFA. */
export function resetStoredEnteteConfig(): EnteteConfig {
  const def = { ...defaultEnteteConfig };
  if (IS_WAMP_BUILD) {
    cache = def;
    void saveWampParametre(PARAM_KEY, def);
    return def;
  }
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
  return def;
}
