import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  Search,
  Download,
  Filter,
  FileText,
  Building,
  CheckCircle2,
  Clock,
  XCircle,
  HelpCircle,
  Eye,
  Edit3,
  ChevronDown,
  RefreshCw,
  Printer,
  DollarSign,
  UserCheck
} from 'lucide-react';
import { Prestation, Paiement, Societe, Personne, Famille } from '../types';
import { formatMoney, formatDate } from '../utils/formatters';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface RejetDetail {
  id: string;
  type: 'prestation_complete' | 'acte_isole' | 'exclusion_decompte';
  prestationId: string;
  numeroFacture: string;
  dateSoins: string;
  societeId: string;
  societeNom: string;
  sousSociete?: string;
  nomAgent: string;
  matricule: string;
  codeActe: string;
  libelleActe: string;
  montantInitial: number;
  montantExcluRejete: number;
  motif: string;
  bordereauPaiement?: string;
  datePaiement?: string;
  statutContestation: 'À traiter' | 'En contestation' | 'Régularisé' | 'Rejet définitif';
  commentaireContestation?: string;
}

interface RejetsViewProps {
  prestations: Prestation[];
  paiements: Paiement[];
  societes: Societe[];
  personnes: Personne[];
  familles: Famille[];
  selectedSocieteId: string;
  onSavePrestation?: (prestation: Prestation) => void;
}

