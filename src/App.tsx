import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { Dashboard } from './components/Dashboard';
import { PrestationsView } from './components/PrestationsView';
import { PaiementsView } from './components/PaiementsView';
import { ImportationView } from './components/ImportationView';
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
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [selectedSocieteId, setSelectedSocieteId] = useState<string>('ALL');

  // Persistence in LocalStorage
  const [societes, setSocietes] = useState<Societe[]>(() => {
    const saved = localStorage.getItem('suivi_assurance_societes');
    return saved ? JSON.parse(saved) : initialSocietes;
  });

  const [personnes, setPersonnes] = useState<Personne[]>(() => {
    const saved = localStorage.getItem('suivi_assurance_personnes');
    return saved ? JSON.parse(saved) : initialPersonnes;
  });

  const [familles, setFamilles] = useState<Famille[]>(() => {
    const saved = localStorage.getItem('suivi_assurance_familles');
    return saved ? JSON.parse(saved) : initialFamilles;
  });

  const [prestations, setPrestations] = useState<Prestation[]>(() => {
    const saved = localStorage.getItem('suivi_assurance_prestations');
    return saved ? JSON.parse(saved) : initialPrestations;
  });

  const [paiements, setPaiements] = useState<Paiement[]>(() => {
    const saved = localStorage.getItem('suivi_assurance_paiements');
    return saved ? JSON.parse(saved) : initialPaiements;
  });

  // Modals quick trigger
  const [isPrestationModalOpen, setIsPrestationModalOpen] = useState(false);
  const [isPaiementModalOpen, setIsPaiementModalOpen] = useState(false);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('suivi_assurance_societes', JSON.stringify(societes));
  }, [societes]);

  useEffect(() => {
    localStorage.setItem('suivi_assurance_personnes', JSON.stringify(personnes));
  }, [personnes]);

  useEffect(() => {
    localStorage.setItem('suivi_assurance_familles', JSON.stringify(familles));
  }, [familles]);

  useEffect(() => {
    localStorage.setItem('suivi_assurance_prestations', JSON.stringify(prestations));
  }, [prestations]);

  useEffect(() => {
    localStorage.setItem('suivi_assurance_paiements', JSON.stringify(paiements));
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
  const handleImportPrestations = (newPrestations: Prestation[]) => {
    setPrestations(prev => [...newPrestations, ...prev]);
    setActiveTab('prestations');
  };

  const handleImportPaiements = (newPaiement: Paiement, updatedPrestations: Prestation[]) => {
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

  const totalMontantPaye = paiements.reduce((sum, p) => sum + (p.totalPaye || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col antialiased">
      {/* Top Header */}
      <Header
        societes={societes}
        selectedSocieteId={selectedSocieteId}
        onSelectSociete={setSelectedSocieteId}
        totalPrestationsCount={prestations.length}
        totalMontantPaye={totalMontantPaye}
        onExportBackup={handleExportBackup}
      />

      {/* Navigation Tab Bar */}
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
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
            isCreateModalOpen={isPaiementModalOpen}
            setIsCreateModalOpen={setIsPaiementModalOpen}
          />
        )}

        {activeTab === 'importation' && (
          <ImportationView
            societes={societes}
            personnes={personnes}
            prestations={prestations}
            onImportPrestations={handleImportPrestations}
            onImportPaiements={handleImportPaiements}
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

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 px-6 text-center text-xs text-slate-400 no-print">
        SUIVI ASSURANCE SANTÉ & PRESTATIONS • Système de Gestion et de Rapprochement d'Assurance
      </footer>
    </div>
  );
}

export default App;

