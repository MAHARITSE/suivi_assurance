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
import { ServerOff, RefreshCw, AlertTriangle, Database, HardDrive, ArrowLeftRight } from 'lucide-react';

export function App() {
  // Navigation & selection states
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [selectedSocieteId, setSelectedSocieteId] = useState<string>('ALL');

  // Storage Mode State: 'server' (MySQL WAMP) vs 'local' (LocalStorage)
  const [storageMode, setStorageMode] = useState<StorageMode>(() => getStoredStorageMode());

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

  // Modals quick trigger
  const [isPrestationModalOpen, setIsPrestationModalOpen] = useState(false);
  const [isPaiementModalOpen, setIsPaiementModalOpen] = useState(false);

  // Tracking if initial load completed
  const initialLoadRef = useRef(false);

  // Load from LocalStorage
  const loadFromLocalStorage = useCallback(() => {
    const local = loadLocalDataset();
    setSocietes(local.societes);
    setPersonnes(local.personnes);
    setFamilles(local.familles);
    setPrestations(local.prestations);
    setPaiements(local.paiements);
    setDbStatus('connected');
    setLastSyncTime(new Date());
  }, []);

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

      setSocietes(sArr);
      setPersonnes(pArr);
      setFamilles(fArr);
      setPrestations(prArr);
      setPaiements(paArr);

      // Backup into LocalStorage in background
      backupServerDataToLocalStorage({
        societes: sArr,
        personnes: pArr,
        familles: fArr,
        prestations: prArr,
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

  // Mode Switcher Handler
  const handleToggleStorageMode = (newMode: StorageMode) => {
    setStorageMode(newMode);
    setStoredStorageMode(newMode);
    if (newMode === 'local') {
      loadFromLocalStorage();
    } else {
      checkAndLoadWampData(false);
    }
  };

  // Sync Local data to Server (MySQL)
  const handleSyncLocalToServer = async () => {
    const local = loadLocalDataset();
    const count = local.prestations.length + local.societes.length + local.personnes.length + local.paiements.length;
    if (count === 0) {
      alert('Aucune donnée locale à transférer vers MySQL.');
      return;
    }

    const confirmTransfer = window.confirm(
      `Voulez-vous transférer toutes les données locales vers le serveur MySQL ?\n` +
      `- ${local.societes.length} société(s)\n` +
      `- ${local.personnes.length} adhérent(s)\n` +
      `- ${local.prestations.length} prestation(s)\n` +
      `- ${local.paiements.length} règlement(s)`
    );

    if (!confirmTransfer) return;

    try {
      setIsRefreshing(true);
      if (local.societes.length > 0) await saveWampDataBulk('societes', local.societes);
      if (local.familles.length > 0) await saveWampDataBulk('familles', local.familles);
      if (local.personnes.length > 0) await saveWampDataBulk('personnes', local.personnes);
      if (local.prestations.length > 0) await saveWampDataBulk('prestations', local.prestations);
      if (local.paiements.length > 0) await saveWampDataBulk('paiements', local.paiements);

      alert('Synchronisation vers le serveur MySQL WAMP réussie !');
      handleToggleStorageMode('server');
    } catch (err: any) {
      alert(`Erreur lors du transfert vers MySQL : ${err.message || err}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Copy Server (MySQL) data to LocalStorage
  const handleSyncServerToLocal = () => {
    backupServerDataToLocalStorage({
      societes,
      personnes,
      familles,
      prestations,
      paiements,
    });
    alert(`Copie locale mise à jour avec succès (${prestations.length} prestations, ${paiements.length} paiements).`);
  };

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

      // Recompute payment states
      const remainingPaidMap = new Map<string, { totalPaye: number; totalExclu: number; bordereaux: string[]; latestDate: string }>();
      const remainingLinePaidMap = new Map<string, { totalPaye: number; totalExclu: number }>();

      remainingPaiements.forEach(pm => {
        (pm.lignes || []).forEach(lp => {
          const net = Number(lp.totalPaye ?? lp.montantPaye ?? 0);
          const exclu = Number(lp.montantExclu || 0);
          const pId = lp.prestationId;
          const lId = lp.lignePrestationId;

          if (pId) {
            const current = remainingPaidMap.get(pId) || { totalPaye: 0, totalExclu: 0, bordereaux: [], latestDate: '' };
            current.totalPaye += net;
            current.totalExclu += exclu;
            if (pm.numeroBordereau && !current.bordereaux.includes(pm.numeroBordereau)) {
              current.bordereaux.push(pm.numeroBordereau);
            }
            if (pm.datePaiement && (!current.latestDate || pm.datePaiement > current.latestDate)) {
              current.latestDate = pm.datePaiement;
            }
            remainingPaidMap.set(pId, current);
          }

          if (lId) {
            const lCurrent = remainingLinePaidMap.get(lId) || { totalPaye: 0, totalExclu: 0 };
            lCurrent.totalPaye += net;
            lCurrent.totalExclu += exclu;
            remainingLinePaidMap.set(lId, lCurrent);
          }
        });
      });

      const updatedPrestationsToSave: Prestation[] = [];
      setPrestations(prev => {
        const updated = prev.map(p => {
          const pPaidData = remainingPaidMap.get(p.id) || { totalPaye: 0, totalExclu: 0, bordereaux: [], latestDate: '' };
          let linesTotalPaye = 0;
          let linesTotalExclu = 0;

          const updatedLignes = (p.lignes || []).map(l => {
            const lPaidData = remainingLinePaidMap.get(l.id) || { totalPaye: 0, totalExclu: 0 };
            const lTot = (l as any).montantTotal ?? l.totalPrestation ?? 0;
            const lMod = l.ticketModerateur ?? 0;
            const lRemb = l.montantARembourser ?? Math.max(0, lTot - lMod);
            const lReste = Math.max(0, lRemb - lPaidData.totalPaye - lPaidData.totalExclu);
            const isLPaid = (lPaidData.totalPaye >= lRemb && lRemb > 0) || (lReste <= 0 && lPaidData.totalPaye > 0);
            const isLPart = lPaidData.totalPaye > 0 && !isLPaid && lReste > 0;
            const isLExcluded = lPaidData.totalExclu >= lRemb && lRemb > 0 && lPaidData.totalPaye === 0;

            const lStatut = isLExcluded ? 'Rejeté' : isLPaid ? 'Payé' : isLPart ? 'Partiellement payé' : 'En attente';
            linesTotalPaye += lPaidData.totalPaye;
            linesTotalExclu += lPaidData.totalExclu;

            return {
              ...l,
              totalPaye: lPaidData.totalPaye,
              statut: lStatut as any,
            };
          });

          const totalPaye = Math.max(pPaidData.totalPaye, linesTotalPaye);
          const totalExclu = Math.max(pPaidData.totalExclu, linesTotalExclu);
          const tot = p.montantTotal ?? p.totalPrestation ?? 0;
          const mod = p.ticketModerateur ?? p.participation ?? 0;
          const remb = p.montantARembourser ?? Math.max(0, tot - mod);
          const resteAPayer = Math.max(0, remb - totalPaye - totalExclu);

          const isFullyPaid = (totalPaye >= remb && remb > 0) || (resteAPayer <= 0 && totalPaye > 0);
          const isPartiallyPaid = totalPaye > 0 && !isFullyPaid && resteAPayer > 0;
          const isExcluded = totalExclu >= remb && remb > 0 && totalPaye === 0;

          const updatedP: Prestation = {
            ...p,
            totalPaye,
            resteAPayer,
            lignes: updatedLignes,
            statut: isExcluded ? 'Rejeté' : isFullyPaid ? 'Payé' : isPartiallyPaid ? 'Partiellement payé' : 'En attente',
            datePaiement: pPaidData.latestDate || undefined,
          };

          updatedPrestationsToSave.push(updatedP);
          return updatedP;
        });

        saveLocalTable('prestations', updated);
        return updated;
      });

      if (storageMode === 'server' && updatedPrestationsToSave.length > 0) {
        await Promise.all(updatedPrestationsToSave.map(up => saveWampData('prestations', up)));
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
              <p className="text-xs text-rose-100">Mode Serveur WAMP Multi-Poste actif</p>
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
              <h4 className="font-bold text-slate-900">Options disponibles :</h4>
              <p className="text-slate-600 leading-relaxed">
                Vous pouvez réessayer la connexion à MySQL WAMP si votre serveur est en cours de démarrage, ou basculer immédiatement en <strong>Mode Local (LocalStorage)</strong> pour continuer à travailler sans blocage.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => checkAndLoadWampData(false)}
                disabled={isRetryingDb}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${isRetryingDb ? 'animate-spin' : ''}`} />
                <span>{isRetryingDb ? 'Vérification...' : 'Réessayer connexion MySQL'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleToggleStorageMode('local')}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition cursor-pointer"
              >
                <HardDrive className="h-4 w-4 text-blue-200" />
                <span>Basculer en Mode Local</span>
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
        storageMode={storageMode}
        onToggleStorageMode={handleToggleStorageMode}
        onSyncLocalToServer={handleSyncLocalToServer}
        onSyncServerToLocal={handleSyncServerToLocal}
      />

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
            onSaveSociete={handleSaveSociete}
            onDeleteSociete={handleDeleteSociete}
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
