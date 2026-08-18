import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { Dashboard } from './components/Dashboard';
import { PrestationsView } from './components/PrestationsView';
import { PaiementsView } from './components/PaiementsView';
import { HistoriqueView } from './components/HistoriqueView';
import { SocietesView } from './components/SocietesView';
import { PersonnesView } from './components/PersonnesView';
import { FamillesView } from './components/FamillesView';
import { EtatsView } from './components/EtatsView';

import { 
  initialSocietes, 
  initialPersonnes, 
  initialFamilles, 
  initialPrestations, 
  initialPaiements 
} from './data/initialData';
import { Prestation, Paiement, Societe, Personne, Famille, ActiveTab } from './types';

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('prestations');
  const [selectedSocieteId, setSelectedSocieteId] = useState<string>('ALL');

  // Persistence directly aligned and purged for BSA Invoice dataset
  const [societes, setSocietes] = useState<Societe[]>(() => {
    localStorage.removeItem('suivi_assurance_societes');
    localStorage.removeItem('suivi_assurance_bsa_v3_societes');
    return initialSocietes;
  });

  const [personnes, setPersonnes] = useState<Personne[]>(() => {
    localStorage.removeItem('suivi_assurance_personnes');
    localStorage.removeItem('suivi_assurance_bsa_v3_personnes');
    return initialPersonnes;
  });

  const [familles, setFamilles] = useState<Famille[]>(() => {
    localStorage.removeItem('suivi_assurance_familles');
    localStorage.removeItem('suivi_assurance_bsa_v3_familles');
    return initialFamilles;
  });

  const [prestations, setPrestations] = useState<Prestation[]>(() => {
    localStorage.removeItem('suivi_assurance_prestations');
    localStorage.removeItem('suivi_assurance_bsa_v3_prestations');
    return initialPrestations;
  });

  const [paiements, setPaiements] = useState<Paiement[]>(() => {
    localStorage.removeItem('suivi_assurance_paiements');
    localStorage.removeItem('suivi_assurance_bsa_v3_paiements');
    return initialPaiements;
  });

  // Modals quick trigger
  const [isPrestationModalOpen, setIsPrestationModalOpen] = useState(false);
  const [isPaiementModalOpen, setIsPaiementModalOpen] = useState(false);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('suivi_assurance_bsa_clean_societes', JSON.stringify(societes));
  }, [societes]);

  useEffect(() => {
    localStorage.setItem('suivi_assurance_bsa_clean_personnes', JSON.stringify(personnes));
  }, [personnes]);

  useEffect(() => {
    localStorage.setItem('suivi_assurance_bsa_clean_familles', JSON.stringify(familles));
  }, [familles]);

  useEffect(() => {
    localStorage.setItem('suivi_assurance_bsa_clean_prestations', JSON.stringify(prestations));
  }, [prestations]);

  useEffect(() => {
    localStorage.setItem('suivi_assurance_bsa_clean_paiements', JSON.stringify(paiements));
  }, [paiements]);

  // Handlers for Prestations
  const handleSavePrestation = (prestation: Prestation) => {
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
    setPrestations(prev => prev.filter(p => p.id !== id));
  };

  // Handlers for Paiements
  const handleSavePaiement = (newPaiement: Paiement, updatedPrestations: Prestation[]) => {
    setPaiements(prev => [newPaiement, ...prev]);
    setPrestations(updatedPrestations);
  };

  const handleDeletePaiement = (id: string) => {
    setPaiements(prev => prev.filter(p => p.id !== id));
  };

  // Handlers for Societes
  const handleSaveSociete = (societe: Societe) => {
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
    setSocietes(prev => prev.filter(s => s.id !== id));
  };

  // Handlers for Personnes
  const handleSavePersonne = (personne: Personne) => {
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
    setPersonnes(prev => prev.filter(p => p.id !== id));
  };

  // Handlers for Familles
  const handleSaveFamille = (famille: Famille) => {
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
    setFamilles(prev => prev.filter(f => f.id !== id));
  };

  // Bulk Import Handlers
  const handleImportPrestations = (
    newPrestations: Prestation[],
    newSocietes?: Societe[],
    newPersonnes?: Personne[]
  ) => {
    if (newSocietes && newSocietes.length > 0) {
      setSocietes(prev => [...prev, ...newSocietes]);
    }
    if (newPersonnes && newPersonnes.length > 0) {
      setPersonnes(prev => [...prev, ...newPersonnes]);
    }
    setPrestations(prev => [...newPrestations, ...prev]);
    setActiveTab('prestations');
  };

  const handleImportPaiements = (
    newPaiement: Paiement,
    updatedPrestations: Prestation[],
    newSocietes?: Societe[],
    newPersonnes?: Personne[]
  ) => {
    if (newSocietes && newSocietes.length > 0) {
      setSocietes(prev => [...prev, ...newSocietes]);
    }
    if (newPersonnes && newPersonnes.length > 0) {
      setPersonnes(prev => [...prev, ...newPersonnes]);
    }
    setPaiements(prev => [newPaiement, ...prev]);
    setPrestations(updatedPrestations);
    setActiveTab('paiements');
  };

  const handleExportBackup = () => {
    const data = { societes, personnes, familles, prestations, paiements };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `suivi_assurance_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
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
            familles={familles}
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
            societes={societes}
            personnes={personnes}
            familles={familles}
            selectedSocieteId={selectedSocieteId}
            onSavePrestation={handleSavePrestation}
            onDeletePrestation={handleDeletePrestation}
            onImportPrestations={handleImportPrestations}
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
      </main>

    </div>
  );
}

export default App;

