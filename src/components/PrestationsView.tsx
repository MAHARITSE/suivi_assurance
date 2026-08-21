import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Eye, 
  Edit3, 
  Trash2, 
  FileText, 
  Receipt,
  CheckCircle, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  AlertTriangle,
  Tag,
  Sparkles,
  Link2,
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
  DollarSign,
  Edit2,
  Ban
} from 'lucide-react';
import { Prestation, LignePrestation, Paiement, Societe, Personne, Famille } from '../types';
import { formatMoney, formatDate, generateId } from '../utils/formatters';
import { calculateRecouvrementData, generateRecouvrementPdf, generateSelectedPrestationsPdf } from '../utils/recouvrementPdf';
import { SalfaImportModal } from './SalfaImportModal';
import { FacturesGroupedTable } from './prestations/FacturesGroupedTable';
import { FactureDetailModal } from './prestations/FactureDetailModal';
import * as XLSX from 'xlsx';

export type PrestationViewMode = 'detaillee' | 'factures';

export type FactureSortField = 
  | 'numeroFacture' 
  | 'date' 
  | 'societe' 
  | 'nombreAssures' 
  | 'nombreActes' 
  | 'totalFacture' 
  | 'totalTicketMod' 
  | 'totalARembourser' 
  | 'totalPaye' 
  | 'resteAReclamer' 
  | 'tauxRecouvrement' 
  | 'statut';

