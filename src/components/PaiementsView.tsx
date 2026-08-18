import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Receipt, 
  Eye, 
  Trash2, 
  CheckCircle2, 
  Download, 
  X, 
  Check, 
  Building, 
  Calendar,
  AlertCircle,
  FileCheck2,
  Printer,
  FileSpreadsheet
} from 'lucide-react';
import { Paiement, LignePaiement, Prestation, Societe, Personne, Famille } from '../types';
import { formatMoney, formatDate, generateId } from '../utils/formatters';
import { DecompteImportModal } from './DecompteImportModal';
import * as XLSX from 'xlsx';

interface PaiementsViewProps {
  paiements: Paiement[];
  prestations: Prestation[];
  societes: Societe[];
  personnes: Personne[];
  familles: Famille[];
  selectedSocieteId: string;
  onSavePaiement: (paiement: Paiement, updatedPrestations: Prestation[]) => void;
  onDeletePaiement: (id: string) => void;
  onImportPaiements?: (newPaiement: Paiement, updatedPrestations: Prestation[], newSocietes?: Societe[], newPersonnes?: Personne[]) => void;
  isCreateModalOpen: boolean;
  setIsCreateModalOpen: (open: boolean) => void;
}

export const PaiementsView: React.FC<PaiementsViewProps> = ({
  paiements,
  prestations,
  societes,
  personnes,
  familles,
  selectedSocieteId,
  onSavePaiement,
  onDeletePaiement,
  onImportPaiements,
  isCreateModalOpen,
  setIsCreateModalOpen,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewingPaiement, setViewingPaiement] = useState<Paiement | null>(null);
  const [isDecompteModalOpen, setIsDecompteModalOpen] = useState<boolean>(false);

  // Form State for Saisie de Paiement
  const [targetSocieteId, setTargetSocieteId] = useState<string>(
    selectedSocieteId !== 'ALL' ? selectedSocieteId : societes[0]?.id || ''
  );
  const [bordereauRef, setBordereauRef] = useState<string>('');
  const [datePaiement, setDatePaiement] = useState<string>(new Date().toISOString().split('T')[0]);
  const [modePaiement, setModePaiement] = useState<'Virement bancaire' | 'Chèque' | 'Espèces' | 'Mobile Money'>('Virement bancaire');
  const [referenceTransaction, setReferenceTransaction] = useState<string>('');
  const [remiseAmount, setRemiseAmount] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');

  // Selected unsettled lines to pay in this bordereau
  interface StagedPaymentLine {
    prestationId: string;
    lignePrestationId: string;
    personneNom: string;
    matricule: string;
    factureNum: string;
    codeActe: string;
    libelleActe: string;
    montantFacture: number;
    dejaPaye: number;
    resteAPayer: number;
    // User editable inputs for this settlement line
    selected: boolean;
    totalPaye: number;
    ticketModerateur: number;
    montantExclu: number;
    commentaire: string;
  }

  const [stagedLines, setStagedLines] = useState<StagedPaymentLine[]>([]);

  const filteredPaiements = paiements.filter(p => {
    const matchesSociete = selectedSocieteId === 'ALL' || p.societeId === selectedSocieteId;
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      p.numeroBordereau.toLowerCase().includes(searchLower) ||
      p.referencePaiement.toLowerCase().includes(searchLower) ||
      (p.notes && p.notes.toLowerCase().includes(searchLower));
    return matchesSociete && matchesSearch;
  });

  const getSocieteNom = (id: string) => societes.find(s => s.id === id)?.nom || 'Société';

  const handleOpenCreateModal = () => {
    const socId = selectedSocieteId !== 'ALL' ? selectedSocieteId : societes[0]?.id || '';
    setTargetSocieteId(socId);
    setBordereauRef(`BORD-${new Date().getFullYear()}-${String(paiements.length + 1).padStart(3, '0')}`);
    setDatePaiement(new Date().toISOString().split('T')[0]);
    setModePaiement('Virement bancaire');
    setReferenceTransaction(`VIR-${Date.now().toString().substring(6)}`);
    setRemiseAmount(0);
    setNotes('');

    // Load available unpaid/partially paid lines for this society
    loadLinesForSociete(socId);
    setIsCreateModalOpen(true);
  };

  const loadLinesForSociete = (socId: string) => {
    const lines: StagedPaymentLine[] = [];
    const targetPrestations = prestations.filter(p => p.societeId === socId && p.statut !== 'Payé' && p.statut !== 'Rejeté');
    const soc = societes.find(s => s.id === socId);
    const taux = soc?.tauxCouvertureDefaut || 80;

    targetPrestations.forEach(p => {
      const personne = personnes.find(pers => pers.id === p.personneId);
      p.lignes.forEach(l => {
        const reste = Math.max(0, l.totalPrestation - (l.totalPaye || 0));
        if (reste > 0) {
          const defaultPaye = Math.round(reste * (taux / 100));
          const defaultCopay = Math.round(reste * (1 - taux / 100));
          lines.push({
            prestationId: p.id,
            lignePrestationId: l.id,
            personneNom: personne?.nomPrenom || 'Inconnu',
            matricule: personne?.matricule || '-',
            factureNum: p.numeroFacture,
            codeActe: l.code,
            libelleActe: l.libelle || 'Acte médical',
            montantFacture: l.totalPrestation,
            dejaPaye: l.totalPaye || 0,
            resteAPayer: reste,
            selected: true,
            totalPaye: defaultPaye,
            ticketModerateur: defaultCopay,
            montantExclu: 0,
            commentaire: 'Pris en charge au barème standard',
          });
        }
      });
    });

    setStagedLines(lines);
  };

  const handleToggleSelectLine = (index: number) => {
    setStagedLines(prev => {
      const updated = [...prev];
      updated[index].selected = !updated[index].selected;
      return updated;
    });
  };

  const handleUpdateStagedLine = (index: number, field: keyof StagedPaymentLine, value: any) => {
    setStagedLines(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
      return updated;
    });
  };

  // Computations for active settlement form
  const selectedStaged = stagedLines.filter(l => l.selected);
  const calculatedTotalReclame = selectedStaged.reduce((s, l) => s + l.resteAPayer, 0);
  const calculatedTotalPaye = selectedStaged.reduce((s, l) => s + Number(l.totalPaye || 0), 0);
  const calculatedTotalModerateur = selectedStaged.reduce((s, l) => s + Number(l.ticketModerateur || 0), 0);
  const calculatedTotalExclu = selectedStaged.reduce((s, l) => s + Number(l.montantExclu || 0), 0);

  const handleSubmitPaiement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bordereauRef) {
      alert('Veuillez spécifier une référence de bordereau.');
      return;
    }
    if (selectedStaged.length === 0) {
      alert('Veuillez cocher au moins une ligne de prestation à régler.');
      return;
    }

    const newPaiementId = generateId('pai');
    const newLignesPaiement: LignePaiement[] = selectedStaged.map(s => ({
      id: generateId('lp'),
      paiementId: newPaiementId,
      lignePrestationId: s.lignePrestationId,
      prestationId: s.prestationId,
      immatriculation: s.matricule,
      nomBaseAssurance: s.personneNom,
      totalPaye: Number(s.totalPaye || 0),
      ticketModerateur: Number(s.ticketModerateur || 0),
      montantExclu: Number(s.montantExclu || 0),
      commentaire: s.commentaire,
    }));

    const nouveauPaiement: Paiement = {
      id: newPaiementId,
      numeroBordereau: bordereauRef,
      datePaiement: datePaiement,
      dateSaisie: new Date().toISOString().split('T')[0],
      societeId: targetSocieteId,
      modePaiement: modePaiement,
      referencePaiement: referenceTransaction,
      totalReclame: calculatedTotalReclame,
      totalPaye: calculatedTotalPaye - remiseAmount,
      totalModerateur: calculatedTotalModerateur,
      totalExclu: calculatedTotalExclu,
      remise: remiseAmount,
      statut: 'Validé',
      notes: notes,
      lignes: newLignesPaiement,
    };

    // Update prestation lines and calculate new statuses
    const updatedPrestations = prestations.map(p => {
      const relatedPaidLines = newLignesPaiement.filter(lp => lp.prestationId === p.id);
      if (relatedPaidLines.length === 0) return p;

      const updatedLignes = p.lignes.map(l => {
        const foundPaid = relatedPaidLines.find(lp => lp.lignePrestationId === l.id);
        if (foundPaid) {
          return {
            ...l,
            totalPaye: (l.totalPaye || 0) + foundPaid.totalPaye,
          };
        }
        return l;
      });

      const totalPrestationVal = p.totalPrestation;
      const totalPaidAll = updatedLignes.reduce((sum, l) => sum + (l.totalPaye || 0), 0);
      const isFullyPaid = totalPaidAll >= (totalPrestationVal - p.participation);

      return {
        ...p,
        lignes: updatedLignes,
        statut: isFullyPaid ? ('Payé' as const) : ('Partiellement payé' as const),
      };
    });

    onSavePaiement(nouveauPaiement, updatedPrestations);
    setIsCreateModalOpen(false);
  };

  const handleExportExcel = () => {
    const rows = filteredPaiements.map(p => {
      const soc = societes.find(s => s.id === p.societeId);
      return {
        'N° Bordereau': p.numeroBordereau,
        'Date Règlement': p.datePaiement,
        'Date Saisie': p.dateSaisie,
        'Société': soc?.nom || '',
        'Mode Paiement': p.modePaiement,
        'Référence Transaction': p.referencePaiement,
        'Total Réclamé': p.totalReclame,
        'Total Réglé (Payé)': p.totalPaye,
        'Ticket Modérateur': p.totalModerateur,
        'Total Exclu': p.totalExclu,
        'Remise': p.remise,
        'Statut': p.statut,
        'Notes': p.notes || '',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Règlements');
    XLSX.writeFile(workbook, `Reglements_Assurance_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div id="paiements-view" className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Saisie & Bordereaux de Règlement</h2>
          <p className="text-xs text-slate-500">
            Enregistrement des virements assureurs, lettrage des prestations et calcul des exclusions
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            id="btn-import-decompte"
            onClick={() => setIsDecompteModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 shadow-xs transition"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Importer Décompte (ASCOMA / MCI / BSA)</span>
          </button>

          <button
            id="btn-export-paiements-xlsx"
            onClick={handleExportExcel}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs transition"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Exporter Excel</span>
          </button>

          <button
            id="btn-new-paiement"
            onClick={handleOpenCreateModal}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau Bordereau de Règlement</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Recherche par n° bordereau, référence..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 focus:bg-white"
          />
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Affichage de <span className="font-semibold text-slate-800">{filteredPaiements.length}</span> bordereaux
        </div>
      </div>

      {/* Paiements Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-3">Date Règlement</th>
                <th className="py-3 px-3">N° Bordereau</th>
                <th className="py-3 px-3">Société Assureur</th>
                <th className="py-3 px-3">Mode & Référence</th>
                <th className="py-3 px-3 text-right">Total Réclamé</th>
                <th className="py-3 px-3 text-right">Total Réglé</th>
                <th className="py-3 px-3 text-right">Ticket Modérateur</th>
                <th className="py-3 px-3 text-right">Exclu / Rejet</th>
                <th className="py-3 px-3 text-center">Statut</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPaiements.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    Aucun bordereau de règlement enregistré pour cette sélection.
                  </td>
                </tr>
              ) : (
                filteredPaiements.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-3 text-slate-600 font-medium">{formatDate(p.datePaiement)}</td>
                    <td className="py-3 px-3 font-bold text-indigo-700">{p.numeroBordereau}</td>
                    <td className="py-3 px-3 font-medium text-slate-900">{getSocieteNom(p.societeId)}</td>
                    <td className="py-3 px-3">
                      <div className="text-slate-800 font-medium">{p.modePaiement}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{p.referencePaiement}</div>
                    </td>
                    <td className="py-3 px-3 text-right text-slate-600">{formatMoney(p.totalReclame)}</td>
                    <td className="py-3 px-3 text-right font-bold text-emerald-700">{formatMoney(p.totalPaye)}</td>
                    <td className="py-3 px-3 text-right text-amber-700 font-medium">{formatMoney(p.totalModerateur)}</td>
                    <td className="py-3 px-3 text-right text-rose-600 font-medium">{formatMoney(p.totalExclu)}</td>
                    <td className="py-3 px-3 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {p.statut}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => setViewingPaiement(p)}
                          title="Visualiser le bordereau"
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Voulez-vous supprimer le bordereau ${p.numeroBordereau} ?`)) {
                              onDeletePaiement(p.id);
                            }
                          }}
                          title="Supprimer"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: View Bordereau Details */}
      {viewingPaiement && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Receipt className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900">Bordereau de Règlement {viewingPaiement.numeroBordereau}</h3>
              </div>
              <button
                onClick={() => setViewingPaiement(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-4 rounded-xl">
              <div>
                <span className="text-slate-400 block text-[10px]">Date Règlement</span>
                <span className="font-semibold text-slate-900">{formatDate(viewingPaiement.datePaiement)}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Société d'Assurance</span>
                <span className="font-semibold text-slate-900">{getSocieteNom(viewingPaiement.societeId)}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Mode de Règlement</span>
                <span className="font-semibold text-slate-900">{viewingPaiement.modePaiement}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Référence Transaction</span>
                <span className="font-semibold font-mono text-slate-900">{viewingPaiement.referencePaiement}</span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Lignes & Prestations Réglées</h4>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 text-slate-600">
                    <tr>
                      <th className="p-2 text-left">Matricule</th>
                      <th className="p-2 text-left">Assuré</th>
                      <th className="p-2 text-right">Montant Réglé</th>
                      <th className="p-2 text-right">Ticket Modérateur</th>
                      <th className="p-2 text-right">Montant Exclu</th>
                      <th className="p-2 text-left">Observations</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viewingPaiement.lignes.map(l => (
                      <tr key={l.id}>
                        <td className="p-2 font-mono font-medium text-indigo-700">{l.immatriculation}</td>
                        <td className="p-2 font-semibold text-slate-800">{l.nomBaseAssurance}</td>
                        <td className="p-2 text-right font-bold text-emerald-700">{formatMoney(l.totalPaye)}</td>
                        <td className="p-2 text-right text-amber-700 font-medium">{formatMoney(l.ticketModerateur)}</td>
                        <td className="p-2 text-right text-rose-600 font-medium">{formatMoney(l.montantExclu)}</td>
                        <td className="p-2 text-slate-500 text-[11px]">{l.commentaire || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-center text-xs">
              <div className="bg-slate-100 p-2 rounded-lg">
                <span className="text-[10px] text-slate-500 block">Total Réclamé</span>
                <span className="font-bold text-slate-800">{formatMoney(viewingPaiement.totalReclame)}</span>
              </div>
              <div className="bg-emerald-50 p-2 rounded-lg">
                <span className="text-[10px] text-emerald-700 block">Total Réglé (Net)</span>
                <span className="font-bold text-emerald-800">{formatMoney(viewingPaiement.totalPaye)}</span>
              </div>
              <div className="bg-amber-50 p-2 rounded-lg">
                <span className="text-[10px] text-amber-700 block">Ticket Modérateur</span>
                <span className="font-bold text-amber-800">{formatMoney(viewingPaiement.totalModerateur)}</span>
              </div>
              <div className="bg-rose-50 p-2 rounded-lg">
                <span className="text-[10px] text-rose-700 block">Exclusions / Rejets</span>
                <span className="font-bold text-rose-800">{formatMoney(viewingPaiement.totalExclu)}</span>
              </div>
            </div>

            {viewingPaiement.notes && (
              <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="font-semibold block text-slate-800">Notes du bordereau :</span>
                {viewingPaiement.notes}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setViewingPaiement(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Saisie de Règlement (FEN_Saisie_Paiement) */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-5xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <FileCheck2 className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-base">Saisie et Lettrage d'un Bordereau de Règlement Assurance</h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitPaiement} className="space-y-4">
              {/* Header Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Société Assureur *</label>
                  <select
                    value={targetSocieteId}
                    onChange={(e) => {
                      setTargetSocieteId(e.target.value);
                      loadLinesForSociete(e.target.value);
                    }}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    {societes.map(s => (
                      <option key={s.id} value={s.id}>{s.nom} (Taux: {s.tauxCouvertureDefaut}%)</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">N° Bordereau de Paiement *</label>
                  <input
                    type="text"
                    required
                    value={bordereauRef}
                    onChange={(e) => setBordereauRef(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none font-semibold text-indigo-700"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Date du Règlement *</label>
                  <input
                    type="date"
                    required
                    value={datePaiement}
                    onChange={(e) => setDatePaiement(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Mode de Paiement</label>
                  <select
                    value={modePaiement}
                    onChange={(e) => setModePaiement(e.target.value as any)}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="Virement bancaire">Virement bancaire</option>
                    <option value="Chèque">Chèque</option>
                    <option value="Espèces">Espèces</option>
                    <option value="Mobile Money">Mobile Money</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Réf. Transaction / Chèque N°</label>
                  <input
                    type="text"
                    value={referenceTransaction}
                    onChange={(e) => setReferenceTransaction(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="Ex: VIR-BNI-202501"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Remise / Déduction Globale (Ar)</label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={remiseAmount}
                    onChange={(e) => setRemiseAmount(Number(e.target.value) || 0)}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-700 font-semibold mb-1">Notes / Motif du Règlement</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="Ex: Rapprochement quinzaine assurance santé..."
                  />
                </div>
              </div>

              {/* Table of Unsettled Lines to Match */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                    Prestations en Attente de Règlement pour {getSocieteNom(targetSocieteId)} ({stagedLines.length} actes disponibles)
                  </h4>
                  <div className="space-x-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setStagedLines(prev => prev.map(l => ({ ...l, selected: true })))}
                      className="text-indigo-600 hover:underline font-medium"
                    >
                      Tout cocher
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setStagedLines(prev => prev.map(l => ({ ...l, selected: false })))}
                      className="text-slate-500 hover:underline font-medium"
                    >
                      Tout décocher
                    </button>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 text-slate-600 sticky top-0 z-10 text-[11px]">
                      <tr>
                        <th className="p-2 w-8 text-center"></th>
                        <th className="p-2 text-left">Facture & Assuré</th>
                        <th className="p-2 text-left">Acte</th>
                        <th className="p-2 text-right">Reste à Payer</th>
                        <th className="p-2 text-right w-28">Part Réglée (Ar)</th>
                        <th className="p-2 text-right w-28">Ticket Modérateur</th>
                        <th className="p-2 text-right w-24">Exclusion / Rejet</th>
                        <th className="p-2 text-left">Remarque / Motif</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {stagedLines.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-6 text-center text-slate-400">
                            Aucune prestation en attente pour cette société d'assurance.
                          </td>
                        </tr>
                      ) : (
                        stagedLines.map((line, idx) => (
                          <tr key={`${line.prestationId}-${line.lignePrestationId}`} className={line.selected ? 'bg-indigo-50/30' : 'bg-white opacity-60'}>
                            <td className="p-2 text-center">
                              <input
                                type="checkbox"
                                checked={line.selected}
                                onChange={() => handleToggleSelectLine(idx)}
                                className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                              />
                            </td>
                            <td className="p-2">
                              <div className="font-bold text-indigo-700">{line.factureNum}</div>
                              <div className="text-[10px] text-slate-600">{line.personneNom} ({line.matricule})</div>
                            </td>
                            <td className="p-2">
                              <span className="font-mono font-bold text-slate-700 mr-1">{line.codeActe}:</span>
                              <span className="text-slate-600">{line.libelleActe}</span>
                            </td>
                            <td className="p-2 text-right font-medium text-slate-700">
                              {formatMoney(line.resteAPayer)}
                            </td>
                            <td className="p-2 text-right">
                              <input
                                type="number"
                                min="0"
                                disabled={!line.selected}
                                value={line.totalPaye}
                                onChange={(e) => handleUpdateStagedLine(idx, 'totalPaye', Number(e.target.value) || 0)}
                                className="w-full p-1 border border-slate-300 rounded text-right font-bold text-emerald-700 bg-white"
                              />
                            </td>
                            <td className="p-2 text-right">
                              <input
                                type="number"
                                min="0"
                                disabled={!line.selected}
                                value={line.ticketModerateur}
                                onChange={(e) => handleUpdateStagedLine(idx, 'ticketModerateur', Number(e.target.value) || 0)}
                                className="w-full p-1 border border-slate-300 rounded text-right font-medium text-amber-700 bg-white"
                              />
                            </td>
                            <td className="p-2 text-right">
                              <input
                                type="number"
                                min="0"
                                disabled={!line.selected}
                                value={line.montantExclu}
                                onChange={(e) => handleUpdateStagedLine(idx, 'montantExclu', Number(e.target.value) || 0)}
                                className="w-full p-1 border border-slate-300 rounded text-right font-medium text-rose-600 bg-white"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                disabled={!line.selected}
                                value={line.commentaire}
                                onChange={(e) => handleUpdateStagedLine(idx, 'commentaire', e.target.value)}
                                placeholder="Commentaire..."
                                className="w-full p-1 border border-slate-300 rounded text-[11px] bg-white"
                              />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Summary Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-emerald-50/70 p-4 rounded-xl border border-emerald-200 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px]">Total Réclamé Sélectionné</span>
                  <span className="text-sm font-bold text-slate-800">{formatMoney(calculatedTotalReclame)}</span>
                </div>
                <div>
                  <span className="text-emerald-700 block text-[10px] font-semibold">Montant Net Réglé (Payé)</span>
                  <span className="text-base font-extrabold text-emerald-800">{formatMoney(calculatedTotalPaye - remiseAmount)}</span>
                </div>
                <div>
                  <span className="text-amber-700 block text-[10px]">Tickets Modérateurs</span>
                  <span className="text-sm font-bold text-amber-800">{formatMoney(calculatedTotalModerateur)}</span>
                </div>
                <div>
                  <span className="text-rose-700 block text-[10px]">Total Exclu / Rejets</span>
                  <span className="text-sm font-bold text-rose-800">{formatMoney(calculatedTotalExclu)}</span>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-100"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={selectedStaged.length === 0}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white shadow-sm flex items-center space-x-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Valider et Enregistrer le Bordereau</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Decompte Import Modal */}
      <DecompteImportModal
        isOpen={isDecompteModalOpen}
        onClose={() => setIsDecompteModalOpen(false)}
        societes={societes}
        personnes={personnes}
        prestations={prestations}
        familles={familles}
        onSavePaiement={(newPaiement, updatedPrestations, newSocietes, newPersonnes) => {
          if (onImportPaiements) {
            onImportPaiements(newPaiement, updatedPrestations, newSocietes, newPersonnes);
          } else {
            onSavePaiement(newPaiement, updatedPrestations);
          }
        }}
      />
    </div>
  );
};
