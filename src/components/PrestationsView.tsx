import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Eye, 
  Edit3, 
  Trash2, 
  FileText, 
  CheckCircle, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ChevronDown, 
  ChevronRight,
  Download,
  X,
  User,
  Building,
  Building2,
  Calendar,
  FileSpreadsheet,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  SlidersHorizontal,
  DollarSign
} from 'lucide-react';
import { Prestation, LignePrestation, Paiement, Societe, Personne, Famille } from '../types';
import { formatMoney, formatDate, generateId } from '../utils/formatters';
import { SalfaImportModal } from './SalfaImportModal';
import * as XLSX from 'xlsx';

interface PrestationsViewProps {
  prestations: Prestation[];
  paiements?: Paiement[];
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

type SortField = 
  | 'date' 
  | 'numeroFacture' 
  | 'nom' 
  | 'societe' 
  | 'totalPrestation' 
  | 'participation' 
  | 'montantARembourser' 
  | 'totalPaye' 
  | 'resteAPayer' 
  | 'statut';

type SortDirection = 'asc' | 'desc';

export const PrestationsView: React.FC<PrestationsViewProps> = ({
  prestations,
  paiements = [],
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
  // Multi-criteria filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [filterSocieteId, setFilterSocieteId] = useState<string>(selectedSocieteId);
  const [filterSousSociete, setFilterSousSociete] = useState<string>('ALL');
  const [dateDebut, setDateDebut] = useState<string>('');
  const [dateFin, setDateFin] = useState<string>('');
  const [soldeFilter, setSoldeFilter] = useState<'ALL' | 'NON_SOLDE' | 'SOLDE'>('ALL');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);

  // Sorting state
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [viewingPrestation, setViewingPrestation] = useState<Prestation | null>(null);
  const [editingPrestation, setEditingPrestation] = useState<Prestation | null>(null);
  const [isSalfaModalOpen, setIsSalfaModalOpen] = useState<boolean>(false);

  // Sync prop selectedSocieteId
  React.useEffect(() => {
    if (selectedSocieteId !== 'ALL') {
      setFilterSocieteId(selectedSocieteId);
    }
  }, [selectedSocieteId]);

  // Unique list of sous-sociétés for filter dropdown
  const uniqueSousSocietes = useMemo(() => {
    const set = new Set<string>();
    prestations.forEach(p => {
      if (p.sousSociete && p.sousSociete.trim()) {
        set.add(p.sousSociete.trim());
      }
    });
    return Array.from(set).sort();
  }, [prestations]);

  // Count active filters for badge
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchTerm.trim()) count++;
    if (statusFilter !== 'ALL') count++;
    if (filterSocieteId !== 'ALL') count++;
    if (filterSousSociete !== 'ALL') count++;
    if (dateDebut) count++;
    if (dateFin) count++;
    if (soldeFilter !== 'ALL') count++;
    return count;
  }, [searchTerm, statusFilter, filterSocieteId, filterSousSociete, dateDebut, dateFin, soldeFilter]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setFilterSocieteId(selectedSocieteId !== 'ALL' ? selectedSocieteId : 'ALL');
    setFilterSousSociete('ALL');
    setDateDebut('');
    setDateFin('');
    setSoldeFilter('ALL');
  };

  const setDatePreset = (preset: 'today' | 'this_month' | 'last_month' | 'this_year' | 'all') => {
    const now = new Date();
    if (preset === 'all') {
      setDateDebut('');
      setDateFin('');
      return;
    }
    if (preset === 'today') {
      const d = now.toISOString().split('T')[0];
      setDateDebut(d);
      setDateFin(d);
      return;
    }
    if (preset === 'this_month') {
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
      setDateDebut(`${year}-${month}-01`);
      setDateFin(`${year}-${month}-${String(lastDay).padStart(2, '0')}`);
      return;
    }
    if (preset === 'last_month') {
      const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const year = prevMonthDate.getFullYear();
      const month = String(prevMonthDate.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(year, prevMonthDate.getMonth() + 1, 0).getDate();
      setDateDebut(`${year}-${month}-01`);
      setDateFin(`${year}-${month}-${String(lastDay).padStart(2, '0')}`);
      return;
    }
    if (preset === 'this_year') {
      const year = now.getFullYear();
      setDateDebut(`${year}-01-01`);
      setDateFin(`${year}-12-31`);
      return;
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      // Default to desc for amounts & dates, asc for text
      if (['totalPrestation', 'participation', 'montantARembourser', 'totalPaye', 'resteAPayer', 'date'].includes(field)) {
        setSortDirection('desc');
      } else {
        setSortDirection('asc');
      }
    }
  };

  const getSocieteNom = (id: string) => societes.find(s => s.id === id)?.nom || 'Société';
  const getPersonne = (id: string) => personnes.find(p => p.id === id);

  // Pre-calculate payment relationships from paiements database
  const paymentsMap = useMemo(() => {
    const prestPaidMap: Record<string, number> = {};
    const linePaidMap: Record<string, number> = {};
    const prestBordereauxMap: Record<string, Array<{ 
      bordereau: string; 
      date: string; 
      mode: string; 
      montant: number; 
      nomAgent?: string;
      acteCode?: string; 
      acteLibelle?: string;
    }>> = {};

    (paiements || []).forEach(pm => {
      (pm.lignes || []).forEach(lp => {
        const pId = lp.prestationId;
        const pNum = lp.prestationNumero;
        const lId = lp.lignePrestationId;
        const amount = Number(lp.totalPaye ?? lp.montantPaye ?? 0);

        if (amount > 0) {
          if (pId) {
            prestPaidMap[pId] = (prestPaidMap[pId] || 0) + amount;
            if (!prestBordereauxMap[pId]) prestBordereauxMap[pId] = [];
            prestBordereauxMap[pId].push({
              bordereau: pm.numeroBordereau || pm.referencePaiement || 'Règlement',
              date: pm.datePaiement,
              mode: pm.modePaiement || 'Virement',
              montant: amount,
              nomAgent: lp.nomAgent || lp.nomBaseAssurance,
              acteCode: lp.actesPayes?.[0]?.code || 'ACTE',
              acteLibelle: lp.actesPayes?.[0]?.libelle || lp.actesPayes?.[0]?.code || 'Règlement acte'
            });
          }
          if (pNum) {
            prestPaidMap[pNum] = (prestPaidMap[pNum] || 0) + amount;
            if (!prestBordereauxMap[pNum]) prestBordereauxMap[pNum] = [];
            prestBordereauxMap[pNum].push({
              bordereau: pm.numeroBordereau || pm.referencePaiement || 'Règlement',
              date: pm.datePaiement,
              mode: pm.modePaiement || 'Virement',
              montant: amount,
              nomAgent: lp.nomAgent || lp.nomBaseAssurance,
              acteCode: lp.actesPayes?.[0]?.code || 'ACTE',
              acteLibelle: lp.actesPayes?.[0]?.libelle || lp.actesPayes?.[0]?.code || 'Règlement acte'
            });
          }
          if (lId) {
            linePaidMap[lId] = (linePaidMap[lId] || 0) + amount;
          }
        }
      });
    });

    return { prestPaidMap, linePaidMap, prestBordereauxMap };
  }, [paiements]);

  // Compute exact financial metrics for a prestation
  const getPrestationFinancials = (p: Prestation) => {
    const tot = p.montantTotal ?? p.totalPrestation ?? 0;
    const mod = p.ticketModerateur ?? p.participation ?? 0;
    const remb = p.montantARembourser ?? Math.max(0, tot - mod);

    const paidFromPaiements = (paymentsMap.prestPaidMap[p.id] || 0) || (paymentsMap.prestPaidMap[p.numeroFacture] || 0);
    const paidFromLines = (p.lignes || []).reduce((sum, l) => {
      const lPaidFromP = paymentsMap.linePaidMap[l.id] || 0;
      const lPaidStored = l.totalPaye || 0;
      return sum + Math.max(lPaidStored, lPaidFromP);
    }, 0);
    const paidFromPrestation = p.totalPaye || 0;

    const totalPaye = Math.max(paidFromPaiements, paidFromLines, paidFromPrestation);
    const resteAPayer = Math.max(0, remb - totalPaye);

    const isFullyPaid = totalPaye >= remb && remb > 0;
    const isPartiallyPaid = totalPaye > 0 && !isFullyPaid;
    const statut = p.statut === 'Rejeté' ? 'Rejeté' : isFullyPaid ? 'Payé' : isPartiallyPaid ? 'Partiellement payé' : 'En attente';

    return { tot, mod, remb, totalPaye, resteAPayer, statut };
  };

  // Compute exact financial metrics for a prestation line
  const getLineFinancials = (l: LignePrestation, p: Prestation) => {
    const lBrut = l.totalPrestation || 0;
    const lPart = l.ticketModerateur ?? Math.round((p.ticketModerateur || 0) / (p.lignes?.length || 1));
    const lARemb = l.montantARembourser ?? Math.max(0, lBrut - lPart);
    const lPaidFromP = paymentsMap.linePaidMap[l.id] || 0;
    const lTotalPaye = Math.max(l.totalPaye || 0, lPaidFromP);
    const lReste = Math.max(0, lARemb - lTotalPaye);
    const isFullyPaid = lTotalPaye >= lARemb && lARemb > 0;
    const isPartiallyPaid = lTotalPaye > 0 && !isFullyPaid;
    const statut = l.statut || (isFullyPaid ? 'Payé' : isPartiallyPaid ? 'Partiellement payé' : 'En attente');

    return { lBrut, lPart, lARemb, lTotalPaye, lReste, statut };
  };

  // Filtered and Sorted List
  const filteredAndSortedList = useMemo(() => {
    const list = prestations.filter(p => {
      // Societe filter
      const matchesSociete = filterSocieteId === 'ALL' || p.societeId === filterSocieteId;
      // Sous-societe filter
      const matchesSousSoc = filterSousSociete === 'ALL' || (p.sousSociete && p.sousSociete.trim().toLowerCase() === filterSousSociete.toLowerCase());
      // Status filter
      const matchesStatus = statusFilter === 'ALL' || p.statut === statusFilter;
      // Date range filter
      const matchesDateDebut = !dateDebut || p.date >= dateDebut;
      const matchesDateFin = !dateFin || p.date <= dateFin;
      
      // Financials
      const fin = getPrestationFinancials(p);

      // Solde filter
      let matchesSolde = true;
      if (soldeFilter === 'NON_SOLDE') {
        matchesSolde = fin.resteAPayer > 0;
      } else if (soldeFilter === 'SOLDE') {
        matchesSolde = fin.resteAPayer <= 0;
      }

      // Search term filter
      const personne = getPersonne(p.personneId);
      const searchLower = searchTerm.toLowerCase().trim();
      const matchesSearch = 
        !searchLower ||
        p.numeroFacture.toLowerCase().includes(searchLower) ||
        (p.nomAgent && p.nomAgent.toLowerCase().includes(searchLower)) ||
        (personne && personne.nomPrenom.toLowerCase().includes(searchLower)) ||
        (personne && personne.matricule.toLowerCase().includes(searchLower)) ||
        (p.matricule && p.matricule.toLowerCase().includes(searchLower)) ||
        (p.sousSociete && p.sousSociete.toLowerCase().includes(searchLower)) ||
        (p.societeNom && p.societeNom.toLowerCase().includes(searchLower)) ||
        (p.commentaires && p.commentaires.toLowerCase().includes(searchLower)) ||
        p.lignes.some(l => l.libelle.toLowerCase().includes(searchLower) || l.code.toLowerCase().includes(searchLower));

      return matchesSociete && matchesSousSoc && matchesStatus && matchesDateDebut && matchesDateFin && matchesSolde && matchesSearch;
    });

    // Sorting
    list.sort((a, b) => {
      let valA: any = '';
      let valB: any = '';
      const finA = getPrestationFinancials(a);
      const finB = getPrestationFinancials(b);

      switch (sortField) {
        case 'date':
          valA = a.date || '';
          valB = b.date || '';
          break;
        case 'numeroFacture':
          valA = (a.numeroFacture || '').toLowerCase();
          valB = (b.numeroFacture || '').toLowerCase();
          break;
        case 'nom': {
          const persA = getPersonne(a.personneId);
          const persB = getPersonne(b.personneId);
          valA = (a.nomAgent || persA?.nomPrenom || '').toLowerCase();
          valB = (b.nomAgent || persB?.nomPrenom || '').toLowerCase();
          break;
        }
        case 'societe': {
          const socA = a.societeNom || getSocieteNom(a.societeId);
          const socB = b.societeNom || getSocieteNom(b.societeId);
          valA = (socA + ' ' + (a.sousSociete || '')).toLowerCase();
          valB = (socB + ' ' + (b.sousSociete || '')).toLowerCase();
          break;
        }
        case 'totalPrestation':
          valA = finA.tot;
          valB = finB.tot;
          break;
        case 'participation':
          valA = finA.mod;
          valB = finB.mod;
          break;
        case 'montantARembourser':
          valA = finA.remb;
          valB = finB.remb;
          break;
        case 'totalPaye':
          valA = finA.totalPaye;
          valB = finB.totalPaye;
          break;
        case 'resteAPayer':
          valA = finA.resteAPayer;
          valB = finB.resteAPayer;
          break;
        case 'statut':
          valA = finA.statut;
          valB = finB.statut;
          break;
        default:
          valA = a.date || '';
          valB = b.date || '';
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [
    prestations,
    filterSocieteId,
    filterSousSociete,
    statusFilter,
    dateDebut,
    dateFin,
    soldeFilter,
    searchTerm,
    sortField,
    sortDirection,
    personnes,
    societes,
    paymentsMap
  ]);

  // Aggregate statistics for the filtered dataset
  const stats = useMemo(() => {
    let count = filteredAndSortedList.length;
    let totalFacture = 0;
    let totalTicketMod = 0;
    let totalARembourser = 0;
    let totalPaye = 0;
    let totalReste = 0;

    filteredAndSortedList.forEach(p => {
      const fin = getPrestationFinancials(p);

      totalFacture += fin.tot;
      totalTicketMod += fin.mod;
      totalARembourser += fin.remb;
      totalPaye += fin.totalPaye;
      totalReste += fin.resteAPayer;
    });

    return {
      count,
      totalFacture,
      totalTicketMod,
      totalARembourser,
      totalPaye,
      totalReste,
    };
  }, [filteredAndSortedList, paymentsMap]);

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
    const rows = filteredAndSortedList.map(p => {
      const personne = getPersonne(p.personneId);
      const soc = societes.find(s => s.id === p.societeId);
      const fin = getPrestationFinancials(p);

      return {
        'N° Facture': p.numeroFacture,
        'Date Soins': p.date,
        'Société': soc?.nom || p.societeNom || '',
        'Sous-Société / Service': p.sousSociete,
        'Matricule': personne?.matricule || p.matricule || '',
        'Nom & Prénom': personne?.nomPrenom || p.nomAgent || '',
        'Total Facturé': fin.tot,
        'Ticket Modérateur': fin.mod,
        'À Rembourser': fin.remb,
        'Total Payé': fin.totalPaye,
        'Reste à Payer': fin.resteAPayer,
        'Statut': fin.statut,
        'Nombre d\'actes': p.lignes.length,
        'Observations': p.commentaires || '',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Prestations');
    XLSX.writeFile(workbook, `Prestations_Assurance_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Helper for render sort icon
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-indigo-600 font-bold ml-1" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-indigo-600 font-bold ml-1" />
    );
  };

  return (
    <div id="prestations-view" className="space-y-5">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Dossiers de Prestations & Soins</h2>
          <p className="text-xs text-slate-500">
            Enregistrement des factures médicales, actes de soins et calcul des tickets modérateurs
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <button
            id="btn-import-salfa"
            onClick={() => setIsSalfaModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 shadow-xs transition cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600" />
            <span>Importer Facture SALFA</span>
          </button>

          <button
            id="btn-export-prestations-xlsx"
            onClick={handleExportExcel}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Exporter Excel</span>
          </button>

          <button
            id="btn-new-prestation"
            onClick={handleOpenCreate}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvelle Facture Prestation</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Dossiers</div>
          <div className="text-lg font-bold text-slate-900 mt-0.5">{stats.count}</div>
          <div className="text-[10px] text-slate-400">factures listées</div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Total Facturé</div>
          <div className="text-sm font-bold text-slate-900 mt-0.5 truncate">{formatMoney(stats.totalFacture)}</div>
          <div className="text-[10px] text-slate-400">montant brut</div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-amber-200/70 bg-amber-50/20 shadow-xs">
          <div className="text-[11px] font-medium text-amber-700 uppercase tracking-wider">Ticket Modérateur</div>
          <div className="text-sm font-bold text-amber-800 mt-0.5 truncate">{formatMoney(stats.totalTicketMod)}</div>
          <div className="text-[10px] text-amber-600">part affilié</div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-indigo-200/70 bg-indigo-50/20 shadow-xs">
          <div className="text-[11px] font-medium text-indigo-700 uppercase tracking-wider">À Rembourser</div>
          <div className="text-sm font-bold text-indigo-800 mt-0.5 truncate">{formatMoney(stats.totalARembourser)}</div>
          <div className="text-[10px] text-indigo-600">charge assureur</div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-emerald-200/70 bg-emerald-50/20 shadow-xs">
          <div className="text-[11px] font-medium text-emerald-700 uppercase tracking-wider">Total Réglé</div>
          <div className="text-sm font-bold text-emerald-700 mt-0.5 truncate">{formatMoney(stats.totalPaye)}</div>
          <div className="text-[10px] text-emerald-600">déjà payé</div>
        </div>

        <div className={`bg-white p-3 rounded-xl border shadow-xs ${stats.totalReste > 0 ? 'border-rose-200 bg-rose-50/20' : 'border-slate-200'}`}>
          <div className={`text-[11px] font-medium uppercase tracking-wider ${stats.totalReste > 0 ? 'text-rose-700' : 'text-slate-500'}`}>
            Reste à Payer
          </div>
          <div className={`text-sm font-bold mt-0.5 truncate ${stats.totalReste > 0 ? 'text-rose-700' : 'text-slate-700'}`}>
            {formatMoney(stats.totalReste)}
          </div>
          <div className={`text-[10px] ${stats.totalReste > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
            {stats.totalReste > 0 ? 'à recouvrer' : 'entièrement soldé'}
          </div>
        </div>
      </div>

      {/* Main Multi-criteria Filter Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Recherche par n° facture, assuré, matricule, sous-société, acte..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Status Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-400 font-medium mr-1 hidden sm:inline">Statut :</span>
            {[
              { key: 'ALL', label: 'Tous' },
              { key: 'En attente', label: 'En attente' },
              { key: 'Partiellement payé', label: 'Partiel' },
              { key: 'Payé', label: 'Payé' },
              { key: 'Rejeté', label: 'Rejeté' }
            ].map(st => (
              <button
                key={st.key}
                onClick={() => setStatusFilter(st.key)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                  statusFilter === st.key
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Filter Controls Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAdvancedFilters(prev => !prev)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                showAdvancedFilters || activeFiltersCount > 0
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
              <span>Filtres avancés</span>
              {activeFiltersCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-indigo-600 text-white font-bold">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {activeFiltersCount > 0 && (
              <button
                onClick={handleResetFilters}
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition cursor-pointer"
                title="Réinitialiser tous les filtres"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Effacer</span>
              </button>
            )}
          </div>
        </div>

        {/* Expandable Multi-criteria Filter Panel */}
        {showAdvancedFilters && (
          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50/60 p-3 rounded-lg">
            {/* Société Assureur */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Société / Garant
              </label>
              <select
                value={filterSocieteId}
                onChange={(e) => setFilterSocieteId(e.target.value)}
                className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">Toutes les sociétés</option>
                {societes.map(s => (
                  <option key={s.id} value={s.id}>{s.nom}</option>
                ))}
              </select>
            </div>

            {/* Sous-société */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Sous-Société / Service
              </label>
              <select
                value={filterSousSociete}
                onChange={(e) => setFilterSousSociete(e.target.value)}
                className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">Toutes les sous-sociétés</option>
                {uniqueSousSocietes.map(ss => (
                  <option key={ss} value={ss}>{ss}</option>
                ))}
              </select>
            </div>

            {/* Solde Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                État du solde
              </label>
              <select
                value={soldeFilter}
                onChange={(e) => setSoldeFilter(e.target.value as any)}
                className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">Tous les états</option>
                <option value="NON_SOLDE">Non soldés uniquement (Reste &gt; 0)</option>
                <option value="SOLDE">Entièrement soldés (Reste = 0)</option>
              </select>
            </div>

            {/* Date Range & Presets */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Période de soins
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={dateDebut}
                  onChange={(e) => setDateDebut(e.target.value)}
                  className="w-1/2 text-xs py-1 px-1.5 rounded-md border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  title="Date début"
                />
                <span className="text-slate-400 text-xs">-</span>
                <input
                  type="date"
                  value={dateFin}
                  onChange={(e) => setDateFin(e.target.value)}
                  className="w-1/2 text-xs py-1 px-1.5 rounded-md border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  title="Date fin"
                />
              </div>
              {/* Quick presets */}
              <div className="flex items-center gap-1 mt-1.5">
                <button
                  type="button"
                  onClick={() => setDatePreset('this_month')}
                  className="text-[10px] text-indigo-600 hover:text-indigo-800 hover:underline"
                >
                  Ce mois
                </button>
                <span className="text-slate-300 text-[10px]">|</span>
                <button
                  type="button"
                  onClick={() => setDatePreset('last_month')}
                  className="text-[10px] text-indigo-600 hover:text-indigo-800 hover:underline"
                >
                  Mois dernier
                </button>
                <span className="text-slate-300 text-[10px]">|</span>
                <button
                  type="button"
                  onClick={() => setDatePreset('this_year')}
                  className="text-[10px] text-indigo-600 hover:text-indigo-800 hover:underline"
                >
                  Année
                </button>
                <span className="text-slate-300 text-[10px]">|</span>
                <button
                  type="button"
                  onClick={() => setDatePreset('all')}
                  className="text-[10px] text-slate-500 hover:text-slate-700 hover:underline"
                >
                  Tout
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Prestations Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 uppercase text-[11px] font-semibold border-b border-slate-200 select-none">
              <tr>
                <th className="py-3 px-2 w-8"></th>
                
                {/* Date Soins */}
                <th 
                  onClick={() => handleSort('date')}
                  className={`py-3 px-3 cursor-pointer group hover:bg-slate-100/80 transition ${sortField === 'date' ? 'bg-indigo-50/60 text-indigo-900 font-bold' : ''}`}
                >
                  <div className="flex items-center">
                    <span>Date Soins</span>
                    {renderSortIcon('date')}
                  </div>
                </th>

                {/* N° Facture */}
                <th 
                  onClick={() => handleSort('numeroFacture')}
                  className={`py-3 px-3 cursor-pointer group hover:bg-slate-100/80 transition ${sortField === 'numeroFacture' ? 'bg-indigo-50/60 text-indigo-900 font-bold' : ''}`}
                >
                  <div className="flex items-center">
                    <span>N° Facture</span>
                    {renderSortIcon('numeroFacture')}
                  </div>
                </th>

                {/* Nom de l'Agent / Assuré */}
                <th 
                  onClick={() => handleSort('nom')}
                  className={`py-3 px-3 cursor-pointer group hover:bg-slate-100/80 transition ${sortField === 'nom' ? 'bg-indigo-50/60 text-indigo-900 font-bold' : ''}`}
                >
                  <div className="flex items-center">
                    <span>Nom de l'Agent / Assuré</span>
                    {renderSortIcon('nom')}
                  </div>
                </th>

                {/* Société / Sous-société */}
                <th 
                  onClick={() => handleSort('societe')}
                  className={`py-3 px-3 cursor-pointer group hover:bg-slate-100/80 transition ${sortField === 'societe' ? 'bg-indigo-50/60 text-indigo-900 font-bold' : ''}`}
                >
                  <div className="flex items-center">
                    <span>Société / Sous-société</span>
                    {renderSortIcon('societe')}
                  </div>
                </th>

                {/* Montant Total */}
                <th 
                  onClick={() => handleSort('totalPrestation')}
                  className={`py-3 px-3 text-right cursor-pointer group hover:bg-slate-100/80 transition ${sortField === 'totalPrestation' ? 'bg-indigo-50/60 text-indigo-900 font-bold' : ''}`}
                >
                  <div className="flex items-center justify-end">
                    <span>Montant Total</span>
                    {renderSortIcon('totalPrestation')}
                  </div>
                </th>

                {/* Ticket Modérateur */}
                <th 
                  onClick={() => handleSort('participation')}
                  className={`py-3 px-3 text-right cursor-pointer group hover:bg-slate-100/80 transition ${sortField === 'participation' ? 'bg-indigo-50/60 text-indigo-900 font-bold' : ''}`}
                >
                  <div className="flex items-center justify-end">
                    <span>Ticket Mod.</span>
                    {renderSortIcon('participation')}
                  </div>
                </th>

                {/* À Rembourser */}
                <th 
                  onClick={() => handleSort('montantARembourser')}
                  className={`py-3 px-3 text-right cursor-pointer group hover:bg-slate-100/80 transition ${sortField === 'montantARembourser' ? 'bg-indigo-50/60 text-indigo-900 font-bold' : ''}`}
                >
                  <div className="flex items-center justify-end">
                    <span>À Rembourser</span>
                    {renderSortIcon('montantARembourser')}
                  </div>
                </th>

                {/* Total Payé */}
                <th 
                  onClick={() => handleSort('totalPaye')}
                  className={`py-3 px-3 text-right cursor-pointer group hover:bg-slate-100/80 transition ${sortField === 'totalPaye' ? 'bg-indigo-50/60 text-indigo-900 font-bold' : ''}`}
                >
                  <div className="flex items-center justify-end">
                    <span>Total Payé</span>
                    {renderSortIcon('totalPaye')}
                  </div>
                </th>

                {/* Reste à Payer */}
                <th 
                  onClick={() => handleSort('resteAPayer')}
                  className={`py-3 px-3 text-right cursor-pointer group hover:bg-slate-100/80 transition ${sortField === 'resteAPayer' ? 'bg-indigo-50/60 text-indigo-900 font-bold' : ''}`}
                >
                  <div className="flex items-center justify-end">
                    <span>Reste à Payer</span>
                    {renderSortIcon('resteAPayer')}
                  </div>
                </th>

                {/* Statut */}
                <th 
                  onClick={() => handleSort('statut')}
                  className={`py-3 px-3 text-center cursor-pointer group hover:bg-slate-100/80 transition ${sortField === 'statut' ? 'bg-indigo-50/60 text-indigo-900 font-bold' : ''}`}
                >
                  <div className="flex items-center justify-center">
                    <span>Statut</span>
                    {renderSortIcon('statut')}
                  </div>
                </th>

                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAndSortedList.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-10 text-center text-slate-400 space-y-2">
                    <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
                    <div>Aucun dossier de prestation ne correspond aux filtres sélectionnés.</div>
                    {activeFiltersCount > 0 && (
                      <button
                        onClick={handleResetFilters}
                        className="text-xs text-indigo-600 hover:underline font-medium"
                      >
                        Réinitialiser tous les filtres
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredAndSortedList.map(prestation => {
                  const isExpanded = !!expandedRows[prestation.id];
                  const personne = getPersonne(prestation.personneId);
                  const agentName = prestation.nomAgent || personne?.nomPrenom || 'Inconnu';
                  const matriculeStr = prestation.matricule || personne?.matricule || '-';
                  const socName = prestation.societeNom || getSocieteNom(prestation.societeId);
                  
                  const fin = getPrestationFinancials(prestation);
                  const attachedBordereaux = paymentsMap.prestBordereauxMap[prestation.id] || paymentsMap.prestBordereauxMap[prestation.numeroFacture] || [];

                  return (
                    <React.Fragment key={prestation.id}>
                      <tr className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-2 text-center">
                          <button
                            onClick={() => toggleRow(prestation.id)}
                            className="p-1 text-slate-400 hover:text-indigo-600 transition cursor-pointer"
                            title="Afficher/masquer les actes médicaux et règlements"
                          >
                            {isExpanded ? <ChevronDown className="w-4 h-4 text-indigo-600 font-bold" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        </td>
                        <td className="py-3 px-3 text-slate-600 font-medium whitespace-nowrap">
                          {formatDate(prestation.date)}
                        </td>
                        <td className="py-3 px-3 font-bold text-indigo-700 whitespace-nowrap">
                          {prestation.numeroFacture}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-900">{agentName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">Mat: {matriculeStr} {personne?.qualite ? `• ${personne.qualite}` : ''}</div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="text-slate-800 font-medium">{socName}</div>
                          <div className="text-[10px] text-indigo-600 font-medium">{prestation.sousSociete}</div>
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                          {formatMoney(fin.tot)}
                        </td>
                        <td className="py-3 px-3 text-right text-amber-700 font-medium whitespace-nowrap">
                          {formatMoney(fin.mod)}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                          {formatMoney(fin.remb)}
                        </td>
                        <td className="py-3 px-3 text-right text-emerald-700 font-bold whitespace-nowrap">
                          {formatMoney(fin.totalPaye)}
                        </td>
                        <td className="py-3 px-3 text-right font-bold whitespace-nowrap">
                          <span className={fin.resteAPayer > 0 ? 'text-rose-700 font-bold' : 'text-slate-400'}>
                            {formatMoney(fin.resteAPayer)}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            fin.statut === 'Payé'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : fin.statut === 'Partiellement payé'
                              ? 'bg-sky-100 text-sky-800 border border-sky-200'
                              : fin.statut === 'Rejeté'
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}>
                            {fin.statut}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end space-x-1">
                            <button
                              onClick={() => setViewingPrestation(prestation)}
                              title="Visualiser détails"
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleOpenEdit(prestation)}
                              title="Modifier la prestation"
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg cursor-pointer"
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
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Nested Expandable Sub-Table of Medical Acts (Base 2) & Attached Payments */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90 border-y border-slate-200/80">
                          <td colSpan={12} className="p-4 pl-12 space-y-3">
                            <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-xs space-y-2">
                              <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                                <span className="flex items-center gap-1.5 text-indigo-700">
                                  <span>Lignes de Prestation (Actes Médicaux & Montants)</span>
                                </span>
                                <span className="text-slate-400 lowercase font-normal">{prestation.lignes.length} actes dans cette prescription</span>
                              </div>
                              <table className="w-full text-xs">
                                <thead className="text-[10px] text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                                  <tr>
                                    <th className="py-2 px-2 text-left">Code Acte</th>
                                    <th className="py-2 px-2 text-left">Libellé / Acte médical</th>
                                    <th className="py-2 px-2 text-right">Montant Brut</th>
                                    <th className="py-2 px-2 text-right">Ticket Modérateur</th>
                                    <th className="py-2 px-2 text-right">À Rembourser</th>
                                    <th className="py-2 px-2 text-right">Somme Payée</th>
                                    <th className="py-2 px-2 text-right">Reste à Payer</th>
                                    <th className="py-2 px-2 text-center">Statut</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {prestation.lignes.map(ligne => {
                                    const lFin = getLineFinancials(ligne, prestation);

                                    return (
                                      <tr key={ligne.id} className="hover:bg-slate-50">
                                        <td className="py-2 px-2 font-mono font-bold text-indigo-700">
                                          {ligne.code}
                                        </td>
                                        <td className="py-2 px-2 text-slate-700">
                                          {ligne.libelle || 'Acte de soins'}
                                        </td>
                                        <td className="py-2 px-2 text-right font-medium text-slate-900">
                                          {formatMoney(lFin.lBrut)}
                                        </td>
                                        <td className="py-2 px-2 text-right text-amber-700 font-medium">
                                          {formatMoney(lFin.lPart)}
                                        </td>
                                        <td className="py-2 px-2 text-right font-bold text-slate-900">
                                          {formatMoney(lFin.lARemb)}
                                        </td>
                                        <td className="py-2 px-2 text-right font-bold text-emerald-600">
                                          {formatMoney(lFin.lTotalPaye)}
                                        </td>
                                        <td className="py-2 px-2 text-right font-mono font-semibold">
                                          <span className={lFin.lReste > 0 ? 'text-rose-700' : 'text-slate-400'}>
                                            {formatMoney(lFin.lReste)}
                                          </span>
                                        </td>
                                        <td className="py-2 px-2 text-center">
                                          <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-semibold ${
                                            lFin.statut === 'Payé'
                                              ? 'bg-emerald-100 text-emerald-800'
                                              : lFin.statut === 'Partiellement payé'
                                              ? 'bg-sky-100 text-sky-800'
                                              : 'bg-amber-100 text-amber-800'
                                          }`}>
                                            {lFin.statut}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>

                            {/* Section: Règlements rattachés sur cette facture */}
                            {attachedBordereaux.length > 0 && (
                              <div className="bg-emerald-50/70 rounded-lg border border-emerald-200 p-3 shadow-xs space-y-2">
                                <div className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider flex items-center justify-between">
                                  <span className="flex items-center gap-1.5">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Règlements & Décomptes rattachés ({attachedBordereaux.length})</span>
                                  </span>
                                  <span className="font-mono text-emerald-800 font-bold">
                                    Total réglé : {formatMoney(fin.totalPaye)}
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                  {attachedBordereaux.map((b, bIdx) => (
                                    <div key={bIdx} className="bg-white rounded-md border border-emerald-200 p-2 text-xs flex items-center justify-between">
                                      <div>
                                        <div className="font-bold text-slate-800 font-mono text-[11px]">
                                          {b.bordereau}
                                        </div>
                                        <div className="text-[10px] text-slate-500">
                                          {formatDate(b.date)} • {b.acteCode}
                                        </div>
                                      </div>
                                      <div className="text-right font-mono font-bold text-emerald-700">
                                        {formatMoney(b.montant)}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
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