export interface GroupedFacture {
  numeroFacture: string;
  societeId: string;
  societeNom: string;
  sousSocietes: string[];
  dates: string[];
  dateMin: string;
  dateMax: string;
  prestations: Prestation[];
  nombreAssures: number;
  nombreActes: number;
  totalFacture: number;
  totalTicketMod: number;
  totalARembourser: number;
  totalPaye: number;
  totalExclu: number;
  resteAReclamer: number;
  tauxRecouvrement: number;
  statut: 'En attente' | 'Partiellement payé' | 'Payé' | 'Rejeté';
  hasMatch: boolean;
  hasDuplicate: boolean;
  bordereaux: Array<{
    bordereau: string;
    date: string;
    mode: string;
    montant: number;
    nomAgent?: string;
  }>;
}

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
  onSavePaiement?: (paiement: Paiement, updatedPrestations: Prestation[]) => void;
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
  onSavePaiement,
  isCreateModalOpen,
  setIsCreateModalOpen,
}) => {
  // View mode state
  const [viewMode, setViewMode] = useState<PrestationViewMode>('detaillee');

  // Multi-criteria filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [filterSocieteId, setFilterSocieteId] = useState<string>(selectedSocieteId);
  const [filterSousSociete, setFilterSousSociete] = useState<string>('ALL');
  const [dateDebut, setDateDebut] = useState<string>('');
  const [dateFin, setDateFin] = useState<string>('');
  const [soldeFilter, setSoldeFilter] = useState<'ALL' | 'NON_SOLDE' | 'SOLDE'>('ALL');
  const [reconciliationFilter, setReconciliationFilter] = useState<'ALL' | 'MATCH_DATE_MONTANT' | 'DUPLICATES'>('ALL');
  const [filterRetard3Mois, setFilterRetard3Mois] = useState<boolean>(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);

  // Sorting state for detailed view
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Sorting state for grouped invoice view
  const [factureSortField, setFactureSortField] = useState<FactureSortField>('date');
  const [factureSortDirection, setFactureSortDirection] = useState<SortDirection>('desc');

  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [expandedFactureRows, setExpandedFactureRows] = useState<Record<string, boolean>>({});
  const [viewingPrestation, setViewingPrestation] = useState<Prestation | null>(null);
  const [viewingFacture, setViewingFacture] = useState<GroupedFacture | null>(null);
  const [editingPrestation, setEditingPrestation] = useState<Prestation | null>(null);
  const [isSalfaModalOpen, setIsSalfaModalOpen] = useState<boolean>(false);
  const [lineEditContext, setLineEditContext] = useState<{ prestation: Prestation, ligne: LignePrestation } | null>(null);
  const [lineExcludeContext, setLineExcludeContext] = useState<{ prestation: Prestation, ligne: LignePrestation, maxExclu: number } | null>(null);
  const [lineExcludeForm, setLineExcludeForm] = useState({ montant: 0, motif: '' });
  const [lineEditForm, setLineEditForm] = useState<{ code: string, libelle: string, totalPrestation: number, ticketModerateur: number }>({ code: '', libelle: '', totalPrestation: 0, ticketModerateur: 0 });
  const [selectedPrestations, setSelectedPrestations] = useState<Set<string>>(new Set());

  React.useEffect(() => {
    if (lineEditContext) {
      setLineEditForm({
        code: lineEditContext.ligne.code || '',
        libelle: lineEditContext.ligne.libelle || '',
        totalPrestation: lineEditContext.ligne.totalPrestation || 0,
        ticketModerateur: lineEditContext.ligne.ticketModerateur || 0
      });
    }
  }, [lineEditContext]);

  React.useEffect(() => {
    if (lineExcludeContext) {
      setLineExcludeForm({
        montant: lineExcludeContext.maxExclu,
        motif: 'Rejet direct'
      });
    }
  }, [lineExcludeContext]);

  // Sync prop selectedSocieteId
  React.useEffect(() => {
    if (selectedSocieteId !== 'ALL') {
      setFilterSocieteId(selectedSocieteId);
    }
  }, [selectedSocieteId]);

  const handleExportRecouvrementPdfSelected = () => {
    if (selectedPrestations.size === 0) return;
    const prestationsList = filteredAndSortedList.filter(p => selectedPrestations.has(p.id));
    generateSelectedPrestationsPdf(prestationsList, paiements, societes, personnes, {
      titreEtablissement: 'SALFA - Établissement Médical & Soins',
      familles,
    });
  };

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
    if (reconciliationFilter !== 'ALL') count++;
    if (filterRetard3Mois) count++;
    return count;
  }, [searchTerm, statusFilter, filterSocieteId, filterSousSociete, dateDebut, dateFin, soldeFilter, reconciliationFilter, filterRetard3Mois]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setFilterSocieteId(selectedSocieteId !== 'ALL' ? selectedSocieteId : 'ALL');
    setFilterSousSociete('ALL');
    setDateDebut('');
    setDateFin('');
    setSoldeFilter('ALL');
    setReconciliationFilter('ALL');
    setFilterRetard3Mois(false);
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
    const prestExcluMap: Record<string, number> = {};
    const lineExcluMap: Record<string, number> = {};
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
        const lId = lp.lignePrestationId;
        const amount = Number(lp.totalPaye ?? lp.montantPaye ?? 0);
        const exclu = Number(lp.montantExclu || 0);

        if (amount > 0 || exclu > 0) {
          if (pId) {
            if (amount > 0) {
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
            if (exclu > 0) {
              prestExcluMap[pId] = (prestExcluMap[pId] || 0) + exclu;
            }
          }
          if (lId) {
            if (amount > 0) linePaidMap[lId] = (linePaidMap[lId] || 0) + amount;
            if (exclu > 0) lineExcluMap[lId] = (lineExcluMap[lId] || 0) + exclu;
          }
        }
      });
    });

    return { prestPaidMap, linePaidMap, prestExcluMap, lineExcluMap, prestBordereauxMap };
  }, [paiements]);

  // Fast lookup map for settlement lines across all paiements for manual reconciliation
  const settlementLinesLookup = useMemo(() => {
    const list: Array<{
      paiementId: string;
      prestationId?: string;
      lignePrestationId?: string;
      numeroBordereau: string;
      datePaiement: string;
      dateSoins?: string;
      nomAgent?: string;
      matricule?: string;
      montantBrut: number;
      montantPaye: number;
      prestationNumero?: string;
    }> = [];

    (paiements || []).forEach(p => {
      (p.lignes || []).forEach(lp => {
        const brut = Number(lp.montantReclame || lp.totalPaye + (lp.ticketModerateur || 0));
        const net = Number(lp.totalPaye || lp.montantPaye || 0);
        list.push({
          paiementId: p.id,
          prestationId: lp.prestationId,
          lignePrestationId: lp.lignePrestationId,
          numeroBordereau: p.numeroBordereau,
          datePaiement: p.datePaiement,
          dateSoins: lp.dateSoins,
          nomAgent: lp.nomAgent || lp.nomBaseAssurance,
          matricule: lp.immatriculation,
          montantBrut: brut,
          montantPaye: net,
          prestationNumero: lp.prestationNumero,
        });
      });
    });

    return list;
  }, [paiements]);

  // Compute exact financial metrics for a prestation
  const getPrestationFinancials = (p: Prestation) => {
    const tot = p.montantTotal ?? p.totalPrestation ?? 0;
    const mod = p.ticketModerateur ?? p.participation ?? 0;
    const remb = p.montantARembourser ?? Math.max(0, tot - mod);

    const paidFromPaiements = paymentsMap.prestPaidMap[p.id] || 0;
    const excluFromPaiements = paymentsMap.prestExcluMap[p.id] || 0;
    const paidFromLines = (p.lignes || []).reduce((sum, l) => {
      const lPaidFromP = paymentsMap.linePaidMap[l.id] || 0;
      const lPaidStored = l.totalPaye || 0;
      return sum + Math.max(lPaidStored, lPaidFromP);
    }, 0);
    const excluFromLines = (p.lignes || []).reduce((sum, l) => {
      const lExcluFromP = paymentsMap.lineExcluMap[l.id] || 0;
      return sum + lExcluFromP;
    }, 0);
    const paidFromPrestation = p.totalPaye || 0;

    const totalPaye = Math.max(paidFromPaiements, paidFromLines, paidFromPrestation);
    const totalExclu = Math.max(excluFromPaiements, excluFromLines);
    const resteAPayer = Math.max(0, remb - totalPaye - totalExclu);

    const isFullyPaid = (totalPaye >= remb && remb > 0) || (resteAPayer <= 0 && (totalPaye > 0 || remb === 0));
    const isPartiallyPaid = totalPaye > 0 && !isFullyPaid && resteAPayer > 0;
    const isAllExcluded = totalExclu >= remb && remb > 0 && totalPaye === 0;
    const statut = p.statut === 'Rejeté' || isAllExcluded 
      ? 'Rejeté' 
      : isFullyPaid || resteAPayer <= 0 
      ? 'Payé' 
      : isPartiallyPaid 
      ? 'Partiellement payé' 
      : 'En attente';

    return { tot, mod, remb, totalPaye, totalExclu, resteAPayer, statut };
  };

  // Prestation match & duplicate reconciliation analysis
  const getPrestationReconciliationInfo = (p: Prestation) => {
    const fin = getPrestationFinancials(p);
    const pDate = p.date ? p.date.split('T')[0] : '';
    const pTot = fin.tot;
    const pRemb = fin.remb;

    // Matching settlement lines with same date (dateSoins or datePaiement) AND same amount (gross or net) for same patient
    const matchingSettlements = settlementLinesLookup.filter(sl => {
      const isDirectId = sl.prestationId && sl.prestationId === p.id;
      if (isDirectId) return true;

      const slDateSoins = sl.dateSoins ? sl.dateSoins.split('T')[0] : '';
      const slDatePaiement = sl.datePaiement ? sl.datePaiement.split('T')[0] : '';
      const matchDate = (slDateSoins && slDateSoins === pDate) || (slDatePaiement && slDatePaiement === pDate);
      const matchAmount = Math.abs(sl.montantBrut - pTot) < 1 || Math.abs(sl.montantPaye - pRemb) < 1 || Math.abs(sl.montantPaye - pTot) < 1;
      
      const cleanNomP = (p.nomAgent || '').toLowerCase().trim();
      const cleanNomSl = (sl.nomAgent || '').toLowerCase().trim();
      const matchPatient = !cleanNomSl || !cleanNomP || cleanNomSl.includes(cleanNomP) || cleanNomP.includes(cleanNomSl);

      return matchDate && matchAmount && matchPatient;
    });

    // Potential duplicates / homonym prestations with identical date and same total amount
    const duplicatePrestations = prestations.filter(other => {
      if (other.id === p.id) return false;
      const otherDate = other.date ? other.date.split('T')[0] : '';
      const otherTot = other.montantTotal ?? other.totalPrestation ?? 0;
      return otherDate === pDate && Math.abs(otherTot - pTot) < 1;
    });

    const hasMatch = matchingSettlements.length > 0;
    const hasDuplicate = duplicatePrestations.length > 0;

    return {
      hasMatch,
      matchingSettlements,
      hasDuplicate,
      duplicatePrestations,
      isReconciled: hasMatch || hasDuplicate,
    };
  };

  // Compute exact financial metrics for a prestation line
  const getLineFinancials = (l: LignePrestation, p: Prestation) => {
    const lBrut = l.totalPrestation || 0;
    const lPart = l.ticketModerateur ?? Math.round((p.ticketModerateur || 0) / (p.lignes?.length || 1));
    const lARemb = l.montantARembourser ?? Math.max(0, lBrut - lPart);
    const lPaidFromP = paymentsMap.linePaidMap[l.id] || 0;
    const lExcluFromP = paymentsMap.lineExcluMap[l.id] || 0;
    const lTotalPaye = Math.max(l.totalPaye || 0, lPaidFromP);
    // Deduct exclusions from Reste à Payer since they are rejected
    const lReste = Math.max(0, lARemb - lTotalPaye - lExcluFromP);
    const isFullyPaid = (lTotalPaye >= lARemb && lARemb > 0) || (lReste <= 0 && (lTotalPaye > 0 || lARemb === 0));
    const isPartiallyPaid = lTotalPaye > 0 && !isFullyPaid && lReste > 0;
    const isLineExcluded = (lExcluFromP >= lARemb && lARemb > 0 && lTotalPaye === 0) || l.statut === 'Rejeté';
    const statut = isLineExcluded
      ? 'Rejeté'
      : isFullyPaid || lReste <= 0
      ? 'Payé'
      : isPartiallyPaid
      ? 'Partiellement payé'
      : (l.statut || 'En attente');

    // Check if line matches a settlement line on date and amount
    const pDate = p.date ? p.date.split('T')[0] : '';
    const matchingSettlementLine = settlementLinesLookup.find(sl => {
      const slDateSoins = sl.dateSoins ? sl.dateSoins.split('T')[0] : '';
      const slDatePaiement = sl.datePaiement ? sl.datePaiement.split('T')[0] : '';
      const matchDate = (slDateSoins && slDateSoins === pDate) || (slDatePaiement && slDatePaiement === pDate);
      const matchAmount = Math.abs(sl.montantBrut - lBrut) < 1 || Math.abs(sl.montantPaye - lARemb) < 1 || Math.abs(sl.montantPaye - lBrut) < 1;
      return matchDate && matchAmount;
    });

    return { lBrut, lPart, lARemb, lTotalPaye, lReste, statut, matchingSettlementLine };
  };

  // Status counters for quick badges
  const statusCounts = useMemo(() => {
    let paye = 0, enCours = 0;
    prestations.forEach(p => {
      const fin = getPrestationFinancials(p);
      const isPaid = fin.statut === 'Payé' || p.statut === 'Payé' || fin.resteAPayer <= 0 || (p.resteAPayer !== undefined && p.resteAPayer <= 0);
      if (isPaid) {
        paye++;
      } else {
        enCours++;
      }
    });
    return { all: prestations.length, enCours, paye };
  }, [prestations, paymentsMap]);

  // Filtered and Sorted List
  const filteredAndSortedList = useMemo(() => {
    const list = prestations.filter(p => {
      // Financials
      const fin = getPrestationFinancials(p);

      // Societe filter
      const matchesSociete = filterSocieteId === 'ALL' || p.societeId === filterSocieteId;
      // Sous-societe filter
      const matchesSousSoc = filterSousSociete === 'ALL' || (p.sousSociete && p.sousSociete.trim().toLowerCase() === filterSousSociete.toLowerCase());
      
      // Status filter - Tous, En cours, Totalement payé
      let matchesStatus = true;
      if (statusFilter !== 'ALL') {
        const isPaid = fin.statut === 'Payé' || p.statut === 'Payé' || fin.resteAPayer <= 0 || (p.resteAPayer !== undefined && p.resteAPayer <= 0);
        if (statusFilter === 'Payé' || statusFilter === 'Totalement payé') {
          matchesStatus = isPaid;
        } else if (statusFilter === 'EN_COURS' || statusFilter === 'Encour' || statusFilter === 'En cours') {
          matchesStatus = !isPaid;
        } else {
          matchesStatus = p.statut === statusFilter || fin.statut === statusFilter;
        }
      }

      // Date range filter
      const matchesDateDebut = !dateDebut || p.date >= dateDebut;
      const matchesDateFin = !dateFin || p.date <= dateFin;

      // Solde filter
      let matchesSolde = true;
      if (soldeFilter === 'NON_SOLDE') {
        matchesSolde = fin.resteAPayer > 0;
      } else if (soldeFilter === 'SOLDE') {
        matchesSolde = fin.resteAPayer <= 0;
      }

      // Reconciliation filter
      let matchesReconciliation = true;
      if (reconciliationFilter === 'MATCH_DATE_MONTANT') {
        const rec = getPrestationReconciliationInfo(p);
        matchesReconciliation = rec.hasMatch;
      } else if (reconciliationFilter === 'DUPLICATES') {
        const rec = getPrestationReconciliationInfo(p);
        matchesReconciliation = rec.hasDuplicate;
      }

      // Retard > 3 mois (90 jours) filter
      let matchesRetard3Mois = true;
      if (filterRetard3Mois) {
        const dStr = p.date ? p.date.split('T')[0] : '';
        if (!dStr) {
          matchesRetard3Mois = false;
        } else {
          const pDate = new Date(dStr);
          const diffDays = Math.floor((new Date().getTime() - pDate.getTime()) / (1000 * 60 * 60 * 24));
          matchesRetard3Mois = fin.resteAPayer > 0 && diffDays >= 90;
        }
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

      return matchesSociete && matchesSousSoc && matchesStatus && matchesDateDebut && matchesDateFin && matchesSolde && matchesReconciliation && matchesRetard3Mois && matchesSearch;
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
    filterRetard3Mois,
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

  // Statistics for selected items (when checkboxes are checked)
  const selectedStats = useMemo(() => {
    const isCustom = selectedPrestations.size > 0;
    const items = isCustom 
      ? filteredAndSortedList.filter(p => selectedPrestations.has(p.id))
      : [];

    let count = items.length;
    let totalFacture = 0;
    let totalTicketMod = 0;
    let totalARembourser = 0;
    let totalPaye = 0;
    let totalReste = 0;

    items.forEach(p => {
      const fin = getPrestationFinancials(p);
      totalFacture += fin.tot;
      totalTicketMod += fin.mod;
      totalARembourser += fin.remb;
      totalPaye += fin.totalPaye;
      totalReste += fin.resteAPayer;
    });

    return {
      isCustom,
      count,
      totalFacture,
      totalTicketMod,
      totalARembourser,
      totalPaye,
      totalReste,
    };
  }, [filteredAndSortedList, selectedPrestations, paymentsMap]);

  // Grouped factures aggregation across all filtered prestations
  const groupedFactures = useMemo(() => {
    const map = new Map<string, {
      numeroFacture: string;
      societeId: string;
      societeNom: string;
      sousSocietes: Set<string>;
      dates: Set<string>;
      dateMin: string;
      dateMax: string;
      prestations: Prestation[];
      assuresSet: Set<string>;
      nombreActes: number;
      totalFacture: number;
      totalTicketMod: number;
      totalARembourser: number;
      totalPaye: number;
      totalExclu: number;
      resteAReclamer: number;
      hasMatch: boolean;
      hasDuplicate: boolean;
      bordereaux: Array<{
        bordereau: string;
        date: string;
        mode: string;
        montant: number;
        nomAgent?: string;
      }>;
    }>();

    filteredAndSortedList.forEach(p => {
      const num = (p.numeroFacture || 'SANS_NUMERO').trim();
      const fin = getPrestationFinancials(p);
      const recInfo = getPrestationReconciliationInfo(p);
      const personne = getPersonne(p.personneId);
      const agentName = (p.nomAgent || personne?.nomPrenom || p.matricule || p.personneId || 'Assuré').trim();
      const socNom = p.societeNom || getSocieteNom(p.societeId);
      const pDate = p.date ? p.date.split('T')[0] : '';
      const attBordereaux = paymentsMap.prestBordereauxMap[p.id] || paymentsMap.prestBordereauxMap[p.numeroFacture] || [];

      if (!map.has(num)) {
        const sousSet = new Set<string>();
        if (p.sousSociete && p.sousSociete.trim()) sousSet.add(p.sousSociete.trim());

        const datesSet = new Set<string>();
        if (pDate) datesSet.add(pDate);

        const aSet = new Set<string>();
        aSet.add(agentName);

        map.set(num, {
          numeroFacture: num,
          societeId: p.societeId,
          societeNom: socNom,
          sousSocietes: sousSet,
          dates: datesSet,
          dateMin: pDate,
          dateMax: pDate,
          prestations: [p],
          assuresSet: aSet,
          nombreActes: p.lignes?.length || 1,
          totalFacture: fin.tot,
          totalTicketMod: fin.mod,
          totalARembourser: fin.remb,
          totalPaye: fin.totalPaye,
          totalExclu: fin.totalExclu,
          resteAReclamer: fin.resteAPayer,
          hasMatch: recInfo.hasMatch,
          hasDuplicate: recInfo.hasDuplicate,
          bordereaux: [...attBordereaux],
        });
      } else {
        const grp = map.get(num)!;
        if (p.sousSociete && p.sousSociete.trim()) grp.sousSocietes.add(p.sousSociete.trim());
        if (pDate) {
          grp.dates.add(pDate);
          if (!grp.dateMin || pDate < grp.dateMin) grp.dateMin = pDate;
          if (!grp.dateMax || pDate > grp.dateMax) grp.dateMax = pDate;
        }
        grp.prestations.push(p);
        grp.assuresSet.add(agentName);
        grp.nombreActes += (p.lignes?.length || 1);
        grp.totalFacture += fin.tot;
        grp.totalTicketMod += fin.mod;
        grp.totalARembourser += fin.remb;
        grp.totalPaye += fin.totalPaye;
        grp.totalExclu += fin.totalExclu;
        grp.resteAReclamer += fin.resteAPayer;
        if (recInfo.hasMatch) grp.hasMatch = true;
        if (recInfo.hasDuplicate) grp.hasDuplicate = true;

        attBordereaux.forEach(b => {
          if (!grp.bordereaux.some(ex => ex.bordereau === b.bordereau && ex.montant === b.montant && ex.nomAgent === b.nomAgent)) {
            grp.bordereaux.push(b);
          }
        });
      }
    });

    const list: GroupedFacture[] = Array.from(map.values()).map(grp => {
      const isAllRejete = grp.prestations.every(p => {
        const fin = getPrestationFinancials(p);
        return fin.statut === 'Rejeté' || p.statut === 'Rejeté';
      });
      const isFullyPaid = (grp.totalPaye >= grp.totalARembourser && grp.totalARembourser > 0) || (grp.resteAReclamer <= 0 && (grp.totalPaye > 0 || grp.totalARembourser === 0));
      const isPartiallyPaid = grp.totalPaye > 0 && !isFullyPaid && grp.resteAReclamer > 0;
      const statut: 'En attente' | 'Partiellement payé' | 'Payé' | 'Rejeté' = isAllRejete 
        ? 'Rejeté' 
        : isFullyPaid || grp.resteAReclamer <= 0 
        ? 'Payé' 
        : isPartiallyPaid 
        ? 'Partiellement payé' 
        : 'En attente';

      const tauxRecouvrement = grp.totalARembourser > 0 
        ? Math.min(100, Math.round((grp.totalPaye / grp.totalARembourser) * 100)) 
        : (grp.totalPaye > 0 ? 100 : 0);

      return {
        numeroFacture: grp.numeroFacture,
        societeId: grp.societeId,
        societeNom: grp.societeNom,
        sousSocietes: Array.from(grp.sousSocietes),
        dates: Array.from(grp.dates),
        dateMin: grp.dateMin,
        dateMax: grp.dateMax,
        prestations: grp.prestations,
        nombreAssures: grp.assuresSet.size,
        nombreActes: grp.nombreActes,
        totalFacture: grp.totalFacture,
        totalTicketMod: grp.totalTicketMod,
        totalARembourser: grp.totalARembourser,
        totalPaye: grp.totalPaye,
        totalExclu: grp.totalExclu,
        resteAReclamer: Math.max(0, grp.resteAReclamer),
        tauxRecouvrement,
        statut,
        hasMatch: grp.hasMatch,
        hasDuplicate: grp.hasDuplicate,
        bordereaux: grp.bordereaux,
      };
    });

    // Sort grouped invoices
    list.sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      switch (factureSortField) {
        case 'numeroFacture':
          valA = a.numeroFacture.toLowerCase();
          valB = b.numeroFacture.toLowerCase();
          break;
        case 'date':
          valA = a.dateMax || a.dateMin || '';
          valB = b.dateMax || b.dateMin || '';
          break;
        case 'societe':
          valA = a.societeNom.toLowerCase();
          valB = b.societeNom.toLowerCase();
          break;
        case 'nombreAssures':
          valA = a.nombreAssures;
          valB = b.nombreAssures;
          break;
        case 'nombreActes':
          valA = a.nombreActes;
          valB = b.nombreActes;
          break;
        case 'totalFacture':
          valA = a.totalFacture;
          valB = b.totalFacture;
          break;
        case 'totalTicketMod':
          valA = a.totalTicketMod;
          valB = b.totalTicketMod;
          break;
        case 'totalARembourser':
          valA = a.totalARembourser;
          valB = b.totalARembourser;
          break;
        case 'totalPaye':
          valA = a.totalPaye;
          valB = b.totalPaye;
          break;
        case 'resteAReclamer':
          valA = a.resteAReclamer;
          valB = b.resteAReclamer;
          break;
        case 'tauxRecouvrement':
          valA = a.tauxRecouvrement;
          valB = b.tauxRecouvrement;
          break;
        case 'statut':
          valA = a.statut;
          valB = b.statut;
          break;
        default:
          valA = a.dateMax || '';
          valB = b.dateMax || '';
      }

      if (typeof valA === 'number' && typeof valB === 'number') {
        return factureSortDirection === 'asc' ? valA - valB : valB - valA;
      }
      const comp = String(valA).localeCompare(String(valB));
      return factureSortDirection === 'asc' ? comp : -comp;
    });

    return list;
  }, [filteredAndSortedList, paymentsMap, factureSortField, factureSortDirection, societes, personnes]);

  // Aggregated totals across all grouped factures
  const groupedFacturesTotals = useMemo(() => {
    return groupedFactures.reduce((acc, f) => {
      acc.totalFacture += f.totalFacture;
      acc.totalTicketMod += f.totalTicketMod;
      acc.totalARembourser += f.totalARembourser;
      acc.totalPaye += f.totalPaye;
      acc.resteAReclamer += f.resteAReclamer;
      acc.totalAssures += f.nombreAssures;
      acc.totalActes += f.nombreActes;
      return acc;
    }, {
      totalFacture: 0,
      totalTicketMod: 0,
      totalARembourser: 0,
      totalPaye: 0,
      resteAReclamer: 0,
      totalAssures: 0,
      totalActes: 0,
    });
  }, [groupedFactures]);

  const handleFactureSort = (field: FactureSortField) => {
    if (factureSortField === field) {
      setFactureSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setFactureSortField(field);
      setFactureSortDirection(field.startsWith('total') || field === 'nombreAssures' || field === 'resteAReclamer' ? 'desc' : 'asc');
    }
  };

  const toggleFactureRow = (num: string) => {
    setExpandedFactureRows(prev => ({ ...prev, [num]: !prev[num] }));
  };

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


  const handleSaveLigneEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lineEditContext) return;
    const { prestation, ligne } = lineEditContext;
    
    // Update the line
    const updatedLignes = prestation.lignes.map(l => {
      if (l.id === ligne.id) {
        return {
          ...l,
          code: lineEditForm.code,
          libelle: lineEditForm.libelle,
          totalPrestation: Number(lineEditForm.totalPrestation),
          ticketModerateur: Number(lineEditForm.ticketModerateur),
          montantARembourser: Math.max(0, Number(lineEditForm.totalPrestation) - Number(lineEditForm.ticketModerateur))
        };
      }
      return l;
    });

    // Recalculate prestation totals based on updated lines
    const newTotalPrestation = updatedLignes.reduce((sum, l) => sum + (l.totalPrestation || 0), 0);
    const newParticipation = updatedLignes.reduce((sum, l) => sum + (l.ticketModerateur || 0), 0);
    const newMontantARembourser = Math.max(0, newTotalPrestation - newParticipation);

    const updatedPrestation = {
      ...prestation,
      lignes: updatedLignes,
      totalPrestation: newTotalPrestation,
      participation: newParticipation,
      ticketModerateur: newParticipation,
      montantARembourser: newMontantARembourser,
    };

    onSavePrestation(updatedPrestation);
    setLineEditContext(null);
  };

  const handleSaveLigneExclude = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lineExcludeContext || !onSavePaiement) return;
    
    const { prestation, ligne, maxExclu } = lineExcludeContext;
    const { montant, motif } = lineExcludeForm;
    const mnt = Number(montant);
    
    if (mnt <= 0 || mnt > maxExclu) {
       alert('Le montant à exclure doit être supérieur à 0 et inférieur ou égal au reste à payer (' + maxExclu + ').');
       return;
    }

    const pers = personnes.find(p => p.id === prestation.personneId);
    const newId = generateId('pai-rej');
    
    const exclusionPaiement: Paiement = {
      id: newId,
      numeroBordereau: `REJET-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      datePaiement: new Date().toISOString().split('T')[0],
      dateSaisie: new Date().toISOString().split('T')[0],
      societeId: prestation.societeId,
      nomAgent: pers?.nomPrenom || prestation.nomAgent,
      matricule: pers?.matricule || prestation.matricule,
      modePaiement: 'Autre',
      referencePaiement: `REJET-${ligne.code || 'ACTE'}`,
      totalReclame: mnt,
      totalPaye: 0,
      totalModerateur: 0,
      totalExclu: mnt,
      remise: 0,
      statut: 'Validé',
      notes: `Rejet acte ${ligne.code || ''} (${ligne.libelle || ''}) : ${motif}`,
      lignes: [
        {
          id: generateId('lp-rej'),
          paiementId: newId,
          lignePrestationId: ligne.id,
          prestationId: prestation.id,
          prestationNumero: prestation.numeroFacture,
          immatriculation: pers?.matricule || prestation.matricule || '',
          nomBaseAssurance: pers?.nomPrenom || prestation.nomAgent || '',
          nomAgent: pers?.nomPrenom || prestation.nomAgent || '',
          totalPaye: 0,
          montantPaye: 0,
          ticketModerateur: 0,
          montantExclu: mnt,
          montantReclame: mnt,
          actesPayes: [{ code: ligne.code, libelle: ligne.libelle, montant: 0 }],
          commentaire: motif
        }
      ]
    };
    
    // Update line status and prestation status
    const updatedLignes = (prestation.lignes || []).map(l => {
      if (l.id === ligne.id) {
        const lARemb = l.montantARembourser ?? (l.totalPrestation - (l.ticketModerateur || 0));
        const currentPaid = l.totalPaye || 0;
        const isRejet = currentPaid === 0 && (mnt >= lARemb || (mnt + (paymentsMap.lineExcluMap[l.id] || 0) >= lARemb));
        return {
          ...l,
          statut: isRejet ? ('Rejeté' as const) : l.statut,
        };
      }
      return l;
    });

    const isAllRejected = updatedLignes.every(l => l.statut === 'Rejeté');
    const newReste = Math.max(0, (prestation.resteAPayer !== undefined ? prestation.resteAPayer : (prestation.montantARembourser ?? prestation.totalPrestation)) - mnt);
    const updatedPrestation: Prestation = {
      ...prestation,
      resteAPayer: newReste,
      lignes: updatedLignes,
      statut: isAllRejected ? ('Rejeté' as const) : newReste <= 0 ? ('Payé' as const) : prestation.statut,
    };

    onSavePaiement(exclusionPaiement, [updatedPrestation]);
    setLineExcludeContext(null);
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
    if (viewMode === 'factures') {
      const rows = groupedFactures.map(f => ({
        'N° Facture': f.numeroFacture,
        'Société': f.societeNom,
        'Sous-Sociétés': f.sousSocietes.join(', '),
        'Période': f.dateMin === f.dateMax ? f.dateMin : `${f.dateMin} au ${f.dateMax}`,
        'Nombre d\'Assurés': f.nombreAssures,
        'Nombre d\'Actes': f.nombreActes,
        'Total Brut (Facturé)': f.totalFacture,
        'Ticket Modérateur': f.totalTicketMod,
        'Part Assurance (Réclamé)': f.totalARembourser,
        'Total Perçu (Encaissé)': f.totalPaye,
        'Restant à Réclamer': f.resteAReclamer,
        'Taux Recouvrement (%)': `${f.tauxRecouvrement}%`,
        'Statut': f.statut,
        'Bordereaux Règlements': f.bordereaux.map(b => b.bordereau).join(', '),
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Synthese_Factures');
      XLSX.writeFile(workbook, `Synthese_Factures_${new Date().toISOString().split('T')[0]}.xlsx`);
      return;
    }

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
    <div id="prestations-view" className="space-y-4 pb-6 w-full">
      {/* Action Header with View Mode Switcher & Streamlined Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-900">Dossiers de Prestations & Factures</h2>
            
            {/* View Mode Switcher */}
            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('factures')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'factures'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Receipt className="w-3.5 h-3.5 text-indigo-600" />
                <span>Vue par Facture</span>
                <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-indigo-100 text-indigo-800 font-bold">
                  {groupedFactures.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('detaillee')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'detaillee'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-slate-600" />
                <span>Vue Détaillée (Dossiers)</span>
                <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-slate-200 text-slate-700 font-bold">
                  {filteredAndSortedList.length}
                </span>
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Suivi des factures médicales, total perçu, restants à réclamer et état des tickets modérateurs
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center flex-wrap gap-2">
          <button
            id="btn-import-salfa"
            onClick={() => setIsSalfaModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 shadow-2xs transition cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600" />
            <span>Importer Facture SALFA</span>
          </button>

          {/* Consolidated Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(prev => !prev)}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Exports & Rapports</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showExportMenu && (
              <>
                <div 
                  className="fixed inset-0 z-20" 
                  onClick={() => setShowExportMenu(false)}
                />
                <div className="absolute right-0 mt-1.5 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-30 text-xs animate-in fade-in zoom-in-95 duration-100">
                  <button
                    onClick={() => { setShowExportMenu(false); handleExportExcel(); }}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-slate-700 flex items-center space-x-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-emerald-600" />
                    <div>
                      <div className="font-semibold">Exporter Excel (.xlsx)</div>
                      <div className="text-[10px] text-slate-400">
                        {viewMode === 'factures' ? 'Synthèse factures groupées' : 'Lignes et dossiers détaillés'}
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => { setShowExportMenu(false); handleExportRecouvrementPdfSelected(); }}
                    disabled={selectedPrestations.size === 0}
                    className={`w-full text-left px-3.5 py-2 flex items-center space-x-2 ${
                      selectedPrestations.size > 0 
                        ? 'hover:bg-slate-50 text-slate-700 cursor-pointer' 
                        : 'text-slate-300 cursor-not-allowed'
                    }`}
                  >
                    <FileText className={`w-4 h-4 ${selectedPrestations.size > 0 ? 'text-amber-600' : 'text-slate-300'}`} />
                    <div>
                      <div className="font-semibold">PDF Sélection Détaillé ({selectedPrestations.size})</div>
                      <div className="text-[10px] text-slate-400">Rapport personnalisé avec récap mensuel & actes</div>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>

          <button
            id="btn-new-prestation"
            onClick={handleOpenCreate}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvelle Facture</span>
          </button>
        </div>
      </div>

      {/* Main Multi-criteria Filter Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
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
              { key: 'ALL', label: 'Tous', count: statusCounts.all },
              { key: 'EN_COURS', label: 'Encour', count: statusCounts.enCours },
              { key: 'Payé', label: 'Payé', count: statusCounts.paye }
            ].map(st => (
              <button
                key={st.key}
                onClick={() => setStatusFilter(st.key)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === st.key
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{st.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  statusFilter === st.key ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-700'
                }`}>
                  {st.count}
                </span>
              </button>
            ))}

            {/* Filtre avancé placé juste après le statut */}
            <div className="flex items-center gap-1.5 ml-1">
              <button
                onClick={() => setShowAdvancedFilters(prev => !prev)}
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition cursor-pointer ${
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
                  className="flex items-center space-x-1 px-2 py-1 rounded-lg text-xs font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition cursor-pointer"
                  title="Réinitialiser tous les filtres"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Effacer</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Expandable Multi-criteria Filter Panel */}
        {showAdvancedFilters && (
          <div className="pt-3 mt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50/60 p-3 rounded-lg">
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
                  className="text-[10px] text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                >
                  Ce mois
                </button>
                <span className="text-slate-300 text-[10px]">|</span>
                <button
                  type="button"
                  onClick={() => setDatePreset('last_month')}
                  className="text-[10px] text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                >
                  Mois dernier
                </button>
                <span className="text-slate-300 text-[10px]">|</span>
                <button
                  type="button"
                  onClick={() => setDatePreset('this_year')}
                  className="text-[10px] text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                >
                  Année
                </button>
                <span className="text-slate-300 text-[10px]">|</span>
                <button
                  type="button"
                  onClick={() => setDatePreset('all')}
                  className="text-[10px] text-slate-500 hover:text-slate-700 hover:underline cursor-pointer"
                >
                  Tout
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Table Section: Vue par Facture VS Vue Détaillée */}
      {viewMode === 'factures' ? (
        <FacturesGroupedTable
          factures={groupedFactures}
          expandedFactureRows={expandedFactureRows}
          toggleFactureRow={toggleFactureRow}
          factureSortField={factureSortField}
          factureSortDirection={factureSortDirection}
          onSort={handleFactureSort}
          onViewFacture={(f) => setViewingFacture(f)}
          getPersonne={getPersonne}
        />
      ) : (
        /* Detailed Dossiers Table */
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col max-h-[calc(100vh-220px)]">
          <div className="overflow-auto flex-1">
            <table className="w-full text-left text-xs">
            <thead className="sticky top-0 z-10 bg-slate-50 text-slate-700 uppercase text-[11px] font-semibold border-b border-slate-200 select-none shadow-2xs">
              <tr>
                <th className="py-3 px-2 w-8">
                  <input 
                    type="checkbox" 
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    checked={filteredAndSortedList.length > 0 && selectedPrestations.size === filteredAndSortedList.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedPrestations(new Set(filteredAndSortedList.map(p => p.id)));
                      } else {
                        setSelectedPrestations(new Set());
                      }
                    }}
                  />
                </th>
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
                  <td colSpan={13} className="py-10 text-center text-slate-400 space-y-2">
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
                  const recInfo = getPrestationReconciliationInfo(prestation);
                  const attachedBordereaux = paymentsMap.prestBordereauxMap[prestation.id] || paymentsMap.prestBordereauxMap[prestation.numeroFacture] || [];

                  // Tooltips for manual reconciliation
                  const matchTooltip = recInfo.hasMatch 
                    ? `Même date et montant qu'un règlement enregistré (${recInfo.matchingSettlements.map(s => `Bordereau ${s.numeroBordereau} : ${formatMoney(s.montantPaye)}`).join(', ')})`
                    : undefined;
                  const duplicateTooltip = recInfo.hasDuplicate
                    ? `Attention : ${recInfo.duplicatePrestations.length} autre(s) facture(s) avec la même date (${formatDate(prestation.date)}) et le même montant (${formatMoney(fin.tot)}) : ${recInfo.duplicatePrestations.map(d => d.numeroFacture).join(', ')}`
                    : undefined;

                  return (
                    <React.Fragment key={prestation.id}>
                      <tr className={`transition hover:bg-slate-50/80 ${
                        recInfo.hasMatch ? 'bg-emerald-50/20' : recInfo.hasDuplicate ? 'bg-amber-50/20' : ''
                      }`}>
                        <td className="py-3 px-2 text-center">
                          <input 
                            type="checkbox" 
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer bg-slate-50"
                            checked={selectedPrestations.has(prestation.id)}
                            onChange={(e) => {
                              const newSet = new Set(selectedPrestations);
                              if (e.target.checked) newSet.add(prestation.id);
                              else newSet.delete(prestation.id);
                              setSelectedPrestations(newSet);
                            }}
                          />
                        </td>
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
                          <div className="flex items-center gap-1">
                            <span className={
                              recInfo.hasMatch 
                                ? 'border-b-2 border-dashed border-emerald-500 text-emerald-900 font-bold' 
                                : recInfo.hasDuplicate 
                                ? 'border-b-2 border-dashed border-amber-500 text-amber-900 font-semibold' 
                                : ''
                            } title={matchTooltip || duplicateTooltip}>
                              {formatDate(prestation.date)}
                            </span>
                            {recInfo.hasMatch && (
                              <span title={matchTooltip} className="inline-flex items-center text-emerald-600">
                                <Sparkles className="w-3.5 h-3.5" />
                              </span>
                            )}
                            {recInfo.hasDuplicate && (
                              <span title={duplicateTooltip} className="inline-flex items-center text-amber-500">
                                <AlertTriangle className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </div>
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
                          <div className="flex items-center justify-end gap-1">
                            <span className={
                              recInfo.hasMatch 
                                ? 'border-b-2 border-dashed border-emerald-500 text-emerald-900' 
                                : recInfo.hasDuplicate 
                                ? 'border-b-2 border-dashed border-amber-500 text-amber-900' 
                                : ''
                            } title={matchTooltip || duplicateTooltip}>
                              {formatMoney(fin.tot)}
                            </span>
                            {recInfo.hasMatch && (
                              <span title={matchTooltip} className="text-[10px] px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 font-semibold">
                                Match
                              </span>
                            )}
                            {recInfo.hasDuplicate && (
                              <span title={duplicateTooltip} className="text-[10px] px-1 py-0.2 rounded bg-amber-100 text-amber-800 font-semibold">
                                Doublon
                              </span>
                            )}
                          </div>
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
                          <td colSpan={13} className="p-4 pl-12 space-y-3">
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
                                    <th className="py-2 px-2 text-center">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {prestation.lignes.map(ligne => {
                                    const lFin = getLineFinancials(ligne, prestation);
                                    const actMatchTooltip = lFin.matchingSettlementLine 
                                      ? `Concordance trouvée : Règlement bordereau ${lFin.matchingSettlementLine.numeroBordereau} (${formatMoney(lFin.matchingSettlementLine.montantPaye)})`
                                      : undefined;

                                    return (
                                      <tr key={ligne.id} className={`hover:bg-slate-50 ${lFin.matchingSettlementLine ? 'bg-emerald-50/30' : ''}`}>
                                        <td className="py-2 px-2 font-mono font-bold text-indigo-700">
                                          <div className="flex items-center gap-1">
                                            <span>{ligne.code}</span>
                                            {lFin.matchingSettlementLine && (
                                              <span title={actMatchTooltip} className="inline-flex items-center text-emerald-600">
                                                <Sparkles className="w-3 h-3" />
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                        <td className="py-2 px-2 text-slate-700">
                                          {ligne.libelle || 'Acte de soins'}
                                        </td>
                                        <td className="py-2 px-2 text-right font-medium text-slate-900">
                                          <span className={lFin.matchingSettlementLine ? 'border-b-2 border-dashed border-emerald-500 text-emerald-900 font-bold' : ''} title={actMatchTooltip}>
                                            {formatMoney(lFin.lBrut)}
                                          </span>
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
                                              : lFin.statut === 'Rejeté'
                                              ? 'bg-rose-100 text-rose-800'
                                              : lFin.statut === 'Partiellement payé'
                                              ? 'bg-sky-100 text-sky-800'
                                              : 'bg-amber-100 text-amber-800'
                                          }`}>
                                            {lFin.statut}
                                          </span>
                                        </td>
                                        <td className="py-2 px-2 text-center">
                                          <div className="flex items-center justify-center gap-2">
                                            <button 
                                              onClick={(e) => { e.stopPropagation(); setLineEditContext({ prestation, ligne }); }}
                                              className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition" 
                                              title="Modifier la ligne"
                                            >
                                              <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                            {lFin.lReste > 0 && (
                                              <button 
                                                onClick={(e) => { e.stopPropagation(); setLineExcludeContext({ prestation, ligne, maxExclu: lFin.lReste }); setLineExcludeForm({ montant: lFin.lReste, motif: 'Rejet direct' }); }}
                                                className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                                                title="Envoyer en exclusion / rejet"
                                              >
                                                <Ban className="w-3.5 h-3.5" />
                                              </button>
                                            )}
                                          </div>
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

        {/* Bar de Totaux Généraux toujours visible en bas de la page */}
        <div className="sticky bottom-0 z-20 shrink-0 bg-slate-900 text-white border-t border-slate-800 px-4 py-3 shadow-xl flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 font-bold uppercase text-slate-300 tracking-wider">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
            <span>
              {selectedPrestations.size > 0 
                ? `Total sélection (${selectedPrestations.size} / ${stats.count} dossiers)`
                : `Total général (${stats.count} dossiers)`}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 sm:gap-6 font-mono font-bold">
            <div className="text-right">
              <span className="text-[10px] uppercase font-sans text-slate-400 block font-normal">Total Brut</span>
              <span className="text-slate-100">
                {formatMoney(selectedPrestations.size > 0 ? selectedStats.totalFacture : stats.totalFacture)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-sans text-amber-400 block font-normal">Ticket Mod.</span>
              <span className="text-amber-300">
                {formatMoney(selectedPrestations.size > 0 ? selectedStats.totalTicketMod : stats.totalTicketMod)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-sans text-indigo-300 block font-normal">À Rembourser</span>
              <span className="text-indigo-200">
                {formatMoney(selectedPrestations.size > 0 ? selectedStats.totalARembourser : stats.totalARembourser)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-sans text-emerald-400 block font-normal">Total Payé</span>
              <span className="text-emerald-400">
                {formatMoney(selectedPrestations.size > 0 ? selectedStats.totalPaye : stats.totalPaye)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-sans text-rose-400 block font-normal">Reste à Payer</span>
              <span className={(selectedPrestations.size > 0 ? selectedStats.totalReste : stats.totalReste) > 0 ? 'text-rose-400 font-extrabold' : 'text-slate-400'}>
                {formatMoney(selectedPrestations.size > 0 ? selectedStats.totalReste : stats.totalReste)}
              </span>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Modal: View Grouped Facture Details */}
      <FactureDetailModal
        facture={viewingFacture}
        onClose={() => setViewingFacture(null)}
        getPersonne={getPersonne}
        getSocieteNom={getSocieteNom}
      />

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

            <div className="space-y-2 bg-white rounded-lg border border-slate-200 p-3 shadow-xs">
              <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5 text-indigo-700">
                  <span>Lignes de Prestation (Actes Médicaux & Montants)</span>
                </span>
                <span className="text-slate-400 lowercase font-normal">{viewingPrestation.lignes.length} actes dans cette prescription</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-[10px] text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-2 text-left">Code Acte</th>
                      <th className="py-2 px-2 text-left">Libellé / Acte médical</th>
                      <th className="py-2 px-2 text-right">Montant Brut</th>
                      <th className="py-2 px-2 text-right">Ticket Modérateur</th>
                      <th className="py-2 px-2 text-right">À Rembourser</th>
                      <th className="py-2 px-2 text-right">Somme Payée</th>
                      <th className="py-2 px-2 text-right">Reste à payer</th>
                      <th className="py-2 px-2 text-center">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viewingPrestation.lignes.map(ligne => {
                      const lFin = getLineFinancials(ligne, viewingPrestation);
                      return (
                        <tr key={ligne.id} className="hover:bg-slate-50 transition">
                          <td className="py-3 px-2 font-mono font-bold text-indigo-600 whitespace-nowrap">{ligne.code}</td>
                          <td className="py-3 px-2 text-slate-700">{ligne.libelle}</td>
                          <td className="py-3 px-2 text-right font-medium whitespace-nowrap text-slate-600">
                            {formatMoney(lFin.lBrut)}
                          </td>
                          <td className="py-3 px-2 text-right text-amber-700 font-medium whitespace-nowrap">
                            {formatMoney(lFin.lPart)}
                          </td>
                          <td className="py-3 px-2 text-right font-bold text-slate-900 whitespace-nowrap">
                            {formatMoney(lFin.lARemb)}
                          </td>
                          <td className="py-3 px-2 text-right text-emerald-700 font-bold whitespace-nowrap">
                            {formatMoney(lFin.lTotalPaye)}
                          </td>
                          <td className="py-3 px-2 text-right font-bold whitespace-nowrap">
                            <span className={lFin.lReste > 0 ? 'text-rose-700 font-bold' : 'text-slate-400'}>
                              {formatMoney(lFin.lReste)}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-center whitespace-nowrap">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              lFin.statut === 'Payé'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : lFin.statut === 'Partiellement payé'
                                ? 'bg-sky-100 text-sky-800 border border-sky-200'
                                : lFin.statut === 'Rejeté'
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
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


      {/* Edit Line Modal */}
      {lineEditContext && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center space-x-2 text-indigo-900">
                <Edit2 className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-bold">Modifier l'Acte</h3>
              </div>
              <button
                onClick={() => setLineEditContext(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveLigneEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-slate-700 text-sm font-semibold mb-1">Code Acte / Famille *</label>
                <select
                  value={lineEditForm.code}
                  onChange={(e) => setLineEditForm(prev => ({ ...prev, code: e.target.value }))}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                >
                  <option value="">Sélectionner une famille...</option>
                  {familles.map(f => (
                    <option key={f.code} value={f.code}>{f.code} - {f.libelle}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-slate-700 text-sm font-semibold mb-1">Libellé / Description *</label>
                <input
                  type="text"
                  value={lineEditForm.libelle}
                  onChange={(e) => setLineEditForm(prev => ({ ...prev, libelle: e.target.value }))}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 text-sm font-semibold mb-1">Montant Brut *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={lineEditForm.totalPrestation}
                    onChange={(e) => setLineEditForm(prev => ({ ...prev, totalPrestation: Number(e.target.value) }))}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-right font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 text-sm font-semibold mb-1">Ticket Modérateur</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={lineEditForm.ticketModerateur}
                    onChange={(e) => setLineEditForm(prev => ({ ...prev, ticketModerateur: Number(e.target.value) }))}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-right font-bold text-amber-700"
                  />
                </div>
              </div>
              
              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setLineEditContext(null)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-100"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

{/* Exclude Line Modal */}
      {lineExcludeContext && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-rose-100 flex items-center justify-between bg-rose-50/50">
              <div className="flex items-center space-x-2 text-rose-900">
                <Ban className="w-5 h-5 text-rose-600" />
                <h3 className="text-lg font-bold">Exclure / Rejeter l'Acte</h3>
              </div>
              <button
                onClick={() => setLineExcludeContext(null)}
                className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-100 rounded-full transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveLigneExclude} className="p-6 space-y-4">
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-amber-800 text-xs mb-4">
                <p className="font-semibold mb-1 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5"/> Action comptable</p>
                <p>Le montant exclu sera enregistré dans le tableau de bord des rejets et soustrait du reste à payer de la facture.</p>
              </div>
              
              <div>
                <label className="block text-slate-700 text-sm font-semibold mb-1">
                  Montant à exclure (Max: {formatMoney(lineExcludeContext.maxExclu)}) *
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={lineExcludeContext.maxExclu}
                  value={lineExcludeForm.montant}
                  onChange={(e) => setLineExcludeForm(prev => ({ ...prev, montant: Number(e.target.value) }))}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none text-right font-bold text-rose-700"
                  required
                />
              </div>
              
              <div>
                <label className="block text-slate-700 text-sm font-semibold mb-1">Motif du rejet / exclusion *</label>
                <input
                  type="text"
                  value={lineExcludeForm.motif}
                  onChange={(e) => setLineExcludeForm(prev => ({ ...prev, motif: e.target.value }))}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  placeholder="Ex: Plafond dépassé, Acte non garanti..."
                  required
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setLineExcludeContext(null)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-100"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-sm font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-sm"
                >
                  Confirmer le rejet
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
        defaultSocieteId={filterSocieteId !== 'ALL' ? filterSocieteId : (selectedSocieteId !== 'ALL' ? selectedSocieteId : undefined)}
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
