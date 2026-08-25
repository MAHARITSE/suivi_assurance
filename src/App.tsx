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
import { getStoredEnteteConfig, loadEnteteConfigFromDb } from './utils/enteteStorage';
import { IS_WAMP_BUILD } from './utils/buildTarget';

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

  // Data states
  // - VERSION WAMP (build:wamp) : STRICTEMENT MYSQL — aucune donnée codée en
  //   dur, aucun localStorage. Tous les états démarrent VIDES et sont remplis
  //   exclusivement depuis la base MySQL WAMP.
  // - AUTRES VERSIONS (dev/preview/hébergé) : comportement d'origine avec
  //   données initiales locales et sauvegarde localStorage.
  const [societes, setSocietes] = useState<Societe[]>(IS_WAMP_BUILD ? [] : initialSocietes);
  const [personnes, setPersonnes] = useState<Personne[]>(IS_WAMP_BUILD ? [] : initialPersonnes);
  const [familles, setFamilles] = useState<Famille[]>(IS_WAMP_BUILD ? [] : initialFamilles);
  const [prestations, setPrestations] = useState<Prestation[]>([]);
  const [paiements, setPaiements] = useState<Paiement[]>(IS_WAMP_BUILD ? [] : initialPaiements);

  // Modals quick trigger
  const [isPrestationModalOpen, setIsPrestationModalOpen] = useState(false);
  const [isPaiementModalOpen, setIsPaiementModalOpen] = useState(false);

  // VERSION WAMP : chargement STRICTEMENT depuis MySQL — aucune donnée codée
  // en dur, aucun amorçage local, aucun localStorage. Ce qui est affiché =
  // exactement ce que contient la base MySQL WAMP.
  // AUTRES VERSIONS : comportement d'origine (données initiales si base vide).
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

      if (IS_WAMP_BUILD) {
        // ===== VERSION WAMP : STRICTEMENT MYSQL =====
        // Les listes reflètent exactement le contenu des tables. Si une table
        // est vide, l'application affiche une liste vide (les données de
        // référence sont insérées EN BASE par schema.sql, jamais par le code).
        if (Array.isArray(sData)) {
          setSocietes(sData);
        }
        if (Array.isArray(pData)) {
          setPersonnes(pData);
        }
        if (Array.isArray(fData)) {
          setFamilles(fData);
        }
        if (Array.isArray(prData)) {
          setPrestations(prData);
        }
        if (Array.isArray(paData)) {
          setPaiements(paData);
        }

        // Configuration de l'en-tête : chargée depuis MySQL (table parametres)
        const enteteFromDb = await loadEnteteConfigFromDb();
        setEnteteConfig(enteteFromDb);
      } else {
        // ===== AUTRES VERSIONS : comportement d'origine, inchangé =====
        // Sociétés
        if (Array.isArray(sData)) {
          if (sData.length > 0) {
            setSocietes(sData);
          } else {
            setSocietes(initialSocietes);
            await saveWampData('societes', initialSocietes);
          }
        }

        // Personnes
        if (Array.isArray(pData)) {
          setPersonnes(pData);
        }

        // Familles
        if (Array.isArray(fData)) {
          if (fData.length > 0) {
            const mergedMap = new Map<string, Famille>();
            fData.forEach((f: Famille) => {
              mergedMap.set(f.id, f);
            });

            const toUpdateList: Famille[] = [];
            initialFamilles.forEach((initF: Famille) => {
              const existing = Array.from(mergedMap.values()).find(
                f => f.id === initF.id || f.code.toUpperCase() === initF.code.toUpperCase()
              );

              if (existing) {
                const combinedAliases = Array.from(new Set([...(initF.aliases || []), ...(existing.aliases || [])]));
                if (!existing.aliases || existing.aliases.length < combinedAliases.length) {
                  const updatedF = { ...existing, aliases: combinedAliases };
                  mergedMap.set(existing.id, updatedF);
                  toUpdateList.push(updatedF);
                }
              } else {
                mergedMap.set(initF.id, initF);
                toUpdateList.push(initF);
              }
            });

            if (toUpdateList.length > 0) {
              await saveWampData('familles', toUpdateList);
            }

            setFamilles(Array.from(mergedMap.values()));
          } else {
            setFamilles(initialFamilles);
            await saveWampData('familles', initialFamilles);
          }
        }

        // Prestations
        if (Array.isArray(prData)) {
          setPrestations(prData);
        }

        // Paiements
        if (Array.isArray(paData)) {
          setPaiements(paData);
        }
      }
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

  // Sauvegarde passive localStorage — DÉSACTIVÉE en version WAMP
  // (mode strictement MySQL : rien n'est persisté dans le navigateur).
  useEffect(() => {
    if (IS_WAMP_BUILD) return;
    if (dbStatus === 'connected') {
      try {
        localStorage.setItem('suivi_assurance_mcicare_societes', JSON.stringify(societes));
      } catch {}
    }
  }, [societes, dbStatus]);

  useEffect(() => {
    if (IS_WAMP_BUILD) return;
    if (dbStatus === 'connected') {
      try {
        localStorage.setItem('suivi_assurance_mcicare_personnes', JSON.stringify(personnes));
      } catch {}
    }
  }, [personnes, dbStatus]);

  useEffect(() => {
    if (IS_WAMP_BUILD) return;
    if (dbStatus === 'connected') {
      try {
        localStorage.setItem('suivi_assurance_mcicare_familles', JSON.stringify(familles));
      } catch {}
    }
  }, [familles, dbStatus]);

  useEffect(() => {
    if (IS_WAMP_BUILD) return;
    if (dbStatus === 'connected') {
      try {
        localStorage.setItem('suivi_assurance_mcicare_prestations', JSON.stringify(prestations));
      } catch {}
    }
  }, [prestations, dbStatus]);

  useEffect(() => {
    if (IS_WAMP_BUILD) return;
    if (dbStatus === 'connected') {
      try {
        localStorage.setItem('suivi_assurance_mcicare_paiements', JSON.stringify(paiements));
      } catch {}
    }
  }, [paiements, dbStatus]);

  // Handlers for Prestations
  const handleSavePrestation = async (prestation: Prestation) => {
    await saveWampData('prestations', prestation);
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

  const handleDeletePrestation = async (id: string) => {
    await deleteWampData('prestations', id);
    setPrestations(prev => prev.filter(p => p.id !== id));
  };

  const handleDeleteFacture = async (numeroFacture: string) => {
    const cleanNum = (n: string) => (n || '').replace(/[\s\-\_\.\/]/g, '').toUpperCase();
    const target = cleanNum(numeroFacture);
    const toDelete = prestations.filter(p => cleanNum(p.numeroFacture) === target);
    for (const p of toDelete) {
      await deleteWampData('prestations', p.id);
    }
    setPrestations(prev => prev.filter(p => cleanNum(p.numeroFacture) !== target));
  };

  // Handlers for Paiements
  const handleSavePaiement = async (newPaiement: Paiement, updatedPrestations: Prestation[]) => {
    await saveWampData('paiements', newPaiement);
    if (updatedPrestations && updatedPrestations.length > 0) {
      await saveWampData('prestations', updatedPrestations);
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

  const handleDeletePaiement = async (id: string) => {
    await deleteWampData('paiements', id);
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

    const updatedPrestationsList: Prestation[] = prestations.map(p => {
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

      return {
        ...p,
        totalPaye,
        resteAPayer,
        lignes: updatedLignes,
        statut: isExcluded ? 'Rejeté' : isFullyPaid ? 'Payé' : isPartiallyPaid ? 'Partiellement payé' : 'En attente',
        datePaiement: pPaidData.latestDate || undefined,
      };
    });

    setPrestations(updatedPrestationsList);
    if (updatedPrestationsList.length > 0) {
      await saveWampData('prestations', updatedPrestationsList);
    }
  };

  // Handlers for Societes
  const handleSaveSociete = async (societe: Societe) => {
    await saveWampData('societes', societe);
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

  const handleDeleteSociete = async (id: string) => {
    await deleteWampData('societes', id);
    setSocietes(prev => prev.filter(s => s.id !== id));
  };

  // Handlers for Personnes
  const handleSavePersonne = async (personne: Personne) => {
    await saveWampData('personnes', personne);
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

  const handleDeletePersonne = async (id: string) => {
    await deleteWampData('personnes', id);
    setPersonnes(prev => prev.filter(p => p.id !== id));
  };

  // Handlers for Familles
  const handleSaveFamille = async (famille: Famille) => {
    await saveWampData('familles', famille);
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

  const handleDeleteFamille = async (id: string) => {
    await deleteWampData('familles', id);
    setFamilles(prev => prev.filter(f => f.id !== id));
  };

  // Bulk Import Handlers (Excel) — Atomic batch writes to MySQL
  const handleImportPrestations = async (
    newPrestations: Prestation[],
    newSocietes?: Societe[],
    newPersonnes?: Personne[]
  ) => {
    try {
      if (newSocietes && newSocietes.length > 0) {
        await saveWampData('societes', newSocietes);
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
        await saveWampData('personnes', newPersonnes);
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
      if (newPrestations && newPrestations.length > 0) {
        const res = await saveWampData('prestations', newPrestations);
        if (!res || !res.success) {
          console.error('Erreur lors de l\'enregistrement des prestations dans MySQL WAMP:', res);
        }
        setPrestations(prev => [...newPrestations, ...prev]);
      }
      setActiveTab('prestations');
    } catch (err) {
      console.error('Erreur import prestations:', err);
    }
  };

  const handleImportPaiements = async (
    newPaiement: Paiement,
    updatedPrestations: Prestation[],
    newSocietes?: Societe[],
    newPersonnes?: Personne[]
  ) => {
    try {
      if (newSocietes && newSocietes.length > 0) {
        await saveWampData('societes', newSocietes);
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
        await saveWampData('personnes', newPersonnes);
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
      await saveWampData('paiements', newPaiement);
      if (updatedPrestations && updatedPrestations.length > 0) {
        await saveWampData('prestations', updatedPrestations);
      }
      setPaiements(prev => [newPaiement, ...prev]);
      setPrestations(updatedPrestations);
      setActiveTab('paiements');
    } catch (err) {
      console.error('Erreur import paiements:', err);
    }
  };

  const [isSyncingWamp, setIsSyncingWamp] = useState(false);

  const handleSyncToWamp = async () => {
    setIsSyncingWamp(true);
    const results: string[] = [];
    const allErrors: string[] = [];
    try {
      const actions: { name: string; data: any[] }[] = [
        { name: 'societes', data: societes },
        { name: 'personnes', data: personnes },
        { name: 'familles', data: familles },
        { name: 'prestations', data: prestations },
        { name: 'paiements', data: paiements },
      ];
      for (const { name, data } of actions) {
        if (data.length > 0) {
          const res = await saveWampData(name, data);
          if (res && res.success) {
            results.push(`${name}: ${res.count ?? data.length} enregistré(s)`);
            if (res.errors && res.errors.length > 0) {
              allErrors.push(...res.errors.map((e: string) => `[${name}] ${e}`));
            }
          } else {
            results.push(`${name}: ÉCHEC`);
          }
        }
      }
      await checkAndLoadWampData();
      const msg = '✅ Synchronisation terminée:\n' + results.join('\n')
        + (allErrors.length > 0 ? '\n\n⚠️ Avertissements:\n' + allErrors.join('\n') : '');
      alert(msg);
    } catch (err) {
      console.error('Erreur de synchronisation globale WAMP:', err);
      alert('❌ Erreur lors de la synchronisation vers MySQL. Consultez la console (F12) pour plus de détails.');
    } finally {
      setIsSyncingWamp(false);
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
              <p className="text-xs text-rose-100">Le fonctionnement sans MySQL WAMP est désactivé</p>
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
                <li>Vérifiez la configuration dans <code className="bg-slate-100 px-1 py-0.5 rounded border border-slate-200 font-mono text-slate-900">api/config.php</code>.</li>
                <li>Importez le fichier <code className="bg-slate-100 px-1 py-0.5 rounded border border-slate-200 font-mono text-slate-900">schema.sql</code> dans phpMyAdmin si la base <code className="bg-slate-100 px-1 py-0.5 rounded border border-slate-200 font-mono text-slate-900">suivi_assurance_salfa</code> n'existe pas.</li>
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
        <p className="text-xs text-slate-400 mt-1">Lecture des données WAMP en cours</p>
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
        onSyncToWamp={handleSyncToWamp}
        isSyncingWamp={isSyncingWamp}
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

    </div>
  );
}

export default App;
