import React, { useState, useEffect } from 'react';
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
import { Prestation, Paiement, Societe, Personne, Famille, ActiveTab } from './types';
import { generateMySQLDump } from './utils/sqlExporter';
import { fetchWampData, saveWampData, deleteWampData } from './utils/wampApi';

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [selectedSocieteId, setSelectedSocieteId] = useState<string>('ALL');

  // Persistence initialized with restored initial societes (MCI CARE, NY HAVANA, BSA, ASCOMA)
  const [societes, setSocietes] = useState<Societe[]>(() => {
    localStorage.removeItem('suivi_assurance_societes');
    localStorage.removeItem('suivi_assurance_bsa_v3_societes');
    localStorage.removeItem('suivi_assurance_bsa_clean_societes');
    const saved = localStorage.getItem('suivi_assurance_mcicare_societes') || localStorage.getItem('suivi_assurance_nyhavana_societes');
    if (saved) {
      try {
        const parsed: Societe[] = JSON.parse(saved);
        if (parsed.length > 0) {
          const existingNames = new Set(parsed.map(s => s.nom.toUpperCase().trim()));
          const missing = initialSocietes.filter(s => !existingNames.has(s.nom.toUpperCase().trim()));
          return [...parsed, ...missing];
        }
      } catch {
        return initialSocietes;
      }
    }
    return initialSocietes;
  });

  const [personnes, setPersonnes] = useState<Personne[]>(() => {
    localStorage.removeItem('suivi_assurance_personnes');
    localStorage.removeItem('suivi_assurance_bsa_v3_personnes');
    localStorage.removeItem('suivi_assurance_bsa_clean_personnes');
    localStorage.removeItem('suivi_assurance_nyhavana_personnes');
    const saved = localStorage.getItem('suivi_assurance_mcicare_personnes');
    if (saved) {
      try {
        const parsed: Personne[] = JSON.parse(saved);
        return parsed;
      } catch {
        return initialPersonnes;
      }
    }
    return initialPersonnes;
  });

  const [familles, setFamilles] = useState<Famille[]>(() => {
    localStorage.removeItem('suivi_assurance_familles');
    localStorage.removeItem('suivi_assurance_bsa_v3_familles');
    localStorage.removeItem('suivi_assurance_nyhavana_familles');
    return initialFamilles;
  });

  const [prestations, setPrestations] = useState<Prestation[]>(() => {
    localStorage.removeItem('suivi_assurance_prestations');
    localStorage.removeItem('suivi_assurance_bsa_v3_prestations');
    localStorage.removeItem('suivi_assurance_bsa_clean_prestations');
    localStorage.removeItem('suivi_assurance_nyhavana_prestations');
    const saved = localStorage.getItem('suivi_assurance_mcicare_prestations');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  const [paiements, setPaiements] = useState<Paiement[]>(() => {
    localStorage.removeItem('suivi_assurance_paiements');
    localStorage.removeItem('suivi_assurance_bsa_v3_paiements');
    localStorage.removeItem('suivi_assurance_bsa_clean_paiements');
    localStorage.removeItem('suivi_assurance_nyhavana_paiements');
    const saved = localStorage.getItem('suivi_assurance_mcicare_paiements');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return initialPaiements;
      }
    }
    return initialPaiements;
  });

  // Modals quick trigger
  const [isPrestationModalOpen, setIsPrestationModalOpen] = useState(false);
  const [isPaiementModalOpen, setIsPaiementModalOpen] = useState(false);

  // Sync with WAMP API on load if present
  useEffect(() => {
    async function syncFromWamp() {
      try {
        const [sData, pData, fData, prData, paData] = await Promise.all([
          fetchWampData('societes'),
          fetchWampData('personnes'),
          fetchWampData('familles'),
          fetchWampData('prestations'),
          fetchWampData('paiements')
        ]);
        if (sData && sData.length > 0) setSocietes(sData);
        if (pData && pData.length > 0) setPersonnes(pData);
        if (fData && fData.length > 0) setFamilles(fData);
        if (prData && prData.length > 0) setPrestations(prData);
        if (paData && paData.length > 0) setPaiements(paData);
      } catch {
        // Ignore errors when running outside WAMP
      }
    }
    syncFromWamp();
  }, []);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('suivi_assurance_mcicare_societes', JSON.stringify(societes));
  }, [societes]);

  useEffect(() => {
    localStorage.setItem('suivi_assurance_mcicare_personnes', JSON.stringify(personnes));
  }, [personnes]);

  useEffect(() => {
    localStorage.setItem('suivi_assurance_mcicare_familles', JSON.stringify(familles));
  }, [familles]);

  useEffect(() => {
    localStorage.setItem('suivi_assurance_mcicare_prestations', JSON.stringify(prestations));
  }, [prestations]);

  useEffect(() => {
    localStorage.setItem('suivi_assurance_mcicare_paiements', JSON.stringify(paiements));
  }, [paiements]);

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
    setPaiements(prev => prev.filter(p => p.id !== id));
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

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 antialiased">
      {/* Top Header */}
      <Header
        societes={societes}
        selectedSocieteId={selectedSocieteId}
        onSelectSociete={setSelectedSocieteId}
        onExportBackup={handleExportBackup}
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
          <EnteteView />
        )}
      </main>

    </div>
  );
}

export default App;

