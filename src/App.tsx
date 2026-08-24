import React, { useState, useEffect } from 'react';
import { ServerOff, AlertTriangle, RefreshCw, Database } from 'lucide-react';
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

import { 
  initialSocietes, 
  initialPersonnes, 
  initialFamilles, 
  initialPaiements 
} from './data/initialData';
import { Prestation, Paiement, Societe, Personne, Famille, ActiveTab, EnteteConfig } from './types';
import { generateMySQLDump } from './utils/sqlExporter';
import { checkWampDbConnection, fetchWampData, saveWampData, deleteWampData } from './utils/wampApi';
import { getStoredEnteteConfig } from './utils/enteteStorage';

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [selectedSocieteId, setSelectedSocieteId] = useState<string>('ALL');
  const [enteteConfig, setEnteteConfig] = useState<EnteteConfig>(getStoredEnteteConfig());

  // Dynamically sync browser favicon with entete config logoUrl
  useEffect(() => {
    if (enteteConfig?.logoUrl) {
      let link = document.querySelector<HTMLLinkElement>("link[rel*='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'shortcut icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = enteteConfig.logoUrl;
    }
  }, [enteteConfig?.logoUrl]);

  // Database Connection blocking status
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [dbError, setDbError] = useState<string | null>(null);
  const [isRetryingDb, setIsRetryingDb] = useState(false);

  // Data states initialized with localStorage backup or initialData
  const [societes, setSocietes] = useState<Societe[]>(() => {
    const saved = localStorage.getItem('suivi_assurance_mcicare_societes');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return initialSocietes;
  });

  const [personnes, setPersonnes] = useState<Personne[]>(() => {
    const saved = localStorage.getItem('suivi_assurance_mcicare_personnes');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return initialPersonnes;
  });

  const [familles, setFamilles] = useState<Famille[]>(() => {
    const saved = localStorage.getItem('suivi_assurance_mcicare_familles');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return initialFamilles;
  });

  const [prestations, setPrestations] = useState<Prestation[]>(() => {
    const saved = localStorage.getItem('suivi_assurance_mcicare_prestations');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    return [];
  });

  const [paiements, setPaiements] = useState<Paiement[]>(() => {
    const saved = localStorage.getItem('suivi_assurance_mcicare_paiements');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return initialPaiements;
  });

  // Modals quick trigger
  const [isPrestationModalOpen, setIsPrestationModalOpen] = useState(false);
  const [isPaiementModalOpen, setIsPaiementModalOpen] = useState(false);

  // Check database connection and load WAMP data
  const checkAndLoadWampData = async () => {
    setDbStatus('checking');
    setIsRetryingDb(true);
    const conn = await checkWampDbConnection();
    if (!conn.connected) {
      setDbStatus('error');
      setDbError(conn.error || 'Connexion à la base de données MySQL WAMP non établie.');
      setIsRetryingDb(false);
      return;
    }

    setDbStatus('connected');
    setDbError(null);

    try {
      const [sData, pData, fData, prData, paData] = await Promise.all([
        fetchWampData('societes'),
        fetchWampData('personnes'),
        fetchWampData('familles'),
        fetchWampData('prestations'),
        fetchWampData('paiements')
      ]);
      if (sData && Array.isArray(sData) && sData.length > 0) setSocietes(sData);
      if (pData && Array.isArray(pData) && pData.length > 0) setPersonnes(pData);
      if (fData && Array.isArray(fData) && fData.length > 0) setFamilles(fData);
      if (prData && Array.isArray(prData) && prData.length > 0) setPrestations(prData);
      if (paData && Array.isArray(paData) && paData.length > 0) setPaiements(paData);
    } catch (err: any) {
      console.error('Erreur chargement WAMP:', err);
      setDbStatus('error');
      setDbError('Erreur de lecture des données depuis la base de données MySQL WAMP.');
    } finally {
      setIsRetryingDb(false);
    }
  };

  useEffect(() => {
    checkAndLoadWampData();
  }, []);

  // Sync to localStorage as backup
  useEffect(() => {
    if (dbStatus === 'connected') {
      localStorage.setItem('suivi_assurance_mcicare_societes', JSON.stringify(societes));
    }
  }, [societes, dbStatus]);

  useEffect(() => {
    if (dbStatus === 'connected') {
      localStorage.setItem('suivi_assurance_mcicare_personnes', JSON.stringify(personnes));
    }
  }, [personnes, dbStatus]);

  useEffect(() => {
    if (dbStatus === 'connected') {
      localStorage.setItem('suivi_assurance_mcicare_familles', JSON.stringify(familles));
    }
  }, [familles, dbStatus]);

  useEffect(() => {
    if (dbStatus === 'connected') {
      localStorage.setItem('suivi_assurance_mcicare_prestations', JSON.stringify(prestations));
    }
  }, [prestations, dbStatus]);

  useEffect(() => {
    if (dbStatus === 'connected') {
      localStorage.setItem('suivi_assurance_mcicare_paiements', JSON.stringify(paiements));
    }
  }, [paiements, dbStatus]);

  // Handlers for Prestations
  const handleSavePrestation = (prestation: Prestation) => {
    saveWampData('prestations', prestation);
    setPrestations(prev => {
      const idx = prev.findIndex(p => p.id === prestation.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = prestation;
        return copy;
      }
      return [prestation, ...prev];
    });
  };

  const handleDeletePrestation = (id: string) => {
    deleteWampData('prestations', id);
    setPrestations(prev => prev.filter(p => p.id !== id));
  };

  const handleDeleteFacture = (numeroFacture: string) => {
    const cleanNum = (n: string) => (n || '').replace(/[\s\-\_\.\/]/g, '').toUpperCase();
    const target = cleanNum(numeroFacture);
    const toDelete = prestations.filter(p => cleanNum(p.numeroFacture) === target);
    toDelete.forEach(p => deleteWampData('prestations', p.id));
    setPrestations(prev => prev.filter(p => cleanNum(p.numeroFacture) !== target));
  };

  // Handlers for Paiements
  const handleSavePaiement = (newPaiement: Paiement, updatedPrestations: Prestation[]) => {
    saveWampData('paiements', newPaiement);
    if (updatedPrestations && updatedPrestations.length > 0) {
      updatedPrestations.forEach(up => saveWampData('prestations', up));
    }

    setPaiements(prev => {
      const idx = prev.findIndex(p => p.id === newPaiement.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = newPaiement;
        return copy;
      }
      return [newPaiement, ...prev];
    });

    if (updatedPrestations && updatedPrestations.length > 0) {
      setPrestations(prev => {
        const updatedMap = new Map(updatedPrestations.map(p => [p.id, p]));
        const result = prev.map(p => updatedMap.has(p.id) ? updatedMap.get(p.id)! : p);
        // Include any newly auto-generated prestations not already in state
        updatedPrestations.forEach(up => {
          if (!prev.some(p => p.id === up.id)) {
            result.unshift(up);
          }
        });
        return result;
      });
    }
  };

  const handleDeletePaiement = (id: string) => {
    deleteWampData('paiements', id);
    const remainingPaiements = paiements.filter(p => p.id !== id);
    setPaiements(remainingPaiements);

    const cleanNum = (n: string) => (n || '').replace(/[\s\-\_\.\/]/g, '').toUpperCase();

    // Map payment lines from remaining paiements
    const remainingPaidMap = new Map<string, { totalPaye: number; totalExclu: number; bordereaux: string[]; latestDate: string }>();
    const remainingLinePaidMap = new Map<string, { totalPaye: number; totalExclu: number }>();

    remainingPaiements.forEach(pm => {
      (pm.lignes || []).forEach(lp => {
        const net = Number(lp.totalPaye ?? lp.montantPaye ?? 0);
        const exclu = Number(lp.montantExclu || 0);
        const pId = lp.prestationId;
        const lId = lp.lignePrestationId;
        const num = lp.prestationNumero ? cleanNum(lp.prestationNumero) : '';

        if (pId) {
          const cur = remainingPaidMap.get(pId) || { totalPaye: 0, totalExclu: 0, bordereaux: [], latestDate: '' };
          cur.totalPaye += net;
          cur.totalExclu += exclu;
          if (pm.numeroBordereau && !cur.bordereaux.includes(pm.numeroBordereau)) cur.bordereaux.push(pm.numeroBordereau);
          if (pm.datePaiement && (!cur.latestDate || pm.datePaiement > cur.latestDate)) cur.latestDate = pm.datePaiement;
          remainingPaidMap.set(pId, cur);
        }
        if (num) {
          const cur = remainingPaidMap.get(num) || { totalPaye: 0, totalExclu: 0, bordereaux: [], latestDate: '' };
          cur.totalPaye += net;
          cur.totalExclu += exclu;
          if (pm.numeroBordereau && !cur.bordereaux.includes(pm.numeroBordereau)) cur.bordereaux.push(pm.numeroBordereau);
          if (pm.datePaiement && (!cur.latestDate || pm.datePaiement > cur.latestDate)) cur.latestDate = pm.datePaiement;
          remainingPaidMap.set(num, cur);
        }
        if (lId) {
          const cur = remainingLinePaidMap.get(lId) || { totalPaye: 0, totalExclu: 0 };
          cur.totalPaye += net;
          cur.totalExclu += exclu;
          remainingLinePaidMap.set(lId, cur);
        }
      });
    });

    setPrestations(prev => {
      return prev.map(p => {
        const num = cleanNum(p.numeroFacture);
        const pPaidData = remainingPaidMap.get(p.id) || remainingPaidMap.get(num) || { totalPaye: 0, totalExclu: 0, bordereaux: [], latestDate: '' };

        let linesTotalPaye = 0;
        let linesTotalExclu = 0;
        const updatedLignes = (p.lignes || []).map(l => {
          const lPaidData = remainingLinePaidMap.get(l.id) || { totalPaye: 0, totalExclu: 0 };
          const lBrut = l.totalPrestation || 0;
          const lPart = l.ticketModerateur ?? Math.round((p.ticketModerateur || 0) / (p.lignes?.length || 1));
          const lARemb = l.montantARembourser ?? Math.max(0, lBrut - lPart);
          const lReste = Math.max(0, lARemb - lPaidData.totalPaye - lPaidData.totalExclu);
          const lStatut = lPaidData.totalExclu >= lARemb && lARemb > 0 && lPaidData.totalPaye === 0
            ? 'Rejeté'
            : (lPaidData.totalPaye >= lARemb && lARemb > 0) || (lReste <= 0 && lPaidData.totalPaye > 0)
            ? 'Payé'
            : lPaidData.totalPaye > 0
            ? 'Partiellement payé'
            : 'En attente';

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

        saveWampData('prestations', updatedP);
        return updatedP;
      });
    });
  };

  // Handlers for Societes
  const handleSaveSociete = (societe: Societe) => {
    saveWampData('societes', societe);
    setSocietes(prev => {
      const idx = prev.findIndex(s => s.id === societe.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = societe;
        return copy;
      }
      return [...prev, societe];
    });
  };

  const handleDeleteSociete = (id: string) => {
    deleteWampData('societes', id);
    setSocietes(prev => prev.filter(s => s.id !== id));
  };

  // Handlers for Personnes
  const handleSavePersonne = (personne: Personne) => {
    saveWampData('personnes', personne);
    setPersonnes(prev => {
      const idx = prev.findIndex(p => p.id === personne.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = personne;
        return copy;
      }
      return [...prev, personne];
    });
  };

  const handleDeletePersonne = (id: string) => {
    deleteWampData('personnes', id);
    setPersonnes(prev => prev.filter(p => p.id !== id));
  };

  // Handlers for Familles
  const handleSaveFamille = (famille: Famille) => {
    saveWampData('familles', famille);
    setFamilles(prev => {
      const idx = prev.findIndex(f => f.id === famille.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = famille;
        return copy;
      }
      return [...prev, famille];
    });
  };

  const handleDeleteFamille = (id: string) => {
    deleteWampData('familles', id);
    setFamilles(prev => prev.filter(f => f.id !== id));
  };

  // Bulk Import Handlers
  const handleImportPrestations = (
    newPrestations: Prestation[],
    newSocietes?: Societe[],
    newPersonnes?: Personne[]
  ) => {
    if (newSocietes && newSocietes.length > 0) {
      newSocietes.forEach(ns => saveWampData('societes', ns));
      setSocietes(prev => {
        const copy = [...prev];
        newSocietes.forEach(ns => {
          const idx = copy.findIndex(s => s.id === ns.id);
          if (idx >= 0) copy[idx] = ns;
          else copy.push(ns);
        });
        return copy;
      });
    }
    if (newPersonnes && newPersonnes.length > 0) {
      newPersonnes.forEach(np => saveWampData('personnes', np));
      setPersonnes(prev => {
        const copy = [...prev];
        newPersonnes.forEach(np => {
          const idx = copy.findIndex(p => p.id === np.id);
          if (idx >= 0) copy[idx] = np;
          else copy.push(np);
        });
        return copy;
      });
    }
    newPrestations.forEach(p => saveWampData('prestations', p));
    setPrestations(prev => [...newPrestations, ...prev]);
    setActiveTab('prestations');
  };

  const handleImportPaiements = (
    newPaiement: Paiement,
    updatedPrestations: Prestation[],
    newSocietes?: Societe[],
    newPersonnes?: Personne[]
  ) => {
    saveWampData('paiements', newPaiement);
    if (updatedPrestations && updatedPrestations.length > 0) {
      updatedPrestations.forEach(up => saveWampData('prestations', up));
    }
    if (newSocietes && newSocietes.length > 0) {
      newSocietes.forEach(ns => saveWampData('societes', ns));
      setSocietes(prev => {
        const copy = [...prev];
        newSocietes.forEach(ns => {
          const idx = copy.findIndex(s => s.id === ns.id);
          if (idx >= 0) copy[idx] = ns;
          else copy.push(ns);
        });
        return copy;
      });
    }
    if (newPersonnes && newPersonnes.length > 0) {
      newPersonnes.forEach(np => saveWampData('personnes', np));
      setPersonnes(prev => {
        const copy = [...prev];
        newPersonnes.forEach(np => {
          const idx = copy.findIndex(p => p.id === np.id);
          if (idx >= 0) copy[idx] = np;
          else copy.push(np);
        });
        return copy;
      });
    }
    setPaiements(prev => [newPaiement, ...prev]);
    setPrestations(updatedPrestations);
    setActiveTab('paiements');
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

  if (dbStatus === 'error') {
    return (
      <div className="fixed inset-0 z-[9999] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 font-sans antialiased select-none">
        <div className="max-w-xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
          <div className="bg-rose-600 px-6 py-5 text-white flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/10 backdrop-blur-md shrink-0">
              <ServerOff className="h-7 w-7 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Application Bloquée : Base de données déconnectée</h2>
              <p className="text-xs text-rose-100">Le fonctionnement en mode local est désactivé</p>
            </div>
          </div>

          <div className="p-6 space-y-5">
            <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 space-y-2">
              <div className="flex items-center gap-2 text-rose-950 font-bold text-xs">
                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>Raison du blocage de l'application :</span>
              </div>
              <p className="text-xs text-rose-900 leading-relaxed font-mono bg-white/80 p-3 rounded-xl border border-rose-200 break-words">
                {dbError || 'Impossible de se connecter au serveur MySQL WAMP (suivi_assurance_salfa).'}
              </p>
            </div>

            <div className="space-y-2 text-xs text-slate-700">
              <h4 className="font-bold text-slate-900">Procédure pour débloquer l'application :</h4>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-600 pl-1 leading-relaxed">
                <li>Vérifiez que <strong>WAMP Server</strong> est démarré (icône <strong>VERTE</strong> dans la barre des tâches).</li>
                <li>Assurez-vous que le service <strong>MySQL</strong> (Port 3306) est démarré.</li>
                <li>Vérifiez la configuration dans <code className="bg-slate-100 px-1 py-0.5 rounded border border-slate-200 font-mono text-slate-900">wamp-deploy/api/config.php</code>.</li>
                <li>Importez le fichier <code className="bg-slate-100 px-1 py-0.5 rounded border border-slate-200 font-mono text-slate-900">schema.sql</code> si la base <code className="bg-slate-100 px-1 py-0.5 rounded border border-slate-200 font-mono text-slate-900">suivi_assurance_salfa</code> n'existe pas.</li>
              </ol>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={checkAndLoadWampData}
                disabled={isRetryingDb}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${isRetryingDb ? 'animate-spin' : ''}`} />
                <span>{isRetryingDb ? 'Vérification de la connexion MySQL en cours...' : 'Réessayer la connexion à la base de données MySQL'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (dbStatus === 'checking') {
    return (
      <div className="fixed inset-0 z-[9999] bg-slate-900 flex flex-col items-center justify-center p-4 text-white font-sans">
        <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md mb-4 animate-bounce">
          <Database className="h-8 w-8 text-emerald-400" />
        </div>
        <h2 className="text-base font-bold">Vérification de la connexion à la base de données MySQL...</h2>
        <p className="text-xs text-slate-400 mt-1">Connexion au serveur WAMP en cours</p>
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
        logoUrl={enteteConfig.logoUrl}
      />

      {/* Navigation Tab Bar */}
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Content Area — volontairement fluide pour exploiter toute la largeur disponible */}
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

