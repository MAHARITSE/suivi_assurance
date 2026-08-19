import React, { useState, useMemo } from 'react';
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
  AlertTriangle,
  CalendarCheck,
  Tag,
  Sparkles,
  Link2,
  FileCheck2,
  Printer,
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
  RotateCcw,
  Filter,
  Layers,
  Users,
  Boxes,
  FileText
} from 'lucide-react';
import { Paiement, LignePaiement, Prestation, Societe, Personne, Famille } from '../types';
import { formatMoney, formatDate, generateId } from '../utils/formatters';
import { DecompteImportModal } from './DecompteImportModal';
import * as XLSX from 'xlsx';

type PaiementSortField = 'datePaiement' | 'numeroBordereau' | 'societe' | 'modePaiement' | 'totalReclame' | 'totalPaye' | 'totalModerateur' | 'totalExclu' | 'statut';
type GroupSortField = 'dateSoins' | 'nomAgent' | 'codeActe' | 'societe' | 'totalReclame' | 'totalPaye' | 'ticketModerateur' | 'totalExclu' | 'nombreLignes';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'bordereaux' | 'groupes_actes';

export interface GroupedPaymentAct {
  groupKey: string;
  nomAgent: string;
  immatriculation: string;
  dateSoins: string;
  codeActe: string;
  libelleActe: string;
  societeNom: string;
  societeId: string;
  bordereaux: Array<{
    paiementId: string;
    numeroBordereau: string;
    datePaiement: string;
    modePaiement: string;
    referencePaiement: string;
  }>;
  prestationsNumeros: string[];
  totalReclame: number;
  totalPaye: number;
  ticketModerateur: number;
  totalExclu: number;
  nombreLignes: number;
  lignes: Array<{
    ligneId: string;
    paiementId: string;
    numeroBordereau: string;
    datePaiement: string;
    dateSoins?: string;
    prestationNumero?: string;
    montantReclame?: number;
    ticketModerateur?: number;
    totalPaye: number;
    montantExclu: number;
    codeActe?: string;
    libelleActe?: string;
    actesPayes?: Array<{ code: string; libelle: string; montant: number }>;
    commentaire?: string;
  }>;
}

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
  const [viewMode, setViewMode] = useState<ViewMode>('bordereaux');
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [expandedGroupRows, setExpandedGroupRows] = useState<Record<string, boolean>>({});
  const [groupLinesInBordereau, setGroupLinesInBordereau] = useState<boolean>(true);
  const [viewingPaiement, setViewingPaiement] = useState<Paiement | null>(null);
  const [isDecompteModalOpen, setIsDecompteModalOpen] = useState<boolean>(false);

  // Sorting state for bordereaux
  const [sortField, setSortField] = useState<PaiementSortField>('datePaiement');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Sorting state for grouped view (Patient + Date + Actes)
  const [groupSortField, setGroupSortField] = useState<GroupSortField>('dateSoins');
  const [groupSortDirection, setGroupSortDirection] = useState<SortDirection>('desc');

  // Multi-criteria filters state
  const [filterSocieteId, setFilterSocieteId] = useState<string>('ALL');
  const [filterMode, setFilterMode] = useState<string>('ALL');
  const [filterStatut, setFilterStatut] = useState<string>('ALL');
  const [filterExclusion, setFilterExclusion] = useState<'ALL' | 'AVEC_EXCLUSION' | 'SANS_EXCLUSION'>('ALL');
  const [dateDebut, setDateDebut] = useState<string>('');
  const [dateFin, setDateFin] = useState<string>('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);

  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleGroupRow = (key: string) => {
    setExpandedGroupRows(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getSocieteNom = (id: string) => societes.find(s => s.id === id)?.nom || 'Société';

  // Memoized Lookup of all medical acts and prescriptions for confrontation / manual reconciliation
  const prestationActsLookup = useMemo(() => {
    const list: Array<{
      prestationId: string;
      numeroFacture: string;
      date: string;
      nomAgent?: string;
      matricule?: string;
      societeId?: string;
      montantBrut: number;
      montantARembourser: number;
      codeActe?: string;
      libelleActe?: string;
    }> = [];

    (prestations || []).forEach(p => {
      const pTot = p.montantTotal ?? p.totalPrestation ?? 0;
      const pRemb = p.montantARembourser ?? Math.max(0, pTot - (p.ticketModerateur ?? p.participation ?? 0));
      const pDate = p.date ? p.date.split('T')[0] : '';
      list.push({
        prestationId: p.id,
        numeroFacture: p.numeroFacture,
        date: pDate,
        nomAgent: p.nomAgent,
        matricule: p.matricule,
        societeId: p.societeId,
        montantBrut: pTot,
        montantARembourser: pRemb,
      });

      (p.lignes || []).forEach(l => {
        const lBrut = l.totalPrestation || 0;
        const lRemb = l.montantARembourser ?? Math.max(0, lBrut - (l.ticketModerateur || 0));
        list.push({
          prestationId: p.id,
          numeroFacture: p.numeroFacture,
          date: pDate,
          nomAgent: p.nomAgent,
          matricule: p.matricule,
          societeId: p.societeId,
          montantBrut: lBrut,
          montantARembourser: lRemb,
          codeActe: l.code,
          libelleActe: l.libelle,
        });
      });
    });

    return list;
  }, [prestations]);

  // Reconciliation analysis for a payment
  const getPaiementReconciliationInfo = (p: Paiement) => {
    const pDate = p.datePaiement ? p.datePaiement.split('T')[0] : '';
    const pPaye = p.totalPaye || 0;
    const pReclame = p.totalReclame || 0;

    // Check if any payment line or total matches a prestation on date and montant
    const matchingPrestations = prestationActsLookup.filter(pa => {
      const matchDate = (pa.date && pa.date === pDate) || (p.lignes?.some(l => l.dateSoins && l.dateSoins.split('T')[0] === pa.date));
      const matchAmount = Math.abs(pa.montantBrut - pReclame) < 1 || 
                          Math.abs(pa.montantARembourser - pPaye) < 1 || 
                          Math.abs(pa.montantBrut - pPaye) < 1 ||
                          (p.lignes?.some(l => Math.abs(pa.montantBrut - (l.montantReclame || l.totalPaye)) < 1 || Math.abs(pa.montantARembourser - l.totalPaye) < 1));
      return matchDate && matchAmount;
    });

    // Check duplicate payments (same payment date and same totalPaye)
    const duplicatePayments = paiements.filter(other => {
      if (other.id === p.id) return false;
      const oDate = other.datePaiement ? other.datePaiement.split('T')[0] : '';
      return oDate === pDate && Math.abs((other.totalPaye || 0) - pPaye) < 1;
    });

    const hasMatch = matchingPrestations.length > 0;
    const hasDuplicate = duplicatePayments.length > 0;

    return {
      hasMatch,
      matchingPrestations,
      hasDuplicate,
      duplicatePayments,
      isReconciled: hasMatch || hasDuplicate,
    };
  };

  const getLignePaiementMatchInfo = (l: LignePaiement, p: Paiement) => {
    const lDate = l.dateSoins ? l.dateSoins.split('T')[0] : (p.datePaiement ? p.datePaiement.split('T')[0] : '');
    const lReclame = l.montantReclame || l.totalPaye + (l.ticketModerateur || 0);
    const lPaye = l.montantPaye || l.totalPaye;

    const matchedPrescription = prestationActsLookup.find(pa => {
      const matchDate = pa.date === lDate;
      const matchAmount = Math.abs(pa.montantBrut - lReclame) < 1 || Math.abs(pa.montantARembourser - lPaye) < 1 || Math.abs(pa.montantBrut - lPaye) < 1;
      return matchDate && matchAmount;
    });

    return {
      hasMatch: !!matchedPrescription,
      matchedPrescription,
    };
  };

  const handleSort = (field: PaiementSortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field.startsWith('total') ? 'desc' : 'asc');
    }
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setFilterSocieteId('ALL');
    setFilterMode('ALL');
    setFilterStatut('ALL');
    setFilterExclusion('ALL');
    setDateDebut('');
    setDateFin('');
  };

  const setDatePreset = (preset: 'this_month' | 'last_month' | 'this_year' | 'all') => {
    const now = new Date();
    if (preset === 'all') {
      setDateDebut('');
      setDateFin('');
      return;
    }
    if (preset === 'this_month') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      setDateDebut(first);
      setDateFin(last);
    } else if (preset === 'last_month') {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      const last = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      setDateDebut(first);
      setDateFin(last);
    } else if (preset === 'this_year') {
      const first = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      const last = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
      setDateDebut(first);
      setDateFin(last);
    }
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterSocieteId !== 'ALL') count++;
    if (filterMode !== 'ALL') count++;
    if (filterStatut !== 'ALL') count++;
    if (filterExclusion !== 'ALL') count++;
    if (dateDebut || dateFin) count++;
    return count;
  }, [filterSocieteId, filterMode, filterStatut, filterExclusion, dateDebut, dateFin]);

  // Filtered and Sorted list
  const filteredAndSortedPaiements = useMemo(() => {
    return paiements
      .filter(p => {
        // Global toolbar society filter
        if (selectedSocieteId !== 'ALL' && p.societeId !== selectedSocieteId) {
          return false;
        }

        // Advanced filter society
        if (filterSocieteId !== 'ALL' && p.societeId !== filterSocieteId) {
          return false;
        }

        // Mode filter
        if (filterMode !== 'ALL' && p.modePaiement !== filterMode) {
          return false;
        }

        // Statut filter
        if (filterStatut !== 'ALL' && p.statut !== filterStatut) {
          return false;
        }

        // Exclusion filter
        if (filterExclusion === 'AVEC_EXCLUSION' && (p.totalExclu || 0) <= 0) {
          return false;
        }
        if (filterExclusion === 'SANS_EXCLUSION' && (p.totalExclu || 0) > 0) {
          return false;
        }

        // Date range
        if (dateDebut && p.datePaiement < dateDebut) {
          return false;
        }
        if (dateFin && p.datePaiement > dateFin) {
          return false;
        }

        // Search query
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const socNom = getSocieteNom(p.societeId).toLowerCase();
          const matchHeader = 
            p.numeroBordereau.toLowerCase().includes(q) ||
            p.referencePaiement.toLowerCase().includes(q) ||
            (p.notes && p.notes.toLowerCase().includes(q)) ||
            (p.modePaiement && p.modePaiement.toLowerCase().includes(q)) ||
            socNom.includes(q);

          const matchLines = p.lignes?.some(l => 
            (l.nomAgent && l.nomAgent.toLowerCase().includes(q)) ||
            (l.nomBaseAssurance && l.nomBaseAssurance.toLowerCase().includes(q)) ||
            (l.immatriculation && l.immatriculation.toLowerCase().includes(q)) ||
            (l.prestationNumero && l.prestationNumero.toLowerCase().includes(q)) ||
            (l.commentaire && l.commentaire.toLowerCase().includes(q))
          );

          if (!matchHeader && !matchLines) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        let valA: any = '';
        let valB: any = '';

        switch (sortField) {
          case 'datePaiement':
            valA = a.datePaiement || '';
            valB = b.datePaiement || '';
            break;
          case 'numeroBordereau':
            valA = a.numeroBordereau || '';
            valB = b.numeroBordereau || '';
            break;
          case 'societe':
            valA = getSocieteNom(a.societeId).toLowerCase();
            valB = getSocieteNom(b.societeId).toLowerCase();
            break;
          case 'modePaiement':
            valA = a.modePaiement || '';
            valB = b.modePaiement || '';
            break;
          case 'totalReclame':
            valA = a.totalReclame || 0;
            valB = b.totalReclame || 0;
            break;
          case 'totalPaye':
            valA = a.totalPaye || 0;
            valB = b.totalPaye || 0;
            break;
          case 'totalModerateur':
            valA = a.totalModerateur || 0;
            valB = b.totalModerateur || 0;
            break;
          case 'totalExclu':
            valA = a.totalExclu || 0;
            valB = b.totalExclu || 0;
            break;
          case 'statut':
            valA = a.statut || '';
            valB = b.statut || '';
            break;
          default:
            valA = a.datePaiement || '';
            valB = b.datePaiement || '';
        }

        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortDirection === 'asc' ? valA - valB : valB - valA;
        }

        const comp = String(valA).localeCompare(String(valB));
        return sortDirection === 'asc' ? comp : -comp;
      });
  }, [
    paiements,
    selectedSocieteId,
    filterSocieteId,
    filterMode,
    filterStatut,
    filterExclusion,
    dateDebut,
    dateFin,
    searchTerm,
    sortField,
    sortDirection,
    societes,
  ]);

  // Grouped Aggregation across all filtered payments: Group by Personne (Patient) + Date des Soins + Mêmes Actes
  const groupedPaymentActs = useMemo(() => {
    const groupsMap = new Map<string, GroupedPaymentAct>();

    filteredAndSortedPaiements.forEach(p => {
      const socNom = getSocieteNom(p.societeId);

      (p.lignes || []).forEach(l => {
        const rawNom = (l.nomAgent || l.nomBaseAssurance || 'Assuré inconnu').trim();
        const rawDate = (l.dateSoins || p.datePaiement || '').split('T')[0];
        
        // Determine act code & label
        let actCode = (l.codeActe || (l.actesPayes && l.actesPayes[0]?.code) || 'CONS').toUpperCase().trim();
        let actLibelle = l.libelleActe || (l.actesPayes && l.actesPayes[0]?.libelle) || actCode;
        
        const groupKey = `${rawNom.toLowerCase()}|${rawDate}|${actCode.toLowerCase()}`;

        const reclame = Number(l.montantReclame || ((l.totalPaye || 0) + (l.ticketModerateur || 0)) || 0);
        const paye = Number(l.totalPaye || l.montantPaye || 0);
        const mod = Number(l.ticketModerateur || 0);
        const exclu = Number(l.montantExclu || 0);

        if (!groupsMap.has(groupKey)) {
          groupsMap.set(groupKey, {
            groupKey,
            nomAgent: rawNom,
            immatriculation: l.immatriculation || '-',
            dateSoins: rawDate,
            codeActe: actCode,
            libelleActe: actLibelle,
            societeNom: socNom,
            societeId: p.societeId,
            bordereaux: [
              {
                paiementId: p.id,
                numeroBordereau: p.numeroBordereau,
                datePaiement: p.datePaiement,
                modePaiement: p.modePaiement,
                referencePaiement: p.referencePaiement,
              }
            ],
            prestationsNumeros: l.prestationNumero ? [l.prestationNumero] : [],
            totalReclame: reclame,
            totalPaye: paye,
            ticketModerateur: mod,
            totalExclu: exclu,
            nombreLignes: 1,
            lignes: [
              {
                ligneId: l.id,
                paiementId: p.id,
                numeroBordereau: p.numeroBordereau,
                datePaiement: p.datePaiement,
                dateSoins: l.dateSoins,
                prestationNumero: l.prestationNumero,
                montantReclame: reclame,
                ticketModerateur: mod,
                totalPaye: paye,
                montantExclu: exclu,
                codeActe: actCode,
                libelleActe: actLibelle,
                actesPayes: l.actesPayes,
                commentaire: l.commentaire,
              }
            ]
          });
        } else {
          const grp = groupsMap.get(groupKey)!;
          grp.totalReclame += reclame;
          grp.totalPaye += paye;
          grp.ticketModerateur += mod;
          grp.totalExclu += exclu;
          grp.nombreLignes += 1;

          if (!grp.bordereaux.some(b => b.paiementId === p.id)) {
            grp.bordereaux.push({
              paiementId: p.id,
              numeroBordereau: p.numeroBordereau,
              datePaiement: p.datePaiement,
              modePaiement: p.modePaiement,
              referencePaiement: p.referencePaiement,
            });
          }

          if (l.prestationNumero && !grp.prestationsNumeros.includes(l.prestationNumero)) {
            grp.prestationsNumeros.push(l.prestationNumero);
          }

          grp.lignes.push({
            ligneId: l.id,
            paiementId: p.id,
            numeroBordereau: p.numeroBordereau,
            datePaiement: p.datePaiement,
            dateSoins: l.dateSoins,
            prestationNumero: l.prestationNumero,
            montantReclame: reclame,
            ticketModerateur: mod,
            totalPaye: paye,
            montantExclu: exclu,
            codeActe: actCode,
            libelleActe: actLibelle,
            actesPayes: l.actesPayes,
            commentaire: l.commentaire,
          });
        }
      });
    });

    return Array.from(groupsMap.values()).sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      switch (groupSortField) {
        case 'dateSoins':
          valA = a.dateSoins || '';
          valB = b.dateSoins || '';
          break;
        case 'nomAgent':
          valA = (a.nomAgent || '').toLowerCase();
          valB = (b.nomAgent || '').toLowerCase();
          break;
        case 'codeActe':
          valA = (a.codeActe || '').toLowerCase();
          valB = (b.codeActe || '').toLowerCase();
          break;
        case 'societe':
          valA = (a.societeNom || '').toLowerCase();
          valB = (b.societeNom || '').toLowerCase();
          break;
        case 'totalReclame':
          valA = a.totalReclame || 0;
          valB = b.totalReclame || 0;
          break;
        case 'totalPaye':
          valA = a.totalPaye || 0;
          valB = b.totalPaye || 0;
          break;
        case 'ticketModerateur':
          valA = a.ticketModerateur || 0;
          valB = b.ticketModerateur || 0;
          break;
        case 'totalExclu':
          valA = a.totalExclu || 0;
          valB = b.totalExclu || 0;
          break;
        case 'nombreLignes':
          valA = a.nombreLignes || 0;
          valB = b.nombreLignes || 0;
          break;
        default:
          valA = a.dateSoins || '';
          valB = b.dateSoins || '';
      }

      if (typeof valA === 'number' && typeof valB === 'number') {
        return groupSortDirection === 'asc' ? valA - valB : valB - valA;
      }

      const comp = String(valA).localeCompare(String(valB));
      return groupSortDirection === 'asc' ? comp : -comp;
    });
  }, [filteredAndSortedPaiements, groupSortField, groupSortDirection, societes]);

  const handleGroupSort = (field: GroupSortField) => {
    if (groupSortField === field) {
      setGroupSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setGroupSortField(field);
      setGroupSortDirection(field.startsWith('total') || field === 'nombreLignes' ? 'desc' : 'asc');
    }
  };

  // Helper to group lines of a single payment by person + date + act
  const groupLinesForSinglePayment = (lines: LignePaiement[], paymentDate: string) => {
    const map = new Map<string, {
      groupKey: string;
      nomAgent: string;
      immatriculation: string;
      dateSoins: string;
      codeActe: string;
      libelleActe: string;
      prestationNumero: string;
      totalReclame: number;
      ticketModerateur: number;
      totalPaye: number;
      montantExclu: number;
      nombreActes: number;
      subLines: LignePaiement[];
    }>();

    (lines || []).forEach(l => {
      const rawNom = (l.nomAgent || l.nomBaseAssurance || 'Assuré').trim();
      const rawDate = (l.dateSoins || paymentDate || '').split('T')[0];
      const actCode = (l.codeActe || (l.actesPayes && l.actesPayes[0]?.code) || 'CONS').toUpperCase().trim();
      const actLib = l.libelleActe || (l.actesPayes && l.actesPayes[0]?.libelle) || actCode;
      const key = `${rawNom.toLowerCase()}|${rawDate}|${actCode.toLowerCase()}`;

      const rec = Number(l.montantReclame || ((l.totalPaye || 0) + (l.ticketModerateur || 0)) || 0);
      const pay = Number(l.montantPaye || l.totalPaye || 0);
      const mod = Number(l.ticketModerateur || 0);
      const exc = Number(l.montantExclu || 0);

      if (!map.has(key)) {
        map.set(key, {
          groupKey: key,
          nomAgent: rawNom,
          immatriculation: l.immatriculation || '-',
          dateSoins: rawDate,
          codeActe: actCode,
          libelleActe: actLib,
          prestationNumero: l.prestationNumero || '-',
          totalReclame: rec,
          ticketModerateur: mod,
          totalPaye: pay,
          montantExclu: exc,
          nombreActes: 1,
          subLines: [l]
        });
      } else {
        const item = map.get(key)!;
        item.totalReclame += rec;
        item.ticketModerateur += mod;
        item.totalPaye += pay;
        item.montantExclu += exc;
        item.nombreActes += 1;
        item.subLines.push(l);
      }
    });

    return Array.from(map.values());
  };

  // Aggregate statistics for the filtered dataset
  const stats = useMemo(() => {
    const totalReclame = filteredAndSortedPaiements.reduce((sum, p) => sum + (p.totalReclame || 0), 0);
    const totalPaye = filteredAndSortedPaiements.reduce((sum, p) => sum + (p.totalPaye || 0), 0);
    const totalModerateur = filteredAndSortedPaiements.reduce((sum, p) => sum + (p.totalModerateur || 0), 0);
    const totalExclu = filteredAndSortedPaiements.reduce((sum, p) => sum + (p.totalExclu || 0), 0);
    const count = filteredAndSortedPaiements.length;
    const tauxCouverture = totalReclame > 0 ? Math.round((totalPaye / totalReclame) * 100) : 100;

    return {
      count,
      totalReclame,
      totalPaye,
      totalModerateur,
      totalExclu,
      tauxCouverture,
    };
  }, [filteredAndSortedPaiements]);

  // Form State for Saisie de Paiement
  const [targetSocieteId, setTargetSocieteId] = useState<string>(
    selectedSocieteId !== 'ALL' ? selectedSocieteId : societes[0]?.id || ''
  );
  const [bordereauRef, setBordereauRef] = useState<string>('');
  const [datePaiementInput, setDatePaiementInput] = useState<string>(new Date().toISOString().split('T')[0]);
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

  const handleOpenCreateModal = () => {
    const socId = selectedSocieteId !== 'ALL' ? selectedSocieteId : societes[0]?.id || '';
    setTargetSocieteId(socId);
    setBordereauRef(`BORD-${new Date().getFullYear()}-${String(paiements.length + 1).padStart(3, '0')}`);
    setDatePaiementInput(new Date().toISOString().split('T')[0]);
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
    const newLignesPaiement: LignePaiement[] = selectedStaged.map(s => {
      const prest = prestations.find(p => p.id === s.prestationId);
      const paidVal = Number(s.totalPaye || 0);
      const modVal = Number(s.ticketModerateur || 0);
      const exclVal = Number(s.montantExclu || 0);
      const reclameVal = s.resteAPayer + s.dejaPaye || s.montantFacture;
      return {
        id: generateId('lp'),
        paiementId: newPaiementId,
        lignePrestationId: s.lignePrestationId,
        prestationId: s.prestationId,
        prestationNumero: s.factureNum,
        dateSoins: prest?.date,
        immatriculation: s.matricule,
        nomBaseAssurance: s.personneNom,
        nomAgent: s.personneNom || prest?.nomAgent,
        totalPaye: paidVal,
        montantPaye: paidVal,
        ticketModerateur: modVal,
        montantExclu: exclVal,
        montantReclame: reclameVal,
        actesPayes: [{ code: s.codeActe, libelle: s.libelleActe, montant: paidVal }],
        commentaire: s.commentaire,
      };
    });

    const nouveauPaiement: Paiement = {
      id: newPaiementId,
      numeroBordereau: bordereauRef,
      datePaiement: datePaiementInput,
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

    // Update prestation lines and calculate new statuses (support multi-règlements sur une même prescription)
    const updatedPrestations = prestations.map(p => {
      const relatedPaidLines = newLignesPaiement.filter(lp => lp.prestationId === p.id);
      if (relatedPaidLines.length === 0) return p;

      const updatedLignes = p.lignes.map(l => {
        const foundPaid = relatedPaidLines.find(lp => lp.lignePrestationId === l.id);
        if (foundPaid) {
          const newActTotalPaye = (l.totalPaye || 0) + foundPaid.totalPaye;
          const actTarget = l.montantARembourser ?? (l.totalPrestation - (l.ticketModerateur || 0));
          return {
            ...l,
            totalPaye: newActTotalPaye,
            statut: newActTotalPaye >= actTarget ? ('Payé' as const) : newActTotalPaye > 0 ? ('Partiellement payé' as const) : ('En attente' as const),
          };
        }
        return l;
      });

      const totalPrestationVal = p.montantTotal ?? p.totalPrestation;
      const partVal = p.ticketModerateur ?? p.participation;
      const netTarget = p.montantARembourser ?? (totalPrestationVal - partVal);
      const totalPaidAll = updatedLignes.reduce((sum, l) => sum + (l.totalPaye || 0), 0);
      const isFullyPaid = totalPaidAll >= netTarget;
      const isPartiallyPaid = totalPaidAll > 0 && !isFullyPaid;

      return {
        ...p,
        totalPaye: totalPaidAll,
        resteAPayer: Math.max(0, netTarget - totalPaidAll),
        lignes: updatedLignes,
        statut: isFullyPaid ? ('Payé' as const) : isPartiallyPaid ? ('Partiellement payé' as const) : ('En attente' as const),
      };
    });

    onSavePaiement(nouveauPaiement, updatedPrestations);
    setIsCreateModalOpen(false);
  };

  const handleExportExcel = () => {
    if (viewMode === 'groupes_actes') {
      const rows = groupedPaymentActs.map(g => ({
        'Patient / Assuré': g.nomAgent,
        'Matricule': g.immatriculation,
        'Date Soins': g.dateSoins,
        'Code Acte': g.codeActe,
        'Libellé Acte': g.libelleActe,
        'Société Assureur': g.societeNom,
        'N° Bordereaux Associés': g.bordereaux.map(b => b.numeroBordereau).join(', '),
        'Réf Prescriptions': g.prestationsNumeros.join(', '),
        'Nb Lignes / Règlements': g.nombreLignes,
        'Total Réclamé (Brut)': g.totalReclame,
        'Total Réglé (Payé Net)': g.totalPaye,
        'Ticket Modérateur': g.ticketModerateur,
        'Total Exclusions': g.totalExclu,
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Paiements_Groupes_Actes');
      XLSX.writeFile(workbook, `Paiements_Groupes_Patient_Date_Actes_${new Date().toISOString().split('T')[0]}.xlsx`);
      return;
    }

    const rows = filteredAndSortedPaiements.map(p => {
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

  const renderSortIcon = (field: PaiementSortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-emerald-600 font-bold ml-1" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-emerald-600 font-bold ml-1" />
    );
  };

  const renderGroupSortIcon = (field: GroupSortField) => {
    if (groupSortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />;
    }
    return groupSortDirection === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-emerald-600 font-bold ml-1" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-emerald-600 font-bold ml-1" />
    );
  };

  return (
    <div id="paiements-view" className="space-y-5">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Saisie & Règlements d'Assurance</h2>
          <p className="text-xs text-slate-500">
            Bordereaux de paiements, lettrage des prescriptions et regroupement des soins par assuré, date et mêmes actes
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              id="tab-view-bordereaux"
              type="button"
              onClick={() => setViewMode('bordereaux')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                viewMode === 'bordereaux'
                  ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Receipt className="w-3.5 h-3.5 text-emerald-600" />
              <span>Vue par Bordereau ({filteredAndSortedPaiements.length})</span>
            </button>
            <button
              id="tab-view-groupes"
              type="button"
              onClick={() => setViewMode('groupes_actes')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                viewMode === 'groupes_actes'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Regroupé par Patient + Date + Actes ({groupedPaymentActs.length})</span>
            </button>
          </div>

          <button
            id="btn-import-decompte"
            onClick={() => setIsDecompteModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 shadow-xs transition cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Importer Décompte</span>
          </button>

          <button
            id="btn-export-paiements-xlsx"
            onClick={handleExportExcel}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Exporter {viewMode === 'groupes_actes' ? 'Actes Groupés' : 'Bordereaux'} Excel</span>
          </button>

          <button
            id="btn-new-paiement"
            onClick={handleOpenCreateModal}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau Règlement</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Bordereaux</div>
          <div className="text-lg font-bold text-slate-900 mt-0.5">{stats.count}</div>
          <div className="text-[10px] text-slate-400">règlements listés</div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Total Réclamé</div>
          <div className="text-sm font-bold text-slate-900 mt-0.5 truncate">{formatMoney(stats.totalReclame)}</div>
          <div className="text-[10px] text-slate-400">émis aux assureurs</div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-emerald-200/80 bg-emerald-50/20 shadow-xs">
          <div className="text-[11px] font-medium text-emerald-700 uppercase tracking-wider">Total Réglé</div>
          <div className="text-sm font-bold text-emerald-700 mt-0.5 truncate">{formatMoney(stats.totalPaye)}</div>
          <div className="text-[10px] text-emerald-600">virement & chèques</div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-amber-200/70 bg-amber-50/20 shadow-xs">
          <div className="text-[11px] font-medium text-amber-700 uppercase tracking-wider">Ticket Modérateur</div>
          <div className="text-sm font-bold text-amber-800 mt-0.5 truncate">{formatMoney(stats.totalModerateur)}</div>
          <div className="text-[10px] text-amber-600">part affilié</div>
        </div>

        <div className={`bg-white p-3 rounded-xl border shadow-xs ${stats.totalExclu > 0 ? 'border-rose-200 bg-rose-50/20' : 'border-slate-200'}`}>
          <div className={`text-[11px] font-medium uppercase tracking-wider ${stats.totalExclu > 0 ? 'text-rose-700' : 'text-slate-500'}`}>
            Exclusions / Rejets
          </div>
          <div className={`text-sm font-bold mt-0.5 truncate ${stats.totalExclu > 0 ? 'text-rose-700' : 'text-slate-700'}`}>
            {formatMoney(stats.totalExclu)}
          </div>
          <div className={`text-[10px] ${stats.totalExclu > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
            {stats.totalExclu > 0 ? 'hors couverture' : 'aucun rejet'}
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-indigo-200/70 bg-indigo-50/20 shadow-xs">
          <div className="text-[11px] font-medium text-indigo-700 uppercase tracking-wider">Couverture</div>
          <div className="text-lg font-bold text-indigo-800 mt-0.5">{stats.tauxCouverture}%</div>
          <div className="text-[10px] text-indigo-600">taux d'encaissement</div>
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
              placeholder="Recherche par n° bordereau, référence paiement, assuré, acte, matricule..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 focus:bg-white transition"
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

          {/* Quick Mode Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-400 font-medium mr-1 hidden sm:inline">Mode :</span>
            {[
              { key: 'ALL', label: 'Tous' },
              { key: 'Virement bancaire', label: 'Virement' },
              { key: 'Chèque', label: 'Chèque' },
              { key: 'Mobile Money', label: 'Mobile' },
              { key: 'Espèces', label: 'Espèces' }
            ].map(m => (
              <button
                key={m.key}
                onClick={() => setFilterMode(m.key)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                  filterMode === m.key
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Filter Controls Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAdvancedFilters(prev => !prev)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                showAdvancedFilters || activeFiltersCount > 0
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 font-semibold'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-600" />
              <span>Filtres avancés</span>
              {activeFiltersCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-emerald-600 text-white font-bold">
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
                className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="ALL">Toutes les sociétés</option>
                {societes.map(s => (
                  <option key={s.id} value={s.id}>{s.nom}</option>
                ))}
              </select>
            </div>

            {/* Statut Bordereau */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Statut du bordereau
              </label>
              <select
                value={filterStatut}
                onChange={(e) => setFilterStatut(e.target.value)}
                className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="ALL">Tous les statuts</option>
                <option value="Validé">Validé</option>
                <option value="En attente">En attente</option>
                <option value="Partiel">Partiel</option>
                <option value="Rejeté">Rejeté</option>
              </select>
            </div>

            {/* Exclusion Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Exclusions & Rejets
              </label>
              <select
                value={filterExclusion}
                onChange={(e) => setFilterExclusion(e.target.value as any)}
                className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="ALL">Tous les bordereaux</option>
                <option value="AVEC_EXCLUSION">Avec exclusions (&gt; 0)</option>
                <option value="SANS_EXCLUSION">Sans exclusion (100% admis)</option>
              </select>
            </div>

            {/* Date Range & Presets */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Date de règlement
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={dateDebut}
                  onChange={(e) => setDateDebut(e.target.value)}
                  className="w-1/2 text-xs py-1 px-1.5 rounded-md border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  title="Date début"
                />
                <span className="text-slate-400 text-xs">-</span>
                <input
                  type="date"
                  value={dateFin}
                  onChange={(e) => setDateFin(e.target.value)}
                  className="w-1/2 text-xs py-1 px-1.5 rounded-md border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  title="Date fin"
                />
              </div>
              {/* Quick presets */}
              <div className="flex items-center gap-1 mt-1.5">
                <button
                  type="button"
                  onClick={() => setDatePreset('this_month')}
                  className="text-[10px] text-emerald-600 hover:text-emerald-800 hover:underline cursor-pointer"
                >
                  Ce mois
                </button>
                <span className="text-slate-300 text-[10px]">|</span>
                <button
                  type="button"
                  onClick={() => setDatePreset('last_month')}
                  className="text-[10px] text-emerald-600 hover:text-emerald-800 hover:underline cursor-pointer"
                >
                  Mois dernier
                </button>
                <span className="text-slate-300 text-[10px]">|</span>
                <button
                  type="button"
                  onClick={() => setDatePreset('this_year')}
                  className="text-[10px] text-emerald-600 hover:text-emerald-800 hover:underline cursor-pointer"
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

      {/* Paiements Table / Grouped Table based on viewMode */}
      {viewMode === 'bordereaux' ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 uppercase text-[11px] font-semibold border-b border-slate-200 select-none">
                <tr>
                  <th className="py-3 px-2 w-8"></th>
                  
                  {/* Date Règlement */}
                  <th 
                    onClick={() => handleSort('datePaiement')}
                    className={`py-3 px-3 cursor-pointer group hover:bg-slate-100/80 transition ${sortField === 'datePaiement' ? 'bg-emerald-50/60 text-emerald-900 font-bold' : ''}`}
                  >
                    <div className="flex items-center">
                      <span>Date Règlement</span>
                      {renderSortIcon('datePaiement')}
                    </div>
                  </th>

                  {/* N° Bordereau */}
                  <th 
                    onClick={() => handleSort('numeroBordereau')}
                    className={`py-3 px-3 cursor-pointer group hover:bg-slate-100/80 transition ${sortField === 'numeroBordereau' ? 'bg-emerald-50/60 text-emerald-900 font-bold' : ''}`}
                  >
                    <div className="flex items-center">
                      <span>N° Bordereau</span>
                      {renderSortIcon('numeroBordereau')}
                    </div>
                  </th>

                  {/* Société Assureur */}
                  <th 
                    onClick={() => handleSort('societe')}
                    className={`py-3 px-3 cursor-pointer group hover:bg-slate-100/80 transition ${sortField === 'societe' ? 'bg-emerald-50/60 text-emerald-900 font-bold' : ''}`}
                  >
                    <div className="flex items-center">
                      <span>Société Assureur</span>
                      {renderSortIcon('societe')}
                    </div>
                  </th>

                  {/* Mode & Référence */}
                  <th 
                    onClick={() => handleSort('modePaiement')}
                    className={`py-3 px-3 cursor-pointer group hover:bg-slate-100/80 transition ${sortField === 'modePaiement' ? 'bg-emerald-50/60 text-emerald-900 font-bold' : ''}`}
                  >
                    <div className="flex items-center">
                      <span>Mode & Référence</span>
                      {renderSortIcon('modePaiement')}
                    </div>
                  </th>

                  {/* Total Réclamé */}
                  <th 
                    onClick={() => handleSort('totalReclame')}
                    className={`py-3 px-3 text-right cursor-pointer group hover:bg-slate-100/80 transition ${sortField === 'totalReclame' ? 'bg-emerald-50/60 text-emerald-900 font-bold' : ''}`}
                  >
                    <div className="flex items-center justify-end">
                      <span>Total Réclamé</span>
                      {renderSortIcon('totalReclame')}
                    </div>
                  </th>

                  {/* Somme Payée */}
                  <th 
                    onClick={() => handleSort('totalPaye')}
                    className={`py-3 px-3 text-right cursor-pointer group hover:bg-slate-100/80 transition ${sortField === 'totalPaye' ? 'bg-emerald-50/60 text-emerald-900 font-bold' : ''}`}
                  >
                    <div className="flex items-center justify-end">
                      <span>Somme Payée</span>
                      {renderSortIcon('totalPaye')}
                    </div>
                  </th>

                  {/* Ticket Modérateur */}
                  <th 
                    onClick={() => handleSort('totalModerateur')}
                    className={`py-3 px-3 text-right cursor-pointer group hover:bg-slate-100/80 transition ${sortField === 'totalModerateur' ? 'bg-emerald-50/60 text-emerald-900 font-bold' : ''}`}
                  >
                    <div className="flex items-center justify-end">
                      <span>Ticket Mod.</span>
                      {renderSortIcon('totalModerateur')}
                    </div>
                  </th>

                  {/* Exclu / Rejet */}
                  <th 
                    onClick={() => handleSort('totalExclu')}
                    className={`py-3 px-3 text-right cursor-pointer group hover:bg-slate-100/80 transition ${sortField === 'totalExclu' ? 'bg-emerald-50/60 text-emerald-900 font-bold' : ''}`}
                  >
                    <div className="flex items-center justify-end">
                      <span>Exclu / Rejet</span>
                      {renderSortIcon('totalExclu')}
                    </div>
                  </th>

                  {/* Statut */}
                  <th 
                    onClick={() => handleSort('statut')}
                    className={`py-3 px-3 text-center cursor-pointer group hover:bg-slate-100/80 transition ${sortField === 'statut' ? 'bg-emerald-50/60 text-emerald-900 font-bold' : ''}`}
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
                {filteredAndSortedPaiements.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-10 text-center text-slate-400 space-y-2">
                      <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
                      <div>Aucun bordereau de règlement ne correspond aux critères sélectionnés.</div>
                      {activeFiltersCount > 0 && (
                        <button
                          onClick={handleResetFilters}
                          className="text-xs text-emerald-600 hover:underline font-medium"
                        >
                          Réinitialiser tous les filtres
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedPaiements.map(p => {
                    const isExpanded = !!expandedRows[p.id];
                    const recInfo = getPaiementReconciliationInfo(p);
                    const groupedPaymentLines = groupLinesForSinglePayment(p.lignes, p.datePaiement);

                    // Tooltip text for reconciliation
                    const matchTooltip = recInfo.hasMatch
                      ? `Même date et montant qu'une prestation (${recInfo.matchingPrestations.map(m => `Facture ${m.numeroFacture} : ${formatMoney(m.montantBrut)}`).join(', ')})`
                      : undefined;
                    const duplicateTooltip = recInfo.hasDuplicate
                      ? `Attention : ${recInfo.duplicatePayments.length} autre(s) bordereau(x) avec la même date (${formatDate(p.datePaiement)}) et le même montant (${formatMoney(p.totalPaye)}) : ${recInfo.duplicatePayments.map(d => d.numeroBordereau).join(', ')}`
                      : undefined;

                    return (
                      <React.Fragment key={p.id}>
                        <tr className={`transition hover:bg-slate-50/80 ${
                          recInfo.hasMatch ? 'bg-emerald-50/20' : recInfo.hasDuplicate ? 'bg-amber-50/20' : ''
                        }`}>
                          <td className="py-3 px-2 text-center">
                            <button
                              onClick={() => toggleRow(p.id)}
                              className="p-1 text-slate-400 hover:text-emerald-600 transition cursor-pointer"
                              title="Afficher les lignes et actes réglés"
                            >
                              {isExpanded ? <ChevronDown className="w-4 h-4 text-emerald-600 font-bold" /> : <ChevronRight className="w-4 h-4" />}
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
                                {formatDate(p.datePaiement)}
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
                          <td className="py-3 px-3 font-bold text-emerald-700 whitespace-nowrap">{p.numeroBordereau}</td>
                          <td className="py-3 px-3 font-medium text-slate-900">{getSocieteNom(p.societeId)}</td>
                          <td className="py-3 px-3">
                            <div className="text-slate-800 font-medium">{p.modePaiement}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{p.referencePaiement}</div>
                          </td>
                          <td className="py-3 px-3 text-right text-slate-600 whitespace-nowrap">{formatMoney(p.totalReclame)}</td>
                          <td className="py-3 px-3 text-right font-bold text-emerald-700 whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              <span className={
                                recInfo.hasMatch 
                                  ? 'border-b-2 border-dashed border-emerald-500 text-emerald-900' 
                                  : recInfo.hasDuplicate 
                                  ? 'border-b-2 border-dashed border-amber-500 text-amber-900' 
                                  : ''
                              } title={matchTooltip || duplicateTooltip}>
                                {formatMoney(p.totalPaye)}
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
                          <td className="py-3 px-3 text-right text-amber-700 font-medium whitespace-nowrap">{formatMoney(p.totalModerateur)}</td>
                          <td className="py-3 px-3 text-right text-rose-600 font-medium whitespace-nowrap">{formatMoney(p.totalExclu)}</td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              {p.statut}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end space-x-1">
                              <button
                                onClick={() => setViewingPaiement(p)}
                                title="Visualiser le bordereau"
                                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
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
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Nested Expandable Sub-Table of Payment Lines */}
                        {isExpanded && (
                          <tr className="bg-slate-50/90 border-y border-slate-200/80">
                            <td colSpan={11} className="p-4 pl-10">
                              <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-xs space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                      <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                                      <span>Lignes Règlement du Bordereau ({p.lignes.length} soins)</span>
                                    </span>
                                    <span className="text-xs text-slate-400 font-mono">| {formatDate(p.datePaiement)}</span>
                                  </div>

                                  {/* Sub-table grouping toggle */}
                                  <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-md text-[11px]">
                                    <Layers className="w-3 h-3 text-emerald-600" />
                                    <label className="text-slate-700 font-medium flex items-center gap-1 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={groupLinesInBordereau}
                                        onChange={(e) => setGroupLinesInBordereau(e.target.checked)}
                                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-3 h-3 cursor-pointer"
                                      />
                                      <span>Regrouper (même personne, date et même acte)</span>
                                    </label>
                                  </div>
                                </div>

                                {groupLinesInBordereau ? (
                                  /* Grouped sub-lines */
                                  <table className="w-full text-xs">
                                    <thead className="text-[10px] text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                                      <tr>
                                        <th className="py-2 px-2 text-left">Date Soins</th>
                                        <th className="py-2 px-2 text-left">Patient / Assuré</th>
                                        <th className="py-2 px-2 text-left">Matricule</th>
                                        <th className="py-2 px-2 text-left">Acte Regroupé</th>
                                        <th className="py-2 px-2 text-center">Nb Actes</th>
                                        <th className="py-2 px-2 text-right">Total Réclamé</th>
                                        <th className="py-2 px-2 text-right">Ticket Modérateur</th>
                                        <th className="py-2 px-2 text-right">Somme Payée (Net)</th>
                                        <th className="py-2 px-2 text-right">Exclusions</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {groupedPaymentLines.map((grp) => (
                                        <tr key={grp.groupKey} className="hover:bg-slate-50">
                                          <td className="py-2 px-2 text-slate-600 font-medium">
                                            {formatDate(grp.dateSoins)}
                                          </td>
                                          <td className="py-2 px-2 font-semibold text-slate-900">
                                            {grp.nomAgent}
                                          </td>
                                          <td className="py-2 px-2 font-mono text-[11px] text-slate-600">
                                            {grp.immatriculation}
                                          </td>
                                          <td className="py-2 px-2">
                                            <div className="flex items-center gap-1.5">
                                              <span className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold">
                                                {grp.codeActe}
                                              </span>
                                              <span className="text-slate-700 font-medium">{grp.libelleActe}</span>
                                            </div>
                                          </td>
                                          <td className="py-2 px-2 text-center">
                                            <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px]">
                                              {grp.nombreActes}
                                            </span>
                                          </td>
                                          <td className="py-2 px-2 text-right font-medium text-slate-900">
                                            {formatMoney(grp.totalReclame)}
                                          </td>
                                          <td className="py-2 px-2 text-right text-amber-700 font-medium">
                                            {formatMoney(grp.ticketModerateur)}
                                          </td>
                                          <td className="py-2 px-2 text-right font-bold text-emerald-700">
                                            {formatMoney(grp.totalPaye)}
                                          </td>
                                          <td className="py-2 px-2 text-right text-rose-600 font-medium">
                                            {formatMoney(grp.montantExclu)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                ) : (
                                  /* Raw individual lines */
                                  <table className="w-full text-xs">
                                    <thead className="text-[10px] text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                                      <tr>
                                        <th className="py-2 px-2 text-left">Date Soins</th>
                                        <th className="py-2 px-2 text-left">Nom de l'Agent (Prescription)</th>
                                        <th className="py-2 px-2 text-left">Matricule</th>
                                        <th className="py-2 px-2 text-left">Réf Prescription</th>
                                        <th className="py-2 px-2 text-left min-w-[180px]">Actes Payés & Montants</th>
                                        <th className="py-2 px-2 text-right">Montant à Payer</th>
                                        <th className="py-2 px-2 text-right">Ticket Modérateur</th>
                                        <th className="py-2 px-2 text-right">Somme Payée</th>
                                        <th className="py-2 px-2 text-right">Exclusions</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {p.lignes.map((l) => {
                                        const lMatch = getLignePaiementMatchInfo(l, p);
                                        const lMatchTooltip = lMatch.hasMatch 
                                          ? `Concordance Prescription : Facture ${lMatch.matchedPrescription?.numeroFacture} (Date: ${formatDate(lMatch.matchedPrescription?.date || '')}, Montant: ${formatMoney(lMatch.matchedPrescription?.montantBrut || 0)})`
                                          : undefined;

                                        return (
                                          <tr key={l.id} className={`hover:bg-slate-50 ${lMatch.hasMatch ? 'bg-emerald-50/30' : ''}`}>
                                            <td className="py-2 px-2 text-slate-600 font-medium">
                                              <div className="flex items-center gap-1">
                                                <span className={lMatch.hasMatch ? 'border-b-2 border-dashed border-emerald-500 text-emerald-900 font-bold' : ''} title={lMatchTooltip}>
                                                  {l.dateSoins ? formatDate(l.dateSoins) : '-'}
                                                </span>
                                                {lMatch.hasMatch && (
                                                  <span title={lMatchTooltip} className="inline-flex items-center text-emerald-600">
                                                    <Sparkles className="w-3 h-3" />
                                                  </span>
                                                )}
                                              </div>
                                            </td>
                                            <td className="py-2 px-2 font-semibold text-slate-900">
                                              {l.nomAgent || l.nomBaseAssurance}
                                            </td>
                                            <td className="py-2 px-2 font-mono text-[11px] text-slate-600">
                                              {l.immatriculation || '-'}
                                            </td>
                                            <td className="py-2 px-2 font-mono font-bold text-indigo-700">
                                              {l.prestationNumero || '-'}
                                            </td>
                                            <td className="py-2 px-2">
                                              {l.actesPayes && l.actesPayes.length > 0 ? (
                                                <div className="flex flex-wrap gap-1">
                                                  {l.actesPayes.map((a, actIdx) => (
                                                    <span key={actIdx} className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-medium">
                                                      <span className="font-bold">{a.code}</span>
                                                      <span>: {formatMoney(a.montant)}</span>
                                                    </span>
                                                  ))}
                                                </div>
                                              ) : (
                                                <span className="text-slate-500 text-[11px]">{l.commentaire || 'Soins réglés'}</span>
                                              )}
                                            </td>
                                            <td className="py-2 px-2 text-right font-medium text-slate-900">
                                              <span className={lMatch.hasMatch ? 'border-b-2 border-dashed border-emerald-500 text-emerald-900 font-bold' : ''} title={lMatchTooltip}>
                                                {formatMoney(l.montantReclame || l.totalPaye + (l.ticketModerateur || 0))}
                                              </span>
                                            </td>
                                            <td className="py-2 px-2 text-right text-amber-700 font-medium">
                                              {formatMoney(l.ticketModerateur || 0)}
                                            </td>
                                            <td className="py-2 px-2 text-right font-bold text-emerald-700">
                                              {formatMoney(l.montantPaye || l.totalPaye)}
                                            </td>
                                            <td className="py-2 px-2 text-right text-rose-600 font-medium">
                                              {formatMoney(l.montantExclu || 0)}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                )}
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
      ) : (
        /* Grouped View: Regroupé par Personne + Date + Mêmes Actes */
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="bg-emerald-50/50 px-4 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs">
              <Layers className="w-4 h-4 text-emerald-700" />
              <span className="font-bold text-slate-900">Synthèse Groupée par Patient, Date de Soin et Mêmes Actes</span>
              <span className="text-slate-400">({groupedPaymentActs.length} groupes cumulés)</span>
            </div>
            <span className="text-[11px] text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-full font-medium">
              Agrégation multi-bordereaux automatique
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 uppercase text-[11px] font-semibold border-b border-slate-200 select-none">
                <tr>
                  <th className="py-3 px-2 w-8"></th>

                  {/* Date Soins */}
                  <th
                    onClick={() => handleGroupSort('dateSoins')}
                    className={`py-3 px-3 cursor-pointer group hover:bg-slate-100/80 transition ${groupSortField === 'dateSoins' ? 'bg-emerald-50/60 text-emerald-900 font-bold' : ''}`}
                  >
                    <div className="flex items-center">
                      <span>Date Soins</span>
                      {renderGroupSortIcon('dateSoins')}
                    </div>
                  </th>

                  {/* Patient / Assuré */}
                  <th
                    onClick={() => handleGroupSort('nomAgent')}
                    className={`py-3 px-3 cursor-pointer group hover:bg-slate-100/80 transition ${groupSortField === 'nomAgent' ? 'bg-emerald-50/60 text-emerald-900 font-bold' : ''}`}
                  >
                    <div className="flex items-center">
                      <span>Patient / Assuré</span>
                      {renderGroupSortIcon('nomAgent')}
                    </div>
                  </th>

                  {/* Acte / Prestation */}
                  <th
                    onClick={() => handleGroupSort('codeActe')}
                    className={`py-3 px-3 cursor-pointer group hover:bg-slate-100/80 transition ${groupSortField === 'codeActe' ? 'bg-emerald-50/60 text-emerald-900 font-bold' : ''}`}
                  >
                    <div className="flex items-center">
                      <span>Acte Médical</span>
                      {renderGroupSortIcon('codeActe')}
                    </div>
                  </th>

                  {/* Société */}
                  <th
                    onClick={() => handleGroupSort('societe')}
                    className={`py-3 px-3 cursor-pointer group hover:bg-slate-100/80 transition ${groupSortField === 'societe' ? 'bg-emerald-50/60 text-emerald-900 font-bold' : ''}`}
                  >
                    <div className="flex items-center">
                      <span>Assureur</span>
                      {renderGroupSortIcon('societe')}
                    </div>
                  </th>

                  {/* Bordereau(x) */}
                  <th className="py-3 px-3">Bordereau(x)</th>

                  {/* Nb Règlements */}
                  <th
                    onClick={() => handleGroupSort('nombreLignes')}
                    className={`py-3 px-2 text-center cursor-pointer group hover:bg-slate-100/80 transition ${groupSortField === 'nombreLignes' ? 'bg-emerald-50/60 text-emerald-900 font-bold' : ''}`}
                  >
                    <div className="flex items-center justify-center">
                      <span>Nb Règl.</span>
                      {renderGroupSortIcon('nombreLignes')}
                    </div>
                  </th>

                  {/* Total Réclamé */}
                  <th
                    onClick={() => handleGroupSort('totalReclame')}
                    className={`py-3 px-3 text-right cursor-pointer group hover:bg-slate-100/80 transition ${groupSortField === 'totalReclame' ? 'bg-emerald-50/60 text-emerald-900 font-bold' : ''}`}
                  >
                    <div className="flex items-center justify-end">
                      <span>Total Réclamé</span>
                      {renderGroupSortIcon('totalReclame')}
                    </div>
                  </th>

                  {/* Ticket Modérateur */}
                  <th
                    onClick={() => handleGroupSort('ticketModerateur')}
                    className={`py-3 px-3 text-right cursor-pointer group hover:bg-slate-100/80 transition ${groupSortField === 'ticketModerateur' ? 'bg-emerald-50/60 text-emerald-900 font-bold' : ''}`}
                  >
                    <div className="flex items-center justify-end">
                      <span>Ticket Mod.</span>
                      {renderGroupSortIcon('ticketModerateur')}
                    </div>
                  </th>

                  {/* Somme Payée (Net) */}
                  <th
                    onClick={() => handleGroupSort('totalPaye')}
                    className={`py-3 px-3 text-right cursor-pointer group hover:bg-slate-100/80 transition ${groupSortField === 'totalPaye' ? 'bg-emerald-50/60 text-emerald-900 font-bold' : ''}`}
                  >
                    <div className="flex items-center justify-end">
                      <span>Somme Payée</span>
                      {renderGroupSortIcon('totalPaye')}
                    </div>
                  </th>

                  {/* Total Exclu */}
                  <th
                    onClick={() => handleGroupSort('totalExclu')}
                    className={`py-3 px-3 text-right cursor-pointer group hover:bg-slate-100/80 transition ${groupSortField === 'totalExclu' ? 'bg-emerald-50/60 text-emerald-900 font-bold' : ''}`}
                  >
                    <div className="flex items-center justify-end">
                      <span>Exclusions</span>
                      {renderGroupSortIcon('totalExclu')}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {groupedPaymentActs.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-10 text-center text-slate-400 space-y-2">
                      <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
                      <div>Aucun acte regroupé ne correspond aux critères sélectionnés.</div>
                      {activeFiltersCount > 0 && (
                        <button
                          onClick={handleResetFilters}
                          className="text-xs text-emerald-600 hover:underline font-medium"
                        >
                          Réinitialiser tous les filtres
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  groupedPaymentActs.map((grp) => {
                    const isGroupExpanded = !!expandedGroupRows[grp.groupKey];

                    return (
                      <React.Fragment key={grp.groupKey}>
                        <tr className={`transition hover:bg-slate-50/80 ${isGroupExpanded ? 'bg-emerald-50/20 font-medium' : ''}`}>
                          <td className="py-3 px-2 text-center">
                            <button
                              onClick={() => toggleGroupRow(grp.groupKey)}
                              className="p-1 text-slate-400 hover:text-emerald-600 transition cursor-pointer"
                              title="Afficher les règlements rattachés à ce groupe"
                            >
                              {isGroupExpanded ? <ChevronDown className="w-4 h-4 text-emerald-600 font-bold" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                          </td>
                          <td className="py-3 px-3 text-slate-700 font-semibold whitespace-nowrap">
                            {formatDate(grp.dateSoins)}
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900">{grp.nomAgent}</div>
                            {grp.immatriculation && grp.immatriculation !== '-' && (
                              <div className="text-[10px] text-slate-400 font-mono">{grp.immatriculation}</div>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5">
                              <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-200 text-[10px] font-bold">
                                {grp.codeActe}
                              </span>
                              <span className="font-semibold text-slate-800">{grp.libelleActe}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-slate-700 font-medium">{grp.societeNom}</td>
                          <td className="py-3 px-3">
                            <div className="flex flex-wrap gap-1">
                              {grp.bordereaux.map((b) => (
                                <span
                                  key={b.paiementId}
                                  className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 text-[10px] font-mono font-medium"
                                  title={`Règlement du ${formatDate(b.datePaiement)} via ${b.modePaiement}`}
                                >
                                  {b.numeroBordereau}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-2 text-center">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                              {grp.nombreLignes}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right text-slate-600 font-medium whitespace-nowrap">
                            {formatMoney(grp.totalReclame)}
                          </td>
                          <td className="py-3 px-3 text-right text-amber-700 font-medium whitespace-nowrap">
                            {formatMoney(grp.ticketModerateur)}
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-emerald-700 whitespace-nowrap">
                            {formatMoney(grp.totalPaye)}
                          </td>
                          <td className="py-3 px-3 text-right text-rose-600 font-medium whitespace-nowrap">
                            {formatMoney(grp.totalExclu)}
                          </td>
                        </tr>

                        {/* Nested Sub-Table for Grouped Row */}
                        {isGroupExpanded && (
                          <tr className="bg-slate-50/90 border-y border-slate-200/80">
                            <td colSpan={11} className="p-4 pl-10">
                              <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-xs space-y-2">
                                <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between border-b border-slate-100 pb-2">
                                  <span className="flex items-center gap-1.5 text-emerald-700">
                                    <Boxes className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Détail des {grp.lignes.length} règlements cumulés pour {grp.nomAgent} - Acte {grp.codeActe}</span>
                                  </span>
                                  <span className="text-slate-400 font-mono text-[11px]">Soins du {formatDate(grp.dateSoins)}</span>
                                </div>

                                <table className="w-full text-xs">
                                  <thead className="text-[10px] text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                                    <tr>
                                      <th className="py-2 px-2 text-left">N° Bordereau</th>
                                      <th className="py-2 px-2 text-left">Date Règlement</th>
                                      <th className="py-2 px-2 text-left">Réf Prescription</th>
                                      <th className="py-2 px-2 text-left">Détail Acte / Commentaire</th>
                                      <th className="py-2 px-2 text-right">Montant Réclamé</th>
                                      <th className="py-2 px-2 text-right">Ticket Mod.</th>
                                      <th className="py-2 px-2 text-right">Somme Payée</th>
                                      <th className="py-2 px-2 text-right">Exclusion</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {grp.lignes.map((sub, sIdx) => (
                                      <tr key={`${sub.ligneId}_${sIdx}`} className="hover:bg-slate-50">
                                        <td className="py-2 px-2 font-bold font-mono text-emerald-700">
                                          {sub.numeroBordereau}
                                        </td>
                                        <td className="py-2 px-2 text-slate-600">
                                          {formatDate(sub.datePaiement)}
                                        </td>
                                        <td className="py-2 px-2 font-mono font-bold text-indigo-700">
                                          {sub.prestationNumero || '-'}
                                        </td>
                                        <td className="py-2 px-2 text-slate-600">
                                          {sub.commentaire || `${sub.libelleActe || sub.codeActe}`}
                                        </td>
                                        <td className="py-2 px-2 text-right text-slate-800 font-medium">
                                          {formatMoney(sub.montantReclame)}
                                        </td>
                                        <td className="py-2 px-2 text-right text-amber-700 font-medium">
                                          {formatMoney(sub.ticketModerateur)}
                                        </td>
                                        <td className="py-2 px-2 text-right font-bold text-emerald-700">
                                          {formatMoney(sub.totalPaye)}
                                        </td>
                                        <td className="py-2 px-2 text-right text-rose-600 font-medium">
                                          {formatMoney(sub.montantExclu)}
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
      )}

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
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Lignes & Prestations Réglées ({viewingPaiement.lignes.length} actes)</h4>
                <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                  <Layers className="w-3 h-3 text-emerald-600" />
                  <label className="text-slate-700 font-medium flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={groupLinesInBordereau}
                      onChange={(e) => setGroupLinesInBordereau(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-3 h-3 cursor-pointer"
                    />
                    <span>Regrouper (même personne, date et acte)</span>
                  </label>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                {groupLinesInBordereau ? (
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 text-slate-600">
                      <tr>
                        <th className="p-2 text-left">Date Soins</th>
                        <th className="p-2 text-left">Patient / Assuré</th>
                        <th className="p-2 text-left">Matricule</th>
                        <th className="p-2 text-left">Acte Regroupé</th>
                        <th className="p-2 text-center">Nb Actes</th>
                        <th className="p-2 text-right">Total Réclamé</th>
                        <th className="p-2 text-right">Ticket Modérateur</th>
                        <th className="p-2 text-right">Montant Réglé (Net)</th>
                        <th className="p-2 text-right">Montant Exclu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {groupLinesForSinglePayment(viewingPaiement.lignes, viewingPaiement.datePaiement).map(grp => (
                        <tr key={grp.groupKey}>
                          <td className="p-2 text-slate-600 font-medium">{formatDate(grp.dateSoins)}</td>
                          <td className="p-2 font-semibold text-slate-900">{grp.nomAgent}</td>
                          <td className="p-2 font-mono text-[11px] text-slate-600">{grp.immatriculation}</td>
                          <td className="p-2">
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-900 border border-emerald-200 font-bold text-[10px] mr-1">
                              {grp.codeActe}
                            </span>
                            <span className="text-slate-700">{grp.libelleActe}</span>
                          </td>
                          <td className="p-2 text-center font-bold text-slate-700">{grp.nombreActes}</td>
                          <td className="p-2 text-right text-slate-700 font-medium">{formatMoney(grp.totalReclame)}</td>
                          <td className="p-2 text-right text-amber-700 font-medium">{formatMoney(grp.ticketModerateur)}</td>
                          <td className="p-2 text-right font-bold text-emerald-700">{formatMoney(grp.totalPaye)}</td>
                          <td className="p-2 text-right text-rose-600 font-medium">{formatMoney(grp.montantExclu)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 text-slate-600">
                      <tr>
                        <th className="p-2 text-left">Date Soins</th>
                        <th className="p-2 text-left">Matricule</th>
                        <th className="p-2 text-left">Assuré</th>
                        <th className="p-2 text-left">Acte / Commentaire</th>
                        <th className="p-2 text-right">Montant Réglé</th>
                        <th className="p-2 text-right">Ticket Modérateur</th>
                        <th className="p-2 text-right">Montant Exclu</th>
                        <th className="p-2 text-left">Observations</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {viewingPaiement.lignes.map(l => (
                        <tr key={l.id}>
                          <td className="p-2 text-slate-600 font-medium">{l.dateSoins ? formatDate(l.dateSoins) : '-'}</td>
                          <td className="p-2 font-mono font-medium text-indigo-700">{l.immatriculation || '-'}</td>
                          <td className="p-2 font-semibold text-slate-800">{l.nomAgent || l.nomBaseAssurance}</td>
                          <td className="p-2">
                            {l.codeActe ? (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-900 border border-emerald-200 font-bold text-[10px] mr-1">
                                {l.codeActe}
                              </span>
                            ) : null}
                            <span className="text-slate-600 text-[11px]">{l.libelleActe || l.commentaire || '-'}</span>
                          </td>
                          <td className="p-2 text-right font-bold text-emerald-700">{formatMoney(l.totalPaye)}</td>
                          <td className="p-2 text-right text-amber-700 font-medium">{formatMoney(l.ticketModerateur)}</td>
                          <td className="p-2 text-right text-rose-600 font-medium">{formatMoney(l.montantExclu)}</td>
                          <td className="p-2 text-slate-500 text-[11px]">{l.commentaire || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
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
                    value={datePaiementInput}
                    onChange={(e) => setDatePaiementInput(e.target.value)}
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
