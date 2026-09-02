import { useState, useEffect, useCallback, useRef } from 'react';
import { Societe, Personne, Famille, Prestation, Paiement, EnteteConfig, ActiveTab } from './types';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { Dashboard } from './components/Dashboard';
import { PrestationsView } from './components/PrestationsView';
import { PaiementsView } from './components/PaiementsView';
import { RejetsView } from './components/RejetsView';
import { HistoriqueView } from './components/HistoriqueView';
import { SocietesView } from './components/SocietesView';
import { PersonnesView } from './components/PersonnesView';
import { FamillesView } from './components/FamillesView';
import { EtatsView } from './components/EtatsView';
import { EnteteView } from './components/EnteteView';
import { generateMySQLDump } from './utils/sqlExporter';
import { checkWampDbConnection, fetchWampData, saveWampData, saveWampDataBulk, deleteWampData } from './utils/wampApi';
import {
  StorageMode,
  getStoredStorageMode,
  setStoredStorageMode,
  loadLocalDataset,
  saveLocalTable,
  backupServerDataToLocalStorage,
} from './utils/localPersistence';
import { ServerOff, RefreshCw, AlertTriangle, Database, Laptop, Building2, Filter, RotateCcw } from 'lucide-react';

export function App() {
  // Navigation & selection states
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [selectedSocieteId, setSelectedSocieteId] = useState<string>('ALL');
  const [selectedSubSocieteId, setSelectedSubSocieteId] = useState<string>('ALL');

  // Mode de stockage verrouillé sur 'server' (MySQL WAMP) pour la version wamp_deploy
  const [storageMode] = useState<StorageMode>('server');

  // Entête personnalisée
  const [enteteConfig, setEnteteConfig] = useState<EnteteConfig>(() => {
    const saved = localStorage.getItem('suivi_assurance_entete_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return {
      titrePrincipal: 'HÔPITALY LOTERANA TOLIARY TANAMBAO',
      sousTitre: 'FOIBE FANASITRANANA SALFA',
      adresse: 'B.P. 123, Tanambao, Toliara 601, Madagascar',
      contact: 'Tél: +261 20 94 412 34 | Email: contact@salfa-toliara.mg',
      nifStat: 'NIF: 1000234567 | STAT: 85111 21 1998 0 00123'
    };
  });

  // Dynamic favicon update
  useEffect(() => {
    if (enteteConfig?.logoUrl) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = enteteConfig.logoUrl;
    }
  }, [enteteConfig?.logoUrl]);

  // Database Connection blocking status (for Server mode)
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [dbError, setDbError] = useState<string | null>(null);
  const [isRetryingDb, setIsRetryingDb] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Data states
  const [societes, setSocietes] = useState<Societe[]>([]);
  const [personnes, setPersonnes] = useState<Personne[]>([]);
  const [familles, setFamilles] = useState<Famille[]>([]);
  const [prestations, setPrestations] = useState<Prestation[]>([]);
  const [paiements, setPaiements] = useState<Paiement[]>([]);

  // Computed values for selected societe and sub-societe filter
  const selectedSociete = societes.find(s => s.id === selectedSocieteId);

  // Collect unique sub-societies / services for the selected societe
  const availableSubSocietes = Array.from(
    new Set([
      ...(selectedSociete?.sousSocietes || []),
      ...prestations.filter(p => p.societeId === selectedSocieteId && p.sousSociete?.trim()).map(p => p.sousSociete.trim()),
      ...personnes.filter(p => p.societeId === selectedSocieteId && p.sousSociete?.trim()).map(p => p.sousSociete!.trim())
    ])
  ).filter(Boolean).sort();

  const selectedSubSociete = selectedSubSocieteId !== 'ALL' ? selectedSubSocieteId : undefined;

  // Modals quick trigger
  const [isPrestationModalOpen, setIsPrestationModalOpen] = useState(false);
  const [isPaiementModalOpen, setIsPaiementModalOpen] = useState(false);

  // Tracking if initial load completed
  const initialLoadRef = useRef(false);

  // Reconcile prestations strictly with active paiements list
  const reconcilePrestationsWithPaiements = useCallback((rawPrestations: Prestation[], currentPaiements: Paiement[]): Prestation[] => {
    return (rawPrestations || []).map(p => {
      const matchingLinesWithPayment: { lp: any; pm: Paiement }[] = [];
      const matchingBordereaux = new Set<string>();
      let latestDate = '';

      (currentPaiements || []).forEach(pm => {
        (pm.lignes || []).forEach(lp => {
          const matchByPrestId = Boolean(lp.prestationId && lp.prestationId === p.id);
          const matchByFacture = Boolean(
            lp.prestationNumero &&
            p.numeroFacture &&
            lp.prestationNumero.trim().toLowerCase() === p.numeroFacture.trim().toLowerCase()
          );
          const matchByLigneId = Boolean(
            lp.lignePrestationId && p.lignes?.some(l => l.id === lp.lignePrestationId)
          );

          if (matchByPrestId || matchByFacture || matchByLigneId) {
            matchingLinesWithPayment.push({ lp, pm });
            if (pm.numeroBordereau) {
              matchingBordereaux.add(pm.numeroBordereau);
            }
            if (pm.datePaiement && (!latestDate || pm.datePaiement > latestDate)) {
              latestDate = pm.datePaiement;
            }
          }
        });
      });

      const hasLignes = p.lignes && p.lignes.length > 0;
      let pTotalPaye = 0;
      let pTotalExclu = 0;

      const updatedLignes = (p.lignes || []).map(l => {
        let lTotalPaye = 0;
        let lTotalExclu = 0;

        matchingLinesWithPayment.forEach(({ lp }) => {
          const matchThisLine = (lp.lignePrestationId && lp.lignePrestationId === l.id) ||
            (!lp.lignePrestationId && p.lignes?.length === 1);

          if (matchThisLine) {
            const net = Number(lp.totalPaye ?? lp.montantPaye ?? 0);
            const exclu = Number(lp.montantExclu || 0);
            lTotalPaye += net;
            lTotalExclu += exclu;
          }
        });

        const lTot = (l as any).montantTotal ?? l.totalPrestation ?? 0;
        const lMod = l.ticketModerateur ?? 0;
        const lRemb = l.montantARembourser ?? Math.max(0, lTot - lMod);
        const lReste = Math.max(0, lRemb - lTotalPaye - lTotalExclu);
        const isLPaid = (lTotalPaye >= lRemb && lRemb > 0) || (lReste <= 0 && lTotalPaye > 0);
        const isLPart = lTotalPaye > 0 && !isLPaid && lReste > 0;
        const isLExcluded = lTotalExclu >= lRemb && lRemb > 0 && lTotalPaye === 0;

        const lStatut = isLExcluded ? 'Rejeté' : isLPaid ? 'Payé' : isLPart ? 'Partiellement payé' : 'En attente';

        pTotalPaye += lTotalPaye;
        pTotalExclu += lTotalExclu;

        return {
          ...l,
          totalPaye: lTotalPaye,
          montantExclu: lTotalExclu,
          resteAPayer: lReste,
          statut: lStatut as any,
        };
      });

      if (!hasLignes) {
        matchingLinesWithPayment.forEach(({ lp }) => {
          pTotalPaye += Number(lp.totalPaye ?? lp.montantPaye ?? 0);
          pTotalExclu += Number(lp.montantExclu || 0);
        });
      }

      const tot = p.montantTotal ?? p.totalPrestation ?? 0;
      const mod = p.ticketModerateur ?? p.participation ?? 0;
      const remb = p.montantARembourser ?? Math.max(0, tot - mod);
      const totalPaye = pTotalPaye;
      const totalExclu = pTotalExclu;
      const resteAPayer = Math.max(0, remb - totalPaye - totalExclu);

      const isFullyPaid = (totalPaye >= remb && remb > 0) || (resteAPayer <= 0 && totalPaye > 0);
      const isPartiallyPaid = totalPaye > 0 && !isFullyPaid && resteAPayer > 0;
      const isExcluded = totalExclu >= remb && remb > 0 && totalPaye === 0;

      const newNumeroBordereau = Array.from(matchingBordereaux).join(', ');

      return {
        ...p,
        totalPaye,
        montantExclu: totalExclu,
        resteAPayer,
        lignes: hasLignes ? updatedLignes : p.lignes,
        statut: isExcluded ? 'Rejeté' : isFullyPaid ? 'Payé' : isPartiallyPaid ? 'Partiellement payé' : 'En attente',
        datePaiement: latestDate || undefined,
        numeroBordereau: newNumeroBordereau || undefined,
      };
    });
  }, []);

  // Charger depuis le LocalStorage
  const loadFromLocalStorage = useCallback(() => {
    const local = loadLocalDataset();
    const reconciledPr = reconcilePrestationsWithPaiements(local.prestations, local.paiements);
    setSocietes(local.societes);
    setPersonnes(local.personnes);
    setFamilles(local.familles);
    setPrestations(reconciledPr);
    setPaiements(local.paiements);
    setDbStatus('connected');
    setDbError(null);
    setLastSyncTime(new Date());
  }, [reconcilePrestationsWithPaiements]);

  // Check database connection and load WAMP data directly from MySQL
  const checkAndLoadWampData = useCallback(async (silent: boolean = false) => {
    if (storageMode === 'local') {
      loadFromLocalStorage();
      return;
    }

    if (!silent) {
      setDbStatus('checking');
      setIsRetryingDb(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      const conn = await checkWampDbConnection();
      if (!conn.connected) {
        setDbStatus('error');
        setDbError(conn.error || 'Connexion à la base de données MySQL WAMP non établie.');
        if (!silent) setIsRetryingDb(false);
        setIsRefreshing(false);
        return;
      }

      setDbStatus('connected');
      setDbError(null);

      // Load all tables directly from MySQL
      const [sData, pData, fData, prData, paData] = await Promise.all([
        fetchWampData<Societe>('societes'),
        fetchWampData<Personne>('personnes'),
        fetchWampData<Famille>('familles'),
        fetchWampData<Prestation>('prestations'),
        fetchWampData<Paiement>('paiements')
      ]);

      const sArr = Array.isArray(sData) ? sData : [];
      const pArr = Array.isArray(pData) ? pData : [];
      const fArr = Array.isArray(fData) ? fData : [];
      const prArr = Array.isArray(prData) ? prData : [];
      const paArr = Array.isArray(paData) ? paData : [];

      const reconciledPr = reconcilePrestationsWithPaiements(prArr, paArr);

      setSocietes(sArr);
      setPersonnes(pArr);
      setFamilles(fArr);
      setPrestations(reconciledPr);
      setPaiements(paArr);

      // Mirror to LocalStorage in background
      backupServerDataToLocalStorage({
        societes: sArr,
        personnes: pArr,
        familles: fArr,
        prestations: reconciledPr,
        paiements: paArr,
      });

      setLastSyncTime(new Date());
    } catch (err: any) {
      console.error('Erreur chargement MySQL WAMP:', err);
      if (!silent) {
        setDbStatus('error');
        setDbError(err?.message || 'Erreur de lecture des données depuis la base de données MySQL WAMP.');
      }
    } finally {
      if (!silent) setIsRetryingDb(false);
      setIsRefreshing(false);
    }
  }, [storageMode, loadFromLocalStorage]);

  // Initial connection on mount
  useEffect(() => {
    if (!initialLoadRef.current) {
      initialLoadRef.current = true;
      if (storageMode === 'local') {
        loadFromLocalStorage();
      } else {
        checkAndLoadWampData(false);
      }
    }
  }, [storageMode, checkAndLoadWampData, loadFromLocalStorage]);

  // Real-time Multi-Poste Background Polling (every 6 seconds) + Re-sync on Window Focus (Server mode only)
  useEffect(() => {
    if (storageMode !== 'server') return;

    const interval = setInterval(() => {
      if (dbStatus === 'connected') {
        checkAndLoadWampData(true);
      }
    }, 6000);

    const handleFocus = () => {
      if (dbStatus === 'connected') {
        checkAndLoadWampData(true);
      }
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [storageMode, dbStatus, checkAndLoadWampData]);

  // Handlers for Prestations
  const handleSavePrestation = async (prestation: Prestation) => {
    try {
      if (storageMode === 'server') {
        await saveWampData('prestations', prestation);
      }
      setPrestations(prev => {
        const idx = prev.findIndex(p => p.id === prestation.id);
        const updated = idx >= 0 ? [...prev] : [prestation, ...prev];
        if (idx >= 0) updated[idx] = prestation;
        saveLocalTable('prestations', updated);
        return updated;
      });
      setLastSyncTime(new Date());
    } catch (err: any) {
      alert(`Erreur d'enregistrement : ${err.message || err}`);
    }
  };

  const handleDeletePrestation = async (id: string) => {
    try {
      if (storageMode === 'server') {
        await deleteWampData('prestations', id);
      }
      setPrestations(prev => {
        const updated = prev.filter(p => p.id !== id);
        saveLocalTable('prestations', updated);
        return updated;
      });
      setLastSyncTime(new Date());
    } catch (err: any) {
      alert(`Erreur de suppression : ${err.message || err}`);
    }
  };

  const handleDeleteFacture = async (numeroFacture: string) => {
    try {
      const cleanNum = (n: string) => (n || '').replace(/[\s\-\_\.\/]/g, '').toUpperCase();
      const target = cleanNum(numeroFacture);
      const toDelete = prestations.filter(p => cleanNum(p.numeroFacture) === target);

      if (storageMode === 'server') {
        await Promise.all(toDelete.map(p => deleteWampData('prestations', p.id)));
      }

      setPrestations(prev => {
        const updated = prev.filter(p => cleanNum(p.numeroFacture) !== target);
        saveLocalTable('prestations', updated);
        return updated;
      });
      setLastSyncTime(new Date());
    } catch (err: any) {
      alert(`Erreur de suppression de la facture : ${err.message || err}`);
    }
  };

  // Handlers for Paiements
  const handleSavePaiement = async (newPaiement: Paiement, updatedPrestations: Prestation[]) => {
    try {
      if (storageMode === 'server') {
        await saveWampData('paiements', newPaiement);
        if (updatedPrestations && updatedPrestations.length > 0) {
          await Promise.all(updatedPrestations.map(up => saveWampData('prestations', up)));
        }
      }

      setPaiements(prev => {
        const idx = prev.findIndex(p => p.id === newPaiement.id);
        const updated = idx >= 0 ? [...prev] : [newPaiement, ...prev];
        if (idx >= 0) updated[idx] = newPaiement;
        saveLocalTable('paiements', updated);
        return updated;
      });

      if (updatedPrestations && updatedPrestations.length > 0) {
        setPrestations(prev => {
          const updatedMap = new Map(updatedPrestations.map(p => [p.id, p]));
          const result = prev.map(p => updatedMap.has(p.id) ? updatedMap.get(p.id)! : p);
          updatedPrestations.forEach(up => {
            if (!prev.some(p => p.id === up.id)) {
              result.unshift(up);
            }
          });
          saveLocalTable('prestations', result);
          return result;
        });
      }
      setLastSyncTime(new Date());
    } catch (err: any) {
      alert(`Erreur d'enregistrement du paiement : ${err.message || err}`);
    }
  };

  const handleDeletePaiement = async (id: string) => {
    try {
      if (storageMode === 'server') {
        await deleteWampData('paiements', id);
      }
      const remainingPaiements = paiements.filter(p => p.id !== id);
      setPaiements(remainingPaiements);
      saveLocalTable('paiements', remainingPaiements);

      const reconciled = reconcilePrestationsWithPaiements(prestations, remainingPaiements);
      setPrestations(reconciled);
      saveLocalTable('prestations', reconciled);

      if (storageMode === 'server' && reconciled.length > 0) {
        await Promise.all(reconciled.map(up => saveWampData('prestations', up)));
      }
      setLastSyncTime(new Date());
    } catch (err: any) {
      alert(`Erreur de suppression du paiement : ${err.message || err}`);
    }
  };

  // Handlers for Societes
  const handleSaveSociete = async (societe: Societe) => {
    try {
      if (storageMode === 'server') {
        await saveWampData('societes', societe);
      }
      setSocietes(prev => {
        const idx = prev.findIndex(s => s.id === societe.id);
        const updated = idx >= 0 ? [...prev] : [...prev, societe];
        if (idx >= 0) updated[idx] = societe;
        saveLocalTable('societes', updated);
        return updated;
      });
      setLastSyncTime(new Date());
    } catch (err: any) {
      alert(`Erreur enregistrement société : ${err.message || err}`);
    }
  };

  const handleDeleteSociete = async (id: string) => {
    try {
      if (storageMode === 'server') {
        await deleteWampData('societes', id);
      }
      setSocietes(prev => {
        const updated = prev.filter(s => s.id !== id);
        saveLocalTable('societes', updated);
        return updated;
      });
      setLastSyncTime(new Date());
    } catch (err: any) {
      alert(`Erreur suppression société : ${err.message || err}`);
    }
  };

  // Handler for Regrouping / Merging Sub-Societés
  const handleMergeSubSocietes = async (
    societeId: string,
    sourceNames: string[],
    targetName: string
  ) => {
    const cleanTarget = targetName.trim();
    if (!cleanTarget || sourceNames.length === 0) return;

    const normalizedSources = sourceNames.map(s => s.toLowerCase().trim());

    // Find matching societe object to handle both id and name comparisons
    const targetSocObj = societes.find(s => s.id === societeId);
    const socNameLower = targetSocObj ? targetSocObj.nom.toLowerCase().trim() : '';

    // 1. Update Prestations
    const updatedPrestations: Prestation[] = [];
    const nextPrestations = prestations.map(p => {
      const pSocId = (p.societeId || '').toLowerCase().trim();
      const pSocNom = (p.societeNom || '').toLowerCase().trim();
      const matchesSoc = pSocId === societeId.toLowerCase() || (socNameLower && pSocNom === socNameLower);

      if (matchesSoc && p.sousSociete && normalizedSources.includes(p.sousSociete.toLowerCase().trim())) {
        const up = { ...p, sousSociete: cleanTarget };
        updatedPrestations.push(up);
        return up;
      }
      return p;
    });

    // 2. Update Personnes
    const updatedPersonnes: Personne[] = [];
    const nextPersonnes = personnes.map(p => {
      const pSocId = (p.societeId || '').toLowerCase().trim();
      const matchesSoc = pSocId === societeId.toLowerCase();

      if (matchesSoc && p.sousSociete && normalizedSources.includes(p.sousSociete.toLowerCase().trim())) {
        const up = { ...p, sousSociete: cleanTarget };
        updatedPersonnes.push(up);
        return up;
      }
      return p;
    });

    // 3. Update Societe's sousSocietes list
    let updatedSociete: Societe | null = null;
    if (targetSocObj) {
      const existingList = targetSocObj.sousSocietes || [];
      const filteredList = existingList.filter(s => !normalizedSources.includes(s.toLowerCase().trim()));
      if (!filteredList.some(s => s.toLowerCase().trim() === cleanTarget.toLowerCase())) {
        filteredList.push(cleanTarget);
      }
      filteredList.sort();
      updatedSociete = { ...targetSocObj, sousSocietes: filteredList };
    }

    try {
      if (storageMode === 'server') {
        if (updatedPrestations.length > 0) {
          await saveWampDataBulk('prestations', updatedPrestations);
        }
        if (updatedPersonnes.length > 0) {
          await saveWampDataBulk('personnes', updatedPersonnes);
        }
        if (updatedSociete) {
          await saveWampData('societes', updatedSociete);
        }
      }

      if (updatedPrestations.length > 0) {
        setPrestations(nextPrestations);
        saveLocalTable('prestations', nextPrestations);
      }
      if (updatedPersonnes.length > 0) {
        setPersonnes(nextPersonnes);
        saveLocalTable('personnes', nextPersonnes);
      }
      if (updatedSociete) {
        setSocietes(prev => {
          const updated = prev.map(s => s.id === societeId ? updatedSociete! : s);
          saveLocalTable('societes', updated);
          return updated;
        });
      }

      setLastSyncTime(new Date());
    } catch (err: any) {
      alert(`Erreur lors du regroupement des sous-sociétés : ${err.message || err}`);
    }
  };

  // Handlers for Personnes
  const handleSavePersonne = async (personne: Personne) => {
    try {
      if (storageMode === 'server') {
        await saveWampData('personnes', personne);
      }
      setPersonnes(prev => {
        const idx = prev.findIndex(p => p.id === personne.id);
        const updated = idx >= 0 ? [...prev] : [...prev, personne];
        if (idx >= 0) updated[idx] = personne;
        saveLocalTable('personnes', updated);
        return updated;
      });
      setLastSyncTime(new Date());
    } catch (err: any) {
      alert(`Erreur enregistrement adhérent : ${err.message || err}`);
    }
  };

  const handleDeletePersonne = async (id: string) => {
    try {
      if (storageMode === 'server') {
        await deleteWampData('personnes', id);
      }
      setPersonnes(prev => {
        const updated = prev.filter(p => p.id !== id);
        saveLocalTable('personnes', updated);
        return updated;
      });
      setLastSyncTime(new Date());
    } catch (err: any) {
      alert(`Erreur suppression adhérent : ${err.message || err}`);
    }
  };

  // Handlers for Familles
  const handleSaveFamille = async (famille: Famille) => {
    try {
      if (storageMode === 'server') {
        await saveWampData('familles', famille);
      }
      setFamilles(prev => {
        const idx = prev.findIndex(f => f.id === famille.id);
        const updated = idx >= 0 ? [...prev] : [...prev, famille];
        if (idx >= 0) updated[idx] = famille;
        saveLocalTable('familles', updated);
        return updated;
      });
      setLastSyncTime(new Date());
    } catch (err: any) {
      alert(`Erreur enregistrement famille : ${err.message || err}`);
    }
  };

  const handleDeleteFamille = async (id: string) => {
    try {
      if (storageMode === 'server') {
        await deleteWampData('familles', id);
      }
      setFamilles(prev => {
        const updated = prev.filter(f => f.id !== id);
        saveLocalTable('familles', updated);
        return updated;
      });
      setLastSyncTime(new Date());
    } catch (err: any) {
      alert(`Erreur suppression famille : ${err.message || err}`);
    }
  };

  // Bulk Import Handlers
  const handleImportPrestations = async (
    newPrestations: Prestation[],
    newSocietes?: Societe[],
    newPersonnes?: Personne[]
  ) => {
    try {
      if (newSocietes && newSocietes.length > 0) {
        if (storageMode === 'server') await saveWampDataBulk('societes', newSocietes);
        setSocietes(prev => {
          const copy = [...prev];
          newSocietes.forEach(ns => {
            const idx = copy.findIndex(s => s.id === ns.id);
            if (idx >= 0) copy[idx] = ns;
            else copy.push(ns);
          });
          saveLocalTable('societes', copy);
          return copy;
        });
      }

      if (newPersonnes && newPersonnes.length > 0) {
        if (storageMode === 'server') await saveWampDataBulk('personnes', newPersonnes);
        setPersonnes(prev => {
          const copy = [...prev];
          newPersonnes.forEach(np => {
            const idx = copy.findIndex(p => p.id === np.id);
            if (idx >= 0) copy[idx] = np;
            else copy.push(np);
          });
          saveLocalTable('personnes', copy);
          return copy;
        });
      }

      if (storageMode === 'server') {
        await saveWampDataBulk('prestations', newPrestations);
      }

      setPrestations(prev => {
        const copy = [...prev];
        newPrestations.forEach(np => {
          const idx = copy.findIndex(p => p.id === np.id);
          if (idx >= 0) copy[idx] = np;
          else copy.unshift(np);
        });
        saveLocalTable('prestations', copy);
        return copy;
      });

      setActiveTab('prestations');
      setLastSyncTime(new Date());
    } catch (err: any) {
      alert(`Erreur lors de l'import des prestations : ${err.message || err}`);
    }
  };

  const handleImportPaiements = async (
    newPaiement: Paiement,
    updatedPrestations: Prestation[],
    newSocietes?: Societe[],
    newPersonnes?: Personne[]
  ) => {
    try {
      if (storageMode === 'server') {
        await saveWampData('paiements', newPaiement);
        if (updatedPrestations && updatedPrestations.length > 0) {
          await saveWampDataBulk('prestations', updatedPrestations);
        }
        if (newSocietes && newSocietes.length > 0) {
          await saveWampDataBulk('societes', newSocietes);
        }
        if (newPersonnes && newPersonnes.length > 0) {
          await saveWampDataBulk('personnes', newPersonnes);
        }
      }

      if (newSocietes && newSocietes.length > 0) {
        setSocietes(prev => {
          const copy = [...prev];
          newSocietes.forEach(ns => {
            const idx = copy.findIndex(s => s.id === ns.id);
            if (idx >= 0) copy[idx] = ns;
            else copy.push(ns);
          });
          saveLocalTable('societes', copy);
          return copy;
        });
      }

      if (newPersonnes && newPersonnes.length > 0) {
        setPersonnes(prev => {
          const copy = [...prev];
          newPersonnes.forEach(np => {
            const idx = copy.findIndex(p => p.id === np.id);
            if (idx >= 0) copy[idx] = np;
            else copy.push(np);
          });
          saveLocalTable('personnes', copy);
          return copy;
        });
      }

      setPaiements(prev => {
        const copy = [newPaiement, ...prev.filter(p => p.id !== newPaiement.id)];
        saveLocalTable('paiements', copy);
        return copy;
      });

      setPrestations(prev => {
        const updatedMap = new Map(updatedPrestations.map(p => [p.id, p]));
        const result = prev.map(p => updatedMap.has(p.id) ? updatedMap.get(p.id)! : p);
        updatedPrestations.forEach(up => {
          if (!prev.some(p => p.id === up.id)) {
            result.unshift(up);
          }
        });
        saveLocalTable('prestations', result);
        return result;
      });

      setActiveTab('paiements');
      setLastSyncTime(new Date());
    } catch (err: any) {
      alert(`Erreur lors de l'import des paiements : ${err.message || err}`);
    }
  };

  const handleExportBackup = () => {
    const data = { societes, personnes, familles, prestations, paiements };
    const sqlContent = generateMySQLDump(data);
    const blob = new Blob([sqlContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `suivi_assurance_salfa_dump_${new Date().toISOString().split('T')[0]}.sql`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Blocked / Fallback screen when in Server mode and MySQL is unreachable
  if (storageMode === 'server' && dbStatus === 'error') {
    return (
      <div className="fixed inset-0 z-[9999] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 font-sans antialiased select-none">
        <div className="max-w-xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
          <div className="bg-rose-600 px-6 py-5 text-white flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/10 backdrop-blur-md shrink-0">
              <ServerOff className="h-7 w-7 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Base MySQL Inaccessible</h2>
              <p className="text-xs text-rose-100">Serveur WAMP MySQL Multi-Poste</p>
            </div>
          </div>

          <div className="p-6 space-y-5">
            <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 space-y-2">
              <div className="flex items-center gap-2 text-rose-950 font-bold text-xs">
                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>Raison de l'interruption :</span>
              </div>
              <p className="text-xs text-rose-900 leading-relaxed font-mono bg-white/80 p-3 rounded-xl border border-rose-200 break-words">
                {dbError || 'Impossible de se connecter au serveur MySQL WAMP (suivi_assurance_salfa).'}
              </p>
            </div>

            <div className="space-y-2 text-xs text-slate-700">
              <h4 className="font-bold text-slate-900">Que faire ?</h4>
              <p className="text-slate-600 leading-relaxed">
                Vérifiez que WAMP Server est démarré (icône verte) et que MySQL est accessible, puis cliquez sur Réessayer.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => checkAndLoadWampData(false)}
                disabled={isRetryingDb}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${isRetryingDb ? 'animate-spin' : ''}`} />
                <span>{isRetryingDb ? 'Vérification...' : 'Réessayer MySQL'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (storageMode === 'server' && dbStatus === 'checking') {
    return (
      <div className="fixed inset-0 z-[9999] bg-slate-900 flex flex-col items-center justify-center p-4 text-white font-sans">
        <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md mb-4 animate-bounce">
          <Database className="h-8 w-8 text-emerald-400" />
        </div>
        <h2 className="text-base font-bold">Connexion à la base de données MySQL WAMP...</h2>
        <p className="text-xs text-slate-400 mt-1">Synchronisation directe avec le serveur central</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 antialiased">
      {/* Top Header */}
      <Header
        societes={societes}
        selectedSocieteId={selectedSocieteId}
        onSelectSociete={setSelectedSocieteId}
        onExportBackup={handleExportBackup}
        onRefreshData={() => checkAndLoadWampData(true)}
        isRefreshing={isRefreshing}
        lastSyncTime={lastSyncTime}
        dbConnected={dbStatus === 'connected'}
        logoUrl={enteteConfig.logoUrl}
      />

      {/* BANDEAU DU FILTRE AVANCÉ : SOCIÉTÉ / GARANT (TRANSPARENT, ANCRÉ À GAUCHE) */}
      <div id="advanced-filter-banner" className="bg-transparent text-slate-900 border-b border-slate-200 px-4 py-2.5 sm:px-6 lg:px-8 relative z-20">
        <div className="max-w-7xl flex flex-col md:flex-row md:items-center justify-start gap-4 md:gap-8">
          
          {/* Intitulé et statut */}
          <div className="flex items-center space-x-3 shrink-0">
            <div className="p-2 rounded-xl bg-indigo-100/80 border border-indigo-200 text-indigo-700 shadow-xs">
              <Filter className="w-4.5 h-4.5 text-indigo-600" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-950">
                  Filtre Avancé
                </span>
                {selectedSocieteId !== 'ALL' ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-xs">
                    Filtre actif
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-200/70 text-slate-700 border border-slate-300">
                    Vue Globale (Tous les Garants)
                  </span>
                )}
              </div>
              <p className="text-xs font-semibold text-slate-600 mt-0.5">
                Périmètre : <strong className="text-slate-900">{selectedSociete ? selectedSociete.nom : 'Tous les Garants'}</strong>
              </p>
            </div>
          </div>

          {/* Formulaire des Sélecteurs */}
          <div className="flex flex-wrap items-center gap-2">
            {/* 1. Sélecteur Société / Garant */}
            <div className="flex items-center bg-white rounded-xl p-1 border border-slate-300 shadow-xs">
              <span className="text-[11px] font-bold text-slate-700 px-2 flex items-center gap-1.5 whitespace-nowrap">
                <Building2 className="w-3.5 h-3.5 text-rose-600" />
                Société / Garant :
              </span>
              <select
                id="select-filter-societe"
                value={selectedSocieteId}
                onChange={(e) => {
                  setSelectedSocieteId(e.target.value);
                  setSelectedSubSocieteId('ALL');
                }}
                className="bg-slate-50 text-slate-900 text-xs font-bold rounded-lg px-2.5 py-1.5 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-400 cursor-pointer"
              >
                <option value="ALL">Tous les Garants ({societes.length})</option>
                {societes.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.nom} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Bouton Réinitialiser */}
            {selectedSocieteId !== 'ALL' && (
              <button
                id="btn-reset-filter"
                type="button"
                onClick={() => {
                  setSelectedSocieteId('ALL');
                  setSelectedSubSocieteId('ALL');
                }}
                className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-xs font-bold transition flex items-center space-x-1 cursor-pointer shadow-xs"
                title="Réinitialiser pour afficher tous les garants"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Réinitialiser</span>
              </button>
            )}
          </div>

        </div>
      </div>

      {/* Navigation Tab Bar */}
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Content Area */}
      <main className="w-full min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
        {activeTab === 'dashboard' && (
          <Dashboard
            prestations={prestations}
            paiements={paiements}
            societes={societes}
            personnes={personnes}
            selectedSocieteId={selectedSocieteId}
            onNavigate={(tab) => setActiveTab(tab)}
            onOpenNewPrestation={() => {
              setActiveTab('prestations');
              setIsPrestationModalOpen(true);
            }}
            onOpenNewPaiement={() => {
              setActiveTab('paiements');
              setIsPaiementModalOpen(true);
            }}
          />
        )}

        {activeTab === 'prestations' && (
          <PrestationsView
            prestations={prestations}
            paiements={paiements}
            societes={societes}
            personnes={personnes}
            familles={familles}
            selectedSocieteId={selectedSocieteId}
            selectedSubSocieteId={selectedSubSocieteId}
            onSavePrestation={handleSavePrestation}
            onDeletePrestation={handleDeletePrestation}
            onDeleteFacture={handleDeleteFacture}
            onImportPrestations={handleImportPrestations}
            onSavePaiement={handleSavePaiement}
            isCreateModalOpen={isPrestationModalOpen}
            setIsCreateModalOpen={setIsPrestationModalOpen}
          />
        )}

        {activeTab === 'paiements' && (
          <PaiementsView
            paiements={paiements}
            prestations={prestations}
            societes={societes}
            personnes={personnes}
            familles={familles}
            selectedSocieteId={selectedSocieteId}
            onSavePaiement={handleSavePaiement}
            onDeletePaiement={handleDeletePaiement}
            onImportPaiements={handleImportPaiements}
            isCreateModalOpen={isPaiementModalOpen}
            setIsCreateModalOpen={setIsPaiementModalOpen}
          />
        )}

        {activeTab === 'rejets' && (
          <RejetsView
            prestations={prestations}
            paiements={paiements}
            societes={societes}
            personnes={personnes}
            familles={familles}
            selectedSocieteId={selectedSocieteId}
            onSavePrestation={handleSavePrestation}
          />
        )}

        {activeTab === 'historique' && (
          <HistoriqueView
            paiements={paiements}
            societes={societes}
            selectedSocieteId={selectedSocieteId}
          />
        )}

        {activeTab === 'societes' && (
          <SocietesView
            societes={societes}
            prestations={prestations}
            personnes={personnes}
            onSaveSociete={handleSaveSociete}
            onDeleteSociete={handleDeleteSociete}
            onMergeSubSocietes={handleMergeSubSocietes}
          />
        )}

        {activeTab === 'personnes' && (
          <PersonnesView
            personnes={personnes}
            societes={societes}
            familles={familles}
            selectedSocieteId={selectedSocieteId}
            onSavePersonne={handleSavePersonne}
            onDeletePersonne={handleDeletePersonne}
          />
        )}

        {activeTab === 'familles' && (
          <FamillesView
            familles={familles}
            onSaveFamille={handleSaveFamille}
            onDeleteFamille={handleDeleteFamille}
          />
        )}

        {activeTab === 'etats' && (
          <EtatsView
            prestations={prestations}
            paiements={paiements}
            societes={societes}
            personnes={personnes}
            familles={familles}
            selectedSocieteId={selectedSocieteId}
          />
        )}

        {activeTab === 'entete' && (
          <EnteteView onConfigChange={setEnteteConfig} />
        )}
      </main>
    </div>
  );
}

export default App;
