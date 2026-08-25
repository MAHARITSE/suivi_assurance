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
import { SqlImportModal } from './components/SqlImportModal';
import { generateMySQLDump } from './utils/sqlExporter';
import { checkWampDbConnection, fetchWampData, saveWampData, saveWampDataBulk, deleteWampData } from './utils/wampApi';
import {
  loadLocalDataset,
  saveLocalTable,
  backupServerDataToLocalStorage,
} from './utils/localPersistence';
import { ServerOff, RefreshCw, AlertTriangle, Database } from 'lucide-react';

export function App() {
  // Navigation & selection states
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [selectedSocieteId, setSelectedSocieteId] = useState<string>('ALL');

  // Storage Mode strictly Server MySQL WAMP
  const storageMode = 'server';

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
  const [isSqlImportModalOpen, setIsSqlImportModalOpen] = useState(false);

  // Tracking if initial load completed
  const initialLoadRef = useRef(false);

  // Check database connection and load WAMP data directly from MySQL
  const checkAndLoadWampData = useCallback(async (silent: boolean = false) => {
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

      let sArr = Array.isArray(sData) ? sData : [];
      let pArr = Array.isArray(pData) ? pData : [];
      let fArr = Array.isArray(fData) ? fData : [];
      let prArr = Array.isArray(prData) ? prData : [];
      let paArr = Array.isArray(paData) ? paData : [];

      // If database is currently empty (e.g. fresh installation), fallback to local default dataset
      if (sArr.length === 0 && prArr.length === 0 && paArr.length === 0) {
        const local = loadLocalDataset();
        if (local.prestations.length > 0 || local.societes.length > 0) {
          sArr = local.societes;
          pArr = local.personnes;
          fArr = local.familles;
          prArr = local.prestations;
          paArr = local.paiements;
        }
      }

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
  }, []);

  // Initial connection on mount
  useEffect(() => {
    if (!initialLoadRef.current) {
      initialLoadRef.current = true;
      checkAndLoadWampData(false);
    }
  }, [checkAndLoadWampData]);

  // Real-time Multi-Poste Background Polling (every 6 seconds) + Re-sync on Window Focus (Server mode only)
  useEffect(() => {
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
  }, [dbStatus, checkAndLoadWampData]);

  // Handler for SQL Dump Restoration
  const handleApplySqlData = async (
    data: {
      societes: Societe[];
      personnes: Personne[];
      familles: Famille[];
      prestations: Prestation[];
      paiements: Paiement[];
    },
    mode: 'merge' | 'replace'
  ) => {
    let finalSocietes = data.societes;
    let finalPersonnes = data.personnes;
    let finalFamilles = data.familles;
    let finalPrestations = data.prestations;
    let finalPaiements = data.paiements;

    if (mode === 'merge') {
      const mergeArrays = <T extends { id: string }>(current: T[], incoming: T[]): T[] => {
        const map = new Map<string, T>();
        current.forEach(item => map.set(item.id, item));
        incoming.forEach(item => map.set(item.id, item));
        return Array.from(map.values());
      };

      finalSocietes = mergeArrays(societes, data.societes);
      finalPersonnes = mergeArrays(personnes, data.personnes);
      finalFamilles = mergeArrays(familles, data.familles);
      finalPrestations = mergeArrays(prestations, data.prestations);
      finalPaiements = mergeArrays(paiements, data.paiements);
    }

    setSocietes(finalSocietes);
    setPersonnes(finalPersonnes);
    setFamilles(finalFamilles);
    setPrestations(finalPrestations);
    setPaiements(finalPaiements);

    backupServerDataToLocalStorage({
      societes: finalSocietes,
      personnes: finalPersonnes,
      familles: finalFamilles,
      prestations: finalPrestations,
      paiements: finalPaiements,
    });

    if (storageMode === 'server') {
      try {
        if (finalSocietes.length > 0) await saveWampDataBulk('societes', finalSocietes);
        if (finalFamilles.length > 0) await saveWampDataBulk('familles', finalFamilles);
        if (finalPersonnes.length > 0) await saveWampDataBulk('personnes', finalPersonnes);
        if (finalPrestations.length > 0) await saveWampDataBulk('prestations', finalPrestations);
        if (finalPaiements.length > 0) await saveWampDataBulk('paiements', finalPaiements);
      } catch (e) {
        console.warn('Erreur synchronisation bulk vers MySQL:', e);
      }
    }

    setLastSyncTime(new Date());
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
              <h4 className="font-bold text-slate-900">Vérifications recommandées :</h4>
              <ul className="text-slate-600 leading-relaxed list-disc list-inside space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <li>Vérifiez que l'icône de WAMP Server est bien <strong className="text-emerald-700">verte</strong> dans la barre des tâches.</li>
                <li>Assurez-vous que les services <strong>Apache</strong> et <strong>MySQL</strong> sont lancés.</li>
                <li>Vérifiez que le fichier <code className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200">api.php</code> et <code className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200">config.php</code> sont bien présents dans le dossier WAMP.</li>
              </ul>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => checkAndLoadWampData(false)}
                disabled={isRetryingDb}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${isRetryingDb ? 'animate-spin' : ''}`} />
                <span>{isRetryingDb ? 'Vérification en cours...' : 'Réessayer la connexion MySQL'}</span>
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
        onImportSQL={() => setIsSqlImportModalOpen(true)}
        onRefreshData={() => checkAndLoadWampData(true)}
        isRefreshing={isRefreshing}
        lastSyncTime={lastSyncTime}
        dbConnected={dbStatus === 'connected'}
        logoUrl={enteteConfig.logoUrl}
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

      {/* SQL Dump Import / Restore Modal */}
      <SqlImportModal
        isOpen={isSqlImportModalOpen}
        onClose={() => setIsSqlImportModalOpen(false)}
        onApplyData={handleApplySqlData}
      />
    </div>
  );
}

export default App;
