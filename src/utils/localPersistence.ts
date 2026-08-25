import { Societe, Personne, Famille, Prestation, Paiement } from '../types';
import { initialSocietes, initialFamilles } from '../data/initialData';

const STORAGE_KEYS = {
  SOCIETES: 'salfa_local_societes',
  PERSONNES: 'salfa_local_personnes',
  FAMILLES: 'salfa_local_familles',
  PRESTATIONS: 'salfa_local_prestations',
  PAIEMENTS: 'salfa_local_paiements',
  STORAGE_MODE: 'salfa_storage_mode', // 'server' | 'local'
};

export type StorageMode = 'server' | 'local';

export function getStoredStorageMode(): StorageMode {
  const mode = localStorage.getItem(STORAGE_KEYS.STORAGE_MODE);
  return mode === 'local' ? 'local' : 'server';
}

export function setStoredStorageMode(mode: StorageMode): void {
  localStorage.setItem(STORAGE_KEYS.STORAGE_MODE, mode);
}

export function loadLocalDataset(): {
  societes: Societe[];
  personnes: Personne[];
  familles: Famille[];
  prestations: Prestation[];
  paiements: Paiement[];
} {
  try {
    const sRaw = localStorage.getItem(STORAGE_KEYS.SOCIETES);
    const pRaw = localStorage.getItem(STORAGE_KEYS.PERSONNES);
    const fRaw = localStorage.getItem(STORAGE_KEYS.FAMILLES);
    const prRaw = localStorage.getItem(STORAGE_KEYS.PRESTATIONS);
    const paRaw = localStorage.getItem(STORAGE_KEYS.PAIEMENTS);

    const societes: Societe[] = sRaw ? JSON.parse(sRaw) : initialSocietes;
    const personnes: Personne[] = pRaw ? JSON.parse(pRaw) : [];
    const familles: Famille[] = fRaw ? JSON.parse(fRaw) : initialFamilles;
    const prestations: Prestation[] = prRaw ? JSON.parse(prRaw) : [];
    const paiements: Paiement[] = paRaw ? JSON.parse(paRaw) : [];

    return { societes, personnes, familles, prestations, paiements };
  } catch (err) {
    console.error('Erreur lecture localStorage SALFA:', err);
    return {
      societes: initialSocietes,
      personnes: [],
      familles: initialFamilles,
      prestations: [],
      paiements: [],
    };
  }
}

export function saveLocalTable<T = any>(table: 'societes' | 'personnes' | 'familles' | 'prestations' | 'paiements', items: T[]): void {
  try {
    const keyMap = {
      societes: STORAGE_KEYS.SOCIETES,
      personnes: STORAGE_KEYS.PERSONNES,
      familles: STORAGE_KEYS.FAMILLES,
      prestations: STORAGE_KEYS.PRESTATIONS,
      paiements: STORAGE_KEYS.PAIEMENTS,
    };
    const key = keyMap[table];
    if (key) {
      localStorage.setItem(key, JSON.stringify(items));
    }
  } catch (err) {
    console.error(`Erreur écriture localStorage sur ${table}:`, err);
  }
}

export function backupServerDataToLocalStorage(data: {
  societes: Societe[];
  personnes: Personne[];
  familles: Famille[];
  prestations: Prestation[];
  paiements: Paiement[];
}): void {
  if (data.societes) saveLocalTable('societes', data.societes);
  if (data.personnes) saveLocalTable('personnes', data.personnes);
  if (data.familles) saveLocalTable('familles', data.familles);
  if (data.prestations) saveLocalTable('prestations', data.prestations);
  if (data.paiements) saveLocalTable('paiements', data.paiements);
}