export const RejetsView: React.FC<RejetsViewProps> = ({
  prestations,
  paiements,
  societes,
  personnes,
  familles,
  selectedSocieteId,
  onSavePrestation,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatut, setFilterStatut] = useState<string>('ALL');
  const [filterSociete, setFilterSociete] = useState<string>('ALL');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  // Local state for tracking contestation status/notes overrides
  const [contestationsMap, setContestationsMap] = useState<Record<string, {
    statut: 'À traiter' | 'En contestation' | 'Régularisé' | 'Rejet définitif';
    note?: string;
  }>>({});

  // Dismissed/hidden rejets set (including FA-04/MCI/26-030 requested by user)
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('suivi_rejets_dismissed_ids');
      if (saved) return JSON.parse(saved);
    } catch {}
    return ['FA-04/MCI/26-030'];
  });
  const [showDismissed, setShowDismissed] = useState<boolean>(false);

  const handleDismissRejet = (id: string, numFacture: string) => {
    setDismissedIds(prev => {
      const updated = Array.from(new Set([...prev, id, numFacture]));
      try {
        localStorage.setItem('suivi_rejets_dismissed_ids', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleRestoreRejet = (id: string, numFacture: string) => {
    setDismissedIds(prev => {
      const updated = prev.filter(item => item !== id && item !== numFacture);
      try {
        localStorage.setItem('suivi_rejets_dismissed_ids', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Modal edit contestation
  const [selectedRejetModal, setSelectedRejetModal] = useState<RejetDetail | null>(null);
  const [modalStatut, setModalStatut] = useState<'À traiter' | 'En contestation' | 'Régularisé' | 'Rejet définitif'>('En contestation');
  const [modalNote, setModalNote] = useState('');

  // 1. Extraction et compilation dynamique de tous les rejets
  const allRejets = useMemo<RejetDetail[]>(() => {
    const list: RejetDetail[] = [];
    const seenKeys = new Set<string>();

    // A. Parcourir les Prestations (Factures intégrales rejetées ou actes isolés rejetés)
    prestations.forEach((p) => {
      const pers = personnes.find((pe) => pe.id === p.personneId);
      const soc = societes.find((s) => s.id === p.societeId);
      const socName = p.societeNom || soc?.nom || 'Assurance Inconnue';
      const patientName = p.nomAgent || pers?.nomPrenom || 'Agent non identifié';
      const mat = p.matricule || pers?.matricule || '-';

      // Case 1: Prestation entièrement rejetée
      if (p.statut === 'Rejeté') {
        const montantCharge = Number(p.montantARembourser ?? Math.max(0, p.totalPrestation - p.participation));
        
        if (p.lignes && p.lignes.length > 0) {
          p.lignes.forEach((l) => {
            const key = `prest_full_${p.id}_${l.id}`;
            seenKeys.add(key);
            const override = contestationsMap[key];
            list.push({
              id: key,
              type: 'prestation_complete',
              prestationId: p.id,
              numeroFacture: p.numeroFacture,
              dateSoins: p.date,
              societeId: p.societeId,
              societeNom: socName,
              sousSociete: p.sousSociete,
              nomAgent: patientName,
              matricule: mat,
              codeActe: l.code || 'ACTE',
              libelleActe: l.libelle || 'Acte médical',
              montantInitial: l.totalPrestation || 0,
              montantExcluRejete: l.montantARembourser || l.totalPrestation || 0,
              motif: p.commentaires || 'Facture globale rejetée par le tiers-payeur',
              statutContestation: override?.statut || 'À traiter',
              commentaireContestation: override?.note,
            });
          });
        } else {
          const key = `prest_full_${p.id}`;
          seenKeys.add(key);
          const override = contestationsMap[key];
          list.push({
            id: key,
            type: 'prestation_complete',
            prestationId: p.id,
            numeroFacture: p.numeroFacture,
            dateSoins: p.date,
            societeId: p.societeId,
            societeNom: socName,
            sousSociete: p.sousSociete,
            nomAgent: patientName,
            matricule: mat,
            codeActe: 'GLOBAL',
            libelleActe: 'Prestation médicale complète',
            montantInitial: p.totalPrestation,
            montantExcluRejete: montantCharge,
            motif: p.commentaires || 'Rejet intégral de la facture',
            statutContestation: override?.statut || 'À traiter',
            commentaireContestation: override?.note,
          });
        }
      } else {
        // Case 2: Actes isolés rejetés dans une prestation
        p.lignes?.forEach((l) => {
          if (l.statut === 'Rejeté') {
            const key = `ligne_rejet_${p.id}_${l.id}`;
            seenKeys.add(key);
            const override = contestationsMap[key];
            const mntRejet = l.montantARembourser || l.totalPrestation || 0;
            list.push({
              id: key,
              type: 'acte_isole',
              prestationId: p.id,
              numeroFacture: p.numeroFacture,
              dateSoins: p.date,
              societeId: p.societeId,
              societeNom: socName,
              sousSociete: p.sousSociete,
              nomAgent: patientName,
              matricule: mat,
              codeActe: l.code || 'ACTE',
              libelleActe: l.libelle || 'Acte spécifique',
              montantInitial: l.totalPrestation,
              montantExcluRejete: mntRejet,
              motif: p.commentaires || 'Acte spécifique rejeté',
              statutContestation: override?.statut || 'À traiter',
              commentaireContestation: override?.note,
            });
          }
        });
      }
    });

    // B. Parcourir les Règlements (Exclusions/Rejets sur décomptes)
    paiements.forEach((paie) => {
      const soc = societes.find((s) => s.id === paie.societeId);
      const socName = paie.societeNom || soc?.nom || 'Assurance';

      paie.lignes?.forEach((l) => {
        if (l.montantExclu > 0) {
          const key = `paie_exclu_${paie.id}_${l.id}`;
          if (!seenKeys.has(key)) {
            const prest = prestations.find((p) => p.id === l.prestationId);
            const pers = personnes.find((pe) => pe.id === prest?.personneId);
            const patientName = l.nomAgent || paie.nomAgent || prest?.nomAgent || pers?.nomPrenom || 'Agent';
            const mat = l.immatriculation || paie.matricule || prest?.matricule || pers?.matricule || '-';
            const override = contestationsMap[key];

            list.push({
              id: key,
              type: 'exclusion_decompte',
              prestationId: l.prestationId || '',
              numeroFacture: l.prestationNumero || prest?.numeroFacture || 'S/N',
              dateSoins: l.dateSoins || paie.dateSoins || paie.datePaiement,
              societeId: paie.societeId,
              societeNom: socName,
              sousSociete: paie.sousSociete || prest?.sousSociete,
              nomAgent: patientName,
              matricule: mat,
              codeActe: l.codeActe || 'EXCLU',
              libelleActe: l.libelleActe || 'Exclusion sur règlement',
              montantInitial: l.montantReclame || (l.totalPaye + l.montantExclu + l.ticketModerateur),
              montantExcluRejete: l.montantExclu,
              motif: l.commentaire || paie.notes || 'Exclusion ou rejet notifié sur bordereau de règlement',
              bordereauPaiement: paie.numeroBordereau,
              datePaiement: paie.datePaiement,
              statutContestation: override?.statut || 'À traiter',
              commentaireContestation: override?.note,
            });
          }
        }
      });
    });

    return list;
  }, [prestations, paiements, societes, personnes, contestationsMap]);

  // 2. Filtrage des rejets
  const filteredRejets = useMemo(() => {
    return allRejets.filter((item) => {
      // Exclure spécifiquement les rejets masqués (ex: FA-04/MCI/26-030)
      const isDismissed = dismissedIds.includes(item.id) || 
                          dismissedIds.includes(item.numeroFacture) || 
                          item.numeroFacture === 'FA-04/MCI/26-030';
      if (!showDismissed && isDismissed) {
        return false;
      }
      if (showDismissed && !isDismissed) {
        return false;
      }

      // Filtre Tiers-Payeur Global
      const effectiveSocFilter = selectedSocieteId !== 'ALL' ? selectedSocieteId : filterSociete;
      const matchesSoc = effectiveSocFilter === 'ALL' || item.societeId === effectiveSocFilter;

      // Type de rejet
      const matchesType = filterType === 'ALL' || item.type === filterType;

      // Statut de contestation
      const matchesStatut = filterStatut === 'ALL' || item.statutContestation === filterStatut;

      // Filtre Dates
      const matchesDateStart = !dateStart || item.dateSoins >= dateStart;
      const matchesDateEnd = !dateEnd || item.dateSoins <= dateEnd;

      // Recherche texte
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.numeroFacture.toLowerCase().includes(q) ||
        item.nomAgent.toLowerCase().includes(q) ||
        item.matricule.toLowerCase().includes(q) ||
        item.societeNom.toLowerCase().includes(q) ||
        item.codeActe.toLowerCase().includes(q) ||
        item.libelleActe.toLowerCase().includes(q) ||
        item.motif.toLowerCase().includes(q) ||
        (item.bordereauPaiement && item.bordereauPaiement.toLowerCase().includes(q));

      return matchesSoc && matchesType && matchesStatut && matchesDateStart && matchesDateEnd && matchesSearch;
    });
  }, [allRejets, selectedSocieteId, filterSociete, filterType, filterStatut, dateStart, dateEnd, searchTerm]);

  // 3. Indicateurs Synthétiques (KPIs)
  const totalMontantRejete = useMemo(() => {
    return filteredRejets.reduce((sum, r) => sum + r.montantExcluRejete, 0);
  }, [filteredRejets]);

  const totalBrutConcerne = useMemo(() => {
    return filteredRejets.reduce((sum, r) => sum + r.montantInitial, 0);
  }, [filteredRejets]);

  const countATraiter = useMemo(() => {
    return filteredRejets.filter((r) => r.statutContestation === 'À traiter').length;
  }, [filteredRejets]);

  const countEnContestation = useMemo(() => {
    return filteredRejets.filter((r) => r.statutContestation === 'En contestation').length;
  }, [filteredRejets]);

  const countRegularise = useMemo(() => {
    return filteredRejets.filter((r) => r.statutContestation === 'Régularisé').length;
  }, [filteredRejets]);

  // 4. Modal Handlers
  const handleOpenEditModal = (item: RejetDetail) => {
    setSelectedRejetModal(item);
    setModalStatut(item.statutContestation);
    setModalNote(item.commentaireContestation || '');
  };

  const handleSaveModal = () => {
    if (!selectedRejetModal) return;
    setContestationsMap((prev) => ({
      ...prev,
      [selectedRejetModal.id]: {
        statut: modalStatut,
        note: modalNote,
      },
    }));
    setSelectedRejetModal(null);
  };

  // 5. Exporter la liste en Excel
  const handleExportExcel = () => {
    const rows = filteredRejets.map((r) => ({
      'Type Rejet':
        r.type === 'prestation_complete'
          ? 'Facture Intégrale Rejetée'
          : r.type === 'acte_isole'
          ? 'Acte Médical Rejeté'
          : 'Exclusion sur Décompte',
      'N° Facture': r.numeroFacture,
      'Date Soins': formatDate(r.dateSoins),
      Organisme: r.societeNom + (r.sousSociete ? ` (${r.sousSociete})` : ''),
      'Nom Assuré / Patient': r.nomAgent,
      Matricule: r.matricule,
      'Code Acte': r.codeActe,
      'Libellé Acte': r.libelleActe,
      'Montant Initial (Ar)': r.montantInitial,
      'Montant Rejeté / Exclu (Ar)': r.montantExcluRejete,
      'Motif du Rejet': r.motif,
      'Bordereau Règlement': r.bordereauPaiement || '-',
      'Statut Contestation': r.statutContestation,
      'Commentaire Contestation': r.commentaireContestation || '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rejets_Exclusions');
    XLSX.writeFile(wb, `Etat_Rejets_Assurance_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // 6. Génération PDF : Bordereau de Contestation / État des Rejets
  const handleExportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const dateGen = new Date().toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // En-tête
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('SALFA - ÉTABLISSEMENT MÉDICAL & SOINS', 14, 12);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Édité le : ${dateGen}`, 283, 12, { align: 'right' });

    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(185, 28, 28);
    doc.text('BORDEREAU DÉTAILLÉ DES REJETS & CONTESTATIONS', 14, 24);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const socObj = societes.find((s) => s.id === (selectedSocieteId !== 'ALL' ? selectedSocieteId : filterSociete));
    doc.text(
      `Tiers-Payeur : ${socObj ? socObj.nom : 'Tous les organismes'} | ${filteredRejets.length} dossier(s) rejeté(s) / exclu(s)`,
      14,
      30
    );

    // KPI Header visual line
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(254, 242, 242);
    doc.roundedRect(14, 34, 269, 12, 1.5, 1.5, 'FD');

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(185, 28, 28);
    doc.text(`TOTAL REJETS & EXCLUSIONS : ${formatMoney(totalMontantRejete)}`, 20, 41.5);

    doc.setTextColor(51, 65, 85);
    doc.text(`Montant Initial Concerné : ${formatMoney(totalBrutConcerne)}`, 130, 41.5);
    doc.text(`À traiter : ${countATraiter} | En contestation : ${countEnContestation}`, 210, 41.5);

    const headers = [
      'N° Facture',
      'Date',
      'Organisme / Tiers-Payeur',
      'Patient / Assuré',
      'Matricule',
      'Acte / Code',
      'Montant Brut',
      'Montant Rejeté',
      'Motif du Rejet',
      'Statut Contestation',
    ];

    const tableRows = filteredRejets.map((r) => [
      r.numeroFacture,
      formatDate(r.dateSoins),
      r.societeNom + (r.sousSociete ? ` (${r.sousSociete})` : ''),
      r.nomAgent,
      r.matricule,
      `${r.codeActe} - ${r.libelleActe}`,
      formatMoney(r.montantInitial),
      formatMoney(r.montantExcluRejete),
      r.motif,
      r.statutContestation,
    ]);

    // Ligne Total Général
    tableRows.push([
      `TOTAL GÉNÉRAL (${filteredRejets.length} rejets)`,
      '',
      '',
      '',
      '',
      '',
      formatMoney(totalBrutConcerne),
      formatMoney(totalMontantRejete),
      '',
      '',
    ]);

    autoTable(doc, {
      startY: 50,
      head: [headers],
      body: tableRows,
      theme: 'grid',
      headStyles: {
        fillColor: [185, 28, 28],
        textColor: 255,
        fontSize: 8,
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        textColor: [30, 41, 59],
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 26, textColor: [67, 56, 202] },
        1: { cellWidth: 20 },
        2: { cellWidth: 38 },
        3: { fontStyle: 'bold', cellWidth: 38 },
        4: { cellWidth: 20 },
        5: { cellWidth: 35 },
        6: { halign: 'right', cellWidth: 25 },
        7: { halign: 'right', fontStyle: 'bold', cellWidth: 25, textColor: [185, 28, 28] },
        8: { cellWidth: 25 },
        9: { halign: 'center', cellWidth: 22, fontStyle: 'bold' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.row.index === tableRows.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [254, 242, 242];
        }
      },
    });

    doc.save(`Bordereau_Contestation_Rejets_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div id="rejets-view" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-6 h-6 text-rose-600" />
            <h2 className="text-xl font-bold text-slate-900">Tableau de Bord des Rejets & Exclusions</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Suivi centralisé des factures rejetées, actes exclus et contestations auprès des compagnies d'assurance
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportExcel}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Excel</span>
          </button>

          <button
            onClick={handleExportPdf}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 shadow-xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimer Bordereau (PDF)</span>
          </button>
        </div>
      </div>

      {/* Cartouches d'indicateurs (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-xs bg-gradient-to-br from-rose-50/40 to-white">
          <div className="flex items-center justify-between text-rose-700 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Montant Total Rejeté</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-700">{formatMoney(totalMontantRejete)}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            Sur {formatMoney(totalBrutConcerne)} de soins facturés
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-600 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Dossiers / Actes Rejetés</span>
            <FileText className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{filteredRejets.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            Nombre de lignes d'impayés non pris en charge
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-xs bg-amber-50/30">
          <div className="flex items-center justify-between text-amber-700 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">À Traiter / Contester</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-700">{countATraiter + countEnContestation}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            {countATraiter} à traiter · {countEnContestation} en cours de contestation
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-xs bg-emerald-50/30">
          <div className="flex items-center justify-between text-emerald-700 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Rejets Régularisés</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700">{countRegularise}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            Dossiers contestés et réintégrés avec succès
          </div>
        </div>
      </div>

      {/* Barre de Filtres */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
        {/* Recherche */}
        <div className="md:col-span-1">
          <label className="block text-slate-500 font-medium mb-1">Recherche rapide</label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Facture, patient, acte, motif..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-rose-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Organisme / Assurance */}
        <div>
          <label className="block text-slate-500 font-medium mb-1">Tiers-Payeur / Société</label>
          <select
            value={selectedSocieteId !== 'ALL' ? selectedSocieteId : filterSociete}
            onChange={(e) => setFilterSociete(e.target.value)}
            disabled={selectedSocieteId !== 'ALL'}
            className="w-full p-1.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-rose-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
          >
            <option value="ALL">Toutes les assurances</option>
            {societes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nom}
              </option>
            ))}
          </select>
        </div>

        {/* Type de Rejet */}
        <div>
          <label className="block text-slate-500 font-medium mb-1">Type de Rejet</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full p-1.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-rose-500 focus:outline-none"
          >
            <option value="ALL">Tous les types</option>
            <option value="prestation_complete">Facture intégrale rejetée</option>
            <option value="acte_isole">Acte spécifique rejeté</option>
            <option value="exclusion_decompte">Exclusion sur décompte</option>
          </select>
        </div>

        {/* Statut Contestation */}
        <div>
          <label className="block text-slate-500 font-medium mb-1">Statut Contestation</label>
          <select
            value={filterStatut}
            onChange={(e) => setFilterStatut(e.target.value)}
            className="w-full p-1.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-rose-500 focus:outline-none"
          >
            <option value="ALL">Tous les statuts</option>
            <option value="À traiter">À traiter</option>
            <option value="En contestation">En contestation</option>
            <option value="Régularisé">Régularisé</option>
            <option value="Rejet définitif">Rejet définitif</option>
          </select>
        </div>

        {/* Dates */}
        <div>
          <label className="block text-slate-500 font-medium mb-1">Période (Du / Au)</label>
          <div className="flex items-center space-x-1">
            <input
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              className="w-1/2 p-1.5 rounded-lg border border-slate-200 text-[11px] focus:ring-2 focus:ring-rose-500 focus:outline-none"
            />
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              className="w-1/2 p-1.5 rounded-lg border border-slate-200 text-[11px] focus:ring-2 focus:ring-rose-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Tableau des Rejets */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-3.5">Type & Facture</th>
                <th className="py-3 px-3">Date Soins</th>
                <th className="py-3 px-3">Tiers-Payeur / Assuré</th>
                <th className="py-3 px-3">Acte Médical Concerné</th>
                <th className="py-3 px-3 text-right">Montant Brut</th>
                <th className="py-3 px-3 text-right">Montant Rejeté</th>
                <th className="py-3 px-3">Motif du Rejet / Observation</th>
                <th className="py-3 px-3 text-center">Statut Contestation</th>
                <th className="py-3 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRejets.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <AlertTriangle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold">Aucun rejet ni exclusion trouvé pour ces critères.</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Modifiez les filtres de recherche ou sélectionnez un autre organisme.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRejets.map((item) => {
                  return (
                    <tr key={item.id} className="hover:bg-rose-50/30 transition-colors">
                      {/* Type & Facture */}
                      <td className="py-3 px-3.5">
                        <div className="font-bold text-indigo-700 flex items-center space-x-1.5">
                          <span>{item.numeroFacture}</span>
                        </div>
                        <div className="text-[10px] mt-0.5">
                          {item.type === 'prestation_complete' && (
                            <span className="inline-block px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-semibold">
                              Facture intégrale
                            </span>
                          )}
                          {item.type === 'acte_isole' && (
                            <span className="inline-block px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                              Acte isolé
                            </span>
                          )}
                          {item.type === 'exclusion_decompte' && (
                            <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                              Exclusion décompte
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Date */}
                      <td className="py-3 px-3 text-slate-600 font-medium">{formatDate(item.dateSoins)}</td>

                      {/* Tiers-Payeur / Assuré */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-800">
                          {item.societeNom}
                          {item.sousSociete && (
                            <span className="text-[10px] text-slate-500 font-normal ml-1">
                              ({item.sousSociete})
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-600 flex items-center space-x-1 mt-0.5">
                          <span>{item.nomAgent}</span>
                          <span className="text-slate-400">({item.matricule})</span>
                        </div>
                      </td>

                      {/* Acte */}
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-800">
                          <span className="text-indigo-600 font-bold mr-1">{item.codeActe}</span>
                          {item.libelleActe}
                        </div>
                      </td>

                      {/* Montant Brut */}
                      <td className="py-3 px-3 text-right text-slate-600 font-medium">
                        {formatMoney(item.montantInitial)}
                      </td>

                      {/* Montant Rejeté */}
                      <td className="py-3 px-3 text-right font-black text-rose-700 bg-rose-50/50">
                        {formatMoney(item.montantExcluRejete)}
                      </td>

                      {/* Motif */}
                      <td className="py-3 px-3 max-w-[220px]">
                        <p className="text-[11px] text-slate-700 truncate" title={item.motif}>
                          {item.motif}
                        </p>
                        {item.bordereauPaiement && (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Bordereau : <span className="font-mono">{item.bordereauPaiement}</span>
                          </div>
                        )}
                        {item.commentaireContestation && (
                          <div className="text-[10px] text-indigo-700 italic mt-0.5">
                            Note : {item.commentaireContestation}
                          </div>
                        )}
                      </td>

                      {/* Statut Contestation */}
                      <td className="py-3 px-3 text-center">
                        {item.statutContestation === 'À traiter' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            <Clock className="w-3 h-3 mr-1" />
                            À traiter
                          </span>
                        )}
                        {item.statutContestation === 'En contestation' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                            <RefreshCw className="w-3 h-3 mr-1" />
                            En contestation
                          </span>
                        )}
                        {item.statutContestation === 'Régularisé' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Régularisé
                          </span>
                        )}
                        {item.statutContestation === 'Rejet définitif' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                            <XCircle className="w-3 h-3 mr-1" />
                            Définitif
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-3 text-center space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => handleOpenEditModal(item)}
                          className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold text-[11px] transition-colors cursor-pointer shadow-2xs"
                          title="Modifier le statut de contestation"
                        >
                          <Edit3 className="w-3 h-3 inline mr-1 text-slate-500" />
                          Traiter
                        </button>
                        {showDismissed ? (
                          <button
                            onClick={() => handleRestoreRejet(item.id, item.numeroFacture)}
                            className="px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 font-semibold text-[11px] transition-colors cursor-pointer shadow-2xs"
                            title="Restaurer ce rejet dans la liste active"
                          >
                            Restaurer
                          </button>
                        ) : (
                          <button
                            onClick={() => handleDismissRejet(item.id, item.numeroFacture)}
                            className="px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 font-semibold text-[11px] transition-colors cursor-pointer shadow-2xs"
                            title="Masquer ce rejet de la liste"
                          >
                            Masquer
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal d'édition du statut de contestation */}
      {selectedRejetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 text-rose-700">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900">Mettre à jour le Suivi du Rejet</h3>
              </div>
              <button
                onClick={() => setSelectedRejetModal(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Facture / Réf :</span>
                <span className="font-bold text-indigo-700">{selectedRejetModal.numeroFacture}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Organisme :</span>
                <span className="font-semibold text-slate-800">{selectedRejetModal.societeNom}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Assuré / Patient :</span>
                <span className="font-semibold text-slate-800">
                  {selectedRejetModal.nomAgent} ({selectedRejetModal.matricule})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Acte concerné :</span>
                <span className="font-semibold text-slate-800">
                  {selectedRejetModal.codeActe} - {selectedRejetModal.libelleActe}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200">
                <span className="text-rose-700 font-bold">Montant Rejeté :</span>
                <span className="font-black text-rose-700 text-sm">
                  {formatMoney(selectedRejetModal.montantExcluRejete)}
                </span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Motif initial notifié</label>
                <div className="p-2.5 bg-rose-50/50 border border-rose-100 rounded-lg text-slate-700 italic">
                  "{selectedRejetModal.motif}"
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nouveau Statut de Contestation *
                </label>
                <select
                  value={modalStatut}
                  onChange={(e) => setModalStatut(e.target.value as any)}
                  className="w-full p-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-rose-500 focus:outline-none font-semibold text-slate-800"
                >
                  <option value="À traiter">À traiter (Non encore transmis)</option>
                  <option value="En contestation">En contestation (Courrier / Relance transmis à l'assureur)</option>
                  <option value="Régularisé">Régularisé (Accordé / Repris en paiement par l'assurance)</option>
                  <option value="Rejet définitif">Rejet définitif (Non contestable / Perte confirmée)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Note / Référence de la contestation
                </label>
                <textarea
                  rows={3}
                  value={modalNote}
                  onChange={(e) => setModalNote(e.target.value)}
                  placeholder="Ex: Courrier de réclamation N° 2025/12 transmis par e-mail le 15/03/2025 avec justificatif médical..."
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedRejetModal(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveModal}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white hover:bg-rose-700 font-semibold text-xs shadow-xs"
              >
                Enregistrer la mise à jour
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
