import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Eye, 
  Edit3, 
  Trash2, 
  FileText, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  ChevronDown, 
  ChevronRight,
  Download,
  X,
  User,
  Building,
  Calendar,
  FileSpreadsheet
} from 'lucide-react';
import { Prestation, LignePrestation, Societe, Personne, Famille } from '../types';
import { formatMoney, formatDate, generateId } from '../utils/formatters';
import { SalfaImportModal } from './SalfaImportModal';
import * as XLSX from 'xlsx';

interface PrestationsViewProps {
  prestations: Prestation[];
  societes: Societe[];
  personnes: Personne[];
  familles: Famille[];
  selectedSocieteId: string;
  onSavePrestation: (prestation: Prestation) => void;
  onDeletePrestation: (id: string) => void;
  onImportPrestations?: (newPrestations: Prestation[], newSocietes?: Societe[], newPersonnes?: Personne[]) => void;
  isCreateModalOpen: boolean;
  setIsCreateModalOpen: (open: boolean) => void;
}

export const PrestationsView: React.FC<PrestationsViewProps> = ({
  prestations,
  societes,
  personnes,
  familles,
  selectedSocieteId,
  onSavePrestation,
  onDeletePrestation,
  onImportPrestations,
  isCreateModalOpen,
  setIsCreateModalOpen,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [viewingPrestation, setViewingPrestation] = useState<Prestation | null>(null);
  const [editingPrestation, setEditingPrestation] = useState<Prestation | null>(null);
  const [isSalfaModalOpen, setIsSalfaModalOpen] = useState<boolean>(false);

  // Form State for Create/Edit Modal
  const [formData, setFormData] = useState<Partial<Prestation>>({
    numeroFacture: '',
    date: new Date().toISOString().split('T')[0],
    societeId: societes[0]?.id || '',
    sousSociete: 'Direction / Siège',
    personneId: personnes[0]?.id || '',
    commentaires: '',
    statut: 'En attente',
    lignes: [
      {
        id: generateId('lig'),
        prestationId: '',
        code: 'CONS',
        libelle: 'Consultation médicale',
        totalPrestation: 40000,
        totalPaye: 0,
      }
    ],
  });

  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Filtered List
  const filteredList = prestations.filter(p => {
    const matchesSociete = selectedSocieteId === 'ALL' || p.societeId === selectedSocieteId;
    const matchesStatus = statusFilter === 'ALL' || p.statut === statusFilter;
    const personne = personnes.find(pers => pers.id === p.personneId);
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      p.numeroFacture.toLowerCase().includes(searchLower) ||
      (personne && personne.nomPrenom.toLowerCase().includes(searchLower)) ||
      (personne && personne.matricule.toLowerCase().includes(searchLower)) ||
      (p.commentaires && p.commentaires.toLowerCase().includes(searchLower));

    return matchesSociete && matchesStatus && matchesSearch;
  });

  const getSocieteNom = (id: string) => societes.find(s => s.id === id)?.nom || 'Société';
  const getPersonne = (id: string) => personnes.find(p => p.id === id);

  const handleOpenCreate = () => {
    const defaultSoc = societes[0];
    const defaultTaux = defaultSoc?.tauxCouvertureDefaut || 80;
    const initialMontant = 50000;
    const initialParticipation = Math.round(initialMontant * (1 - defaultTaux / 100));

    setFormData({
      numeroFacture: `FACT-${new Date().getFullYear()}-${String(prestations.length + 1).padStart(3, '0')}`,
      date: new Date().toISOString().split('T')[0],
      societeId: defaultSoc?.id || '',
      sousSociete: 'Département Principal',
      personneId: personnes[0]?.id || '',
      totalPrestation: initialMontant,
      participation: initialParticipation,
      statut: 'En attente',
      dateCreation: new Date().toISOString().split('T')[0],
      commentaires: '',
      lignes: [
        {
          id: generateId('lig'),
          prestationId: '',
          code: 'CONS',
          libelle: 'Consultation & soins médicaux',
          totalPrestation: initialMontant,
          totalPaye: 0,
        }
      ]
    });
    setEditingPrestation(null);
    setIsCreateModalOpen(true);
  };

  const handleOpenEdit = (p: Prestation) => {
    setEditingPrestation(p);
    setFormData({
      ...p,
      lignes: [...p.lignes],
    });
    setIsCreateModalOpen(true);
  };

  const handleAddLine = () => {
    const newLignes = [
      ...(formData.lignes || []),
      {
        id: generateId('lig'),
        prestationId: formData.id || '',
        code: 'PHAR',
        libelle: 'Médicaments / Soins complémentaires',
        totalPrestation: 30000,
        totalPaye: 0,
      }
    ];
    recalcFormTotals(newLignes, formData.societeId);
  };

  const handleRemoveLine = (index: number) => {
    const newLignes = [...(formData.lignes || [])];
    newLignes.splice(index, 1);
    recalcFormTotals(newLignes, formData.societeId);
  };

  const handleLineChange = (index: number, field: keyof LignePrestation, value: any) => {
    const newLignes = [...(formData.lignes || [])];
    newLignes[index] = {
      ...newLignes[index],
      [field]: field === 'totalPrestation' ? Number(value) || 0 : value,
    };
    recalcFormTotals(newLignes, formData.societeId);
  };

  const recalcFormTotals = (lignes: LignePrestation[], socId?: string) => {
    const total = lignes.reduce((sum, l) => sum + (l.totalPrestation || 0), 0);
    const soc = societes.find(s => s.id === (socId || formData.societeId));
    const taux = soc ? soc.tauxCouvertureDefaut : 80;
    const ticketModerateur = Math.round(total * (1 - (taux / 100)));

    setFormData(prev => ({
      ...prev,
      lignes,
      totalPrestation: total,
      participation: ticketModerateur,
    }));
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.numeroFacture || !formData.personneId || !formData.societeId) {
      alert('Veuillez remplir tous les champs obligatoires (Facture, Société, Assuré).');
      return;
    }

    const prestationToSave: Prestation = {
      id: editingPrestation ? editingPrestation.id : generateId('prest'),
      numeroFacture: formData.numeroFacture!,
      date: formData.date || new Date().toISOString().split('T')[0],
      societeId: formData.societeId!,
      sousSociete: formData.sousSociete || '',
      personneId: formData.personneId!,
      totalPrestation: formData.totalPrestation || 0,
      participation: formData.participation || 0,
      statut: (formData.statut as any) || 'En attente',
      dateCreation: formData.dateCreation || new Date().toISOString().split('T')[0],
      commentaires: formData.commentaires || '',
      lignes: (formData.lignes || []).map(l => ({
        ...l,
        prestationId: editingPrestation ? editingPrestation.id : (formData.id || ''),
      })),
    };

    onSavePrestation(prestationToSave);
    setIsCreateModalOpen(false);
  };

  const handleExportExcel = () => {
    const rows = filteredList.map(p => {
      const personne = getPersonne(p.personneId);
      const soc = societes.find(s => s.id === p.societeId);
      return {
        'N° Facture': p.numeroFacture,
        'Date Soins': p.date,
        'Société': soc?.nom || '',
        'Sous-Société / Service': p.sousSociete,
        'Matricule': personne?.matricule || '',
        'Nom & Prénom': personne?.nomPrenom || '',
        'Total Facturé': p.totalPrestation,
        'Ticket Modérateur': p.participation,
        'Statut': p.statut,
        'Nombre d\'actes': p.lignes.length,
        'Observations': p.commentaires || '',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Prestations');
    XLSX.writeFile(workbook, `Prestations_Assurance_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div id="prestations-view" className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Dossiers de Prestations & Soins</h2>
          <p className="text-xs text-slate-500">
            Enregistrement des factures médicales, actes de soins et calcul des tickets modérateurs
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            id="btn-import-salfa"
            onClick={() => setIsSalfaModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 shadow-xs transition"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600" />
            <span>Importer Facture SALFA</span>
          </button>

          <button
            id="btn-export-prestations-xlsx"
            onClick={handleExportExcel}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs transition"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Exporter Excel</span>
          </button>

          <button
            id="btn-new-prestation"
            onClick={handleOpenCreate}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvelle Facture Prestation</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Recherche par facture, nom, matricule..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="flex items-center space-x-1 text-xs text-slate-500 font-medium">
            <Filter className="w-3.5 h-3.5" />
            <span>Statut:</span>
          </div>

          {['ALL', 'En attente', 'Partiellement payé', 'Payé', 'Rejeté'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                statusFilter === status
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {status === 'ALL' ? 'Tous' : status}
            </button>
          ))}
        </div>
      </div>

      {/* Prestations Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-3 w-10"></th>
                <th className="py-3 px-3">Date Soins</th>
                <th className="py-3 px-3">N° Facture</th>
                <th className="py-3 px-3">Assuré / Adhérent</th>
                <th className="py-3 px-3">Société / Branche</th>
                <th className="py-3 px-3 text-right">Montant Total</th>
                <th className="py-3 px-3 text-right">Ticket Modérateur</th>
                <th className="py-3 px-3 text-right">Remboursé</th>
                <th className="py-3 px-3 text-center">Statut</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    Aucun dossier de prestation ne correspond aux critères.
                  </td>
                </tr>
              ) : (
                filteredList.map(prestation => {
                  const isExpanded = !!expandedRows[prestation.id];
                  const personne = getPersonne(prestation.personneId);
                  const totalPayePrestation = prestation.lignes.reduce((sum, l) => sum + (l.totalPaye || 0), 0);

                  return (
                    <React.Fragment key={prestation.id}>
                      <tr className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => toggleRow(prestation.id)}
                            className="p-1 text-slate-400 hover:text-indigo-600 transition"
                            title="Afficher/masquer les actes médicaux"
                          >
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        </td>
                        <td className="py-3 px-3 text-slate-600 font-medium">
                          {formatDate(prestation.date)}
                        </td>
                        <td className="py-3 px-3 font-bold text-indigo-700">
                          {prestation.numeroFacture}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-900">{personne?.nomPrenom || 'Inconnu'}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{personne?.matricule || '-'} • {personne?.qualite || 'Adhérent'}</div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="text-slate-800 font-medium">{getSocieteNom(prestation.societeId)}</div>
                          <div className="text-[10px] text-slate-400">{prestation.sousSociete}</div>
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-slate-900">
                          {formatMoney(prestation.totalPrestation)}
                        </td>
                        <td className="py-3 px-3 text-right text-amber-700 font-medium">
                          {formatMoney(prestation.participation)}
                        </td>
                        <td className="py-3 px-3 text-right text-emerald-700 font-semibold">
                          {formatMoney(totalPayePrestation)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            prestation.statut === 'Payé'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : prestation.statut === 'Partiellement payé'
                              ? 'bg-sky-100 text-sky-800 border border-sky-200'
                              : prestation.statut === 'Rejeté'
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}>
                            {prestation.statut}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              onClick={() => setViewingPrestation(prestation)}
                              title="Visualiser détails"
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleOpenEdit(prestation)}
                              title="Modifier la prestation"
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Êtes-vous sûr de vouloir supprimer la facture ${prestation.numeroFacture} ?`)) {
                                  onDeletePrestation(prestation.id);
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

                      {/* Nested Expandable Sub-Table of Medical Acts */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90 border-y border-slate-200/80">
                          <td colSpan={10} className="p-4 pl-12">
                            <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-xs space-y-2">
                              <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                                <span>Actes & Lignes de Soins détaillées</span>
                                <span className="text-slate-400 lowercase font-normal">{prestation.lignes.length} actes enregistrés</span>
                              </div>
                              <table className="w-full text-xs">
                                <thead className="text-[10px] text-slate-400 uppercase bg-slate-50">
                                  <tr>
                                    <th className="py-1.5 px-2 text-left">Code Famille</th>
                                    <th className="py-1.5 px-2 text-left">Libellé / Acte médical</th>
                                    <th className="py-1.5 px-2 text-right">Montant Engagé</th>
                                    <th className="py-1.5 px-2 text-right">Montant Remboursé</th>
                                    <th className="py-1.5 px-2 text-right">Solde restant</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {prestation.lignes.map(ligne => (
                                    <tr key={ligne.id}>
                                      <td className="py-1.5 px-2 font-mono font-bold text-indigo-700">
                                        {ligne.code}
                                      </td>
                                      <td className="py-1.5 px-2 text-slate-700">
                                        {ligne.libelle || 'Acte de soins'}
                                      </td>
                                      <td className="py-1.5 px-2 text-right font-medium text-slate-900">
                                        {formatMoney(ligne.totalPrestation)}
                                      </td>
                                      <td className="py-1.5 px-2 text-right font-semibold text-emerald-600">
                                        {formatMoney(ligne.totalPaye || 0)}
                                      </td>
                                      <td className="py-1.5 px-2 text-right text-slate-500 font-mono">
                                        {formatMoney(Math.max(0, ligne.totalPrestation - (ligne.totalPaye || 0)))}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: View Prestation (FEN_Vision_Prestation) */}
      {viewingPrestation && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900">Détails de la Prestation {viewingPrestation.numeroFacture}</h3>
              </div>
              <button
                onClick={() => setViewingPrestation(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs bg-slate-50 p-4 rounded-xl">
              <div>
                <span className="text-slate-400 block text-[10px]">Date des soins</span>
                <span className="font-semibold text-slate-900">{formatDate(viewingPrestation.date)}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Société / Assureur</span>
                <span className="font-semibold text-slate-900">{getSocieteNom(viewingPrestation.societeId)}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Sous-Société / Service</span>
                <span className="font-semibold text-slate-900">{viewingPrestation.sousSociete}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Adhérent / Assuré</span>
                <span className="font-semibold text-slate-900">{getPersonne(viewingPrestation.personneId)?.nomPrenom}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Matricule</span>
                <span className="font-semibold font-mono text-slate-900">{getPersonne(viewingPrestation.personneId)?.matricule}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Statut</span>
                <span className="font-semibold text-indigo-600">{viewingPrestation.statut}</span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Actes Médicaux & Lignes</h4>
              <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="p-2 text-left">Code</th>
                    <th className="p-2 text-left">Libellé</th>
                    <th className="p-2 text-right">Montant</th>
                    <th className="p-2 text-right">Remboursé</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viewingPrestation.lignes.map(l => (
                    <tr key={l.id}>
                      <td className="p-2 font-mono font-bold text-indigo-600">{l.code}</td>
                      <td className="p-2">{l.libelle}</td>
                      <td className="p-2 text-right font-medium">{formatMoney(l.totalPrestation)}</td>
                      <td className="p-2 text-right font-semibold text-emerald-600">{formatMoney(l.totalPaye)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-100 text-center">
              <div className="bg-slate-100 p-2.5 rounded-lg">
                <span className="text-[10px] text-slate-500 block">Total Facture</span>
                <span className="font-bold text-slate-900">{formatMoney(viewingPrestation.totalPrestation)}</span>
              </div>
              <div className="bg-amber-50 p-2.5 rounded-lg">
                <span className="text-[10px] text-amber-700 block">Ticket Modérateur</span>
                <span className="font-bold text-amber-800">{formatMoney(viewingPrestation.participation)}</span>
              </div>
              <div className="bg-emerald-50 p-2.5 rounded-lg">
                <span className="text-[10px] text-emerald-700 block">Total Remboursé</span>
                <span className="font-bold text-emerald-800">
                  {formatMoney(viewingPrestation.lignes.reduce((s, l) => s + (l.totalPaye || 0), 0))}
                </span>
              </div>
            </div>

            {viewingPrestation.commentaires && (
              <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="font-semibold block text-slate-800">Commentaires :</span>
                {viewingPrestation.commentaires}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setViewingPrestation(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create or Edit Prestation (FEN_Fiche_Prestation) */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">
                {editingPrestation ? 'Modifier la Facture Prestation' : 'Enregistrer une Nouvelle Prestation de Soins'}
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Numéro Facture *</label>
                  <input
                    type="text"
                    required
                    value={formData.numeroFacture || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, numeroFacture: e.target.value }))}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="Ex: FACT-2025-001"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Date des Soins *</label>
                  <input
                    type="date"
                    required
                    value={formData.date || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Société d'Assurance *</label>
                  <select
                    value={formData.societeId || ''}
                    onChange={(e) => {
                      const newSocId = e.target.value;
                      setFormData(prev => ({ ...prev, societeId: newSocId }));
                      recalcFormTotals(formData.lignes || [], newSocId);
                    }}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    {societes.map(s => (
                      <option key={s.id} value={s.id}>{s.nom} ({s.tauxCouvertureDefaut}%)</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Sous-Société / Service</label>
                  <input
                    type="text"
                    value={formData.sousSociete || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, sousSociete: e.target.value }))}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="Ex: Service Commercial"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-700 font-semibold mb-1">Adhérent / Assuré Bénéficiaire *</label>
                  <select
                    value={formData.personneId || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, personneId: e.target.value }))}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    {personnes.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.nomPrenom} (Mat: {p.matricule} - {p.qualite})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dynamic Line Items */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">Actes Médicaux (Lignes de Prestation)</h4>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="flex items-center space-x-1 text-xs text-indigo-600 font-semibold hover:text-indigo-800"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Ajouter un Acte</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {(formData.lignes || []).map((ligne, idx) => (
                    <div key={ligne.id || idx} className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-slate-200 text-xs">
                      <div className="w-32">
                        <select
                          value={ligne.code}
                          onChange={(e) => handleLineChange(idx, 'code', e.target.value)}
                          className="w-full p-1.5 border border-slate-300 rounded font-semibold text-indigo-700 bg-indigo-50/50"
                        >
                          {familles.map(f => (
                            <option key={f.code} value={f.code}>{f.code} - {f.libelle.substring(0, 22)}...</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex-1">
                        <input
                          type="text"
                          placeholder="Description de l'acte ou des soins"
                          value={ligne.libelle || ''}
                          onChange={(e) => handleLineChange(idx, 'libelle', e.target.value)}
                          className="w-full p-1.5 border border-slate-300 rounded"
                        />
                      </div>

                      <div className="w-28">
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          placeholder="Montant"
                          value={ligne.totalPrestation || 0}
                          onChange={(e) => handleLineChange(idx, 'totalPrestation', e.target.value)}
                          className="w-full p-1.5 border border-slate-300 rounded text-right font-semibold"
                        />
                      </div>

                      {formData.lignes && formData.lignes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center bg-indigo-50/60 p-3 rounded-lg border border-indigo-100 text-xs">
                  <div>
                    <span className="text-slate-500 mr-2">Ticket Modérateur Estimé :</span>
                    <span className="font-bold text-amber-700">{formatMoney(formData.participation)}</span>
                  </div>
                  <div>
                    <span className="text-slate-700 font-bold mr-2">Total Dossier :</span>
                    <span className="text-sm font-extrabold text-indigo-900">{formatMoney(formData.totalPrestation)}</span>
                  </div>
                </div>
              </div>

              {/* Status and Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Statut du Dossier</label>
                  <select
                    value={formData.statut || 'En attente'}
                    onChange={(e) => setFormData(prev => ({ ...prev, statut: e.target.value as any }))}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="En attente">En attente</option>
                    <option value="Partiellement payé">Partiellement payé</option>
                    <option value="Payé">Payé</option>
                    <option value="Rejeté">Rejeté</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Commentaires / Remarques</label>
                  <input
                    type="text"
                    value={formData.commentaires || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, commentaires: e.target.value }))}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="Observations médicales ou administratives..."
                  />
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
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm"
                >
                  {editingPrestation ? 'Enregistrer les modifications' : 'Créer la Prestation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Salfa Import Modal */}
      <SalfaImportModal
        isOpen={isSalfaModalOpen}
        onClose={() => setIsSalfaModalOpen(false)}
        societes={societes}
        personnes={personnes}
        familles={familles}
        onImportPrestations={(newPrests, newSocs, newPers) => {
          if (onImportPrestations) {
            onImportPrestations(newPrests, newSocs, newPers);
          } else {
            newPrests.forEach(p => onSavePrestation(p));
          }
        }}
      />
    </div>
  );
};
