import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Prestation, Paiement, Societe, Personne } from '../types';
import { formatMoney, formatDate } from './formatters';

export interface RecouvrementItem {
  prestationId: string;
  numeroFacture: string;
  dateFacture: string;
  societeNom: string;
  sousSociete?: string;
  patientNom: string;
  matricule: string;
  montantBrut: number;
  ticketModerateur: number;
  montantARembourser: number;
  totalPaye: number;
  resteARecouvrer: number;
  retardJours: number;
  retardMois: number;
  statut: string;
}

export interface RecouvrementSummary {
  items: RecouvrementItem[];
  totalARecouvrer: number;
  totalBrut: number;
  totalTicketModerateur: number;
  totalARembourser: number;
  totalPaye: number;
  dossiersCount: number;
  parSociete: Array<{
    societeNom: string;
    dossiersCount: number;
    totalBrut: number;
    totalARembourser: number;
    totalPaye: number;
    resteARecouvrer: number;
    maxRetardJours: number;
  }>;
  parMois: Array<{
    moisKey: string;
    moisLibelle: string;
    dossiersCount: number;
    totalBrut: number;
    totalARembourser: number;
    totalPaye: number;
    resteARecouvrer: number;
  }>;
}

/**
 * Calcule la liste et les synthèses des créances de recouvrement avec un seuil de retard (par défaut 90 jours / 3 mois)
 */
export function calculateRecouvrementData(
  prestations: Prestation[],
  paiements: Paiement[] = [],
  societes: Societe[] = [],
  personnes: Personne[] = [],
  seuilMois: number = 3,
  selectedSocieteId: string = 'ALL'
): RecouvrementSummary {
  const now = new Date();
  const seuilJours = seuilMois * 30; // 90 jours pour 3 mois

  // 1. Indexation des règlements par prestation / facture
  const paiementsParPrestation: Record<string, number> = {};
  paiements.forEach(p => {
    p.lignes.forEach(l => {
      const paye = Number(l.totalPaye || l.montantPaye || 0);
      if (l.prestationId) {
        paiementsParPrestation[l.prestationId] = (paiementsParPrestation[l.prestationId] || 0) + paye;
      }
      if (l.prestationNumero) {
        paiementsParPrestation[l.prestationNumero] = (paiementsParPrestation[l.prestationNumero] || 0) + paye;
      }
    });
  });

  const items: RecouvrementItem[] = [];

  prestations.forEach(p => {
    if (selectedSocieteId !== 'ALL' && p.societeId !== selectedSocieteId) {
      return;
    }

    // Calcul date et retard
    const dStr = p.date ? p.date.split('T')[0] : '';
    if (!dStr) return;
    const pDate = new Date(dStr);
    const diffTime = now.getTime() - pDate.getTime();
    const retardJours = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
    const retardMois = Math.floor(retardJours / 30);

    // Calculs financiers
    const montantBrut = Number(p.totalPrestation ?? p.montantTotal ?? 0);
    const ticketModerateur = Number(p.participation ?? p.ticketModerateur ?? 0);
    const chargeAssurance = Number(p.montantARembourser ?? Math.max(0, montantBrut - ticketModerateur));
    
    // Total payé enregistré
    const payeEnregistre = Number(p.totalPaye ?? 0);
    const payeDepuisLignes = paiementsParPrestation[p.id] || paiementsParPrestation[p.numeroFacture] || 0;
    const totalPaye = Math.max(payeEnregistre, payeDepuisLignes);
    
    const resteARecouvrer = Math.max(0, chargeAssurance - totalPaye);

    // Ne retenir que les factures NON soldées avec un retard >= 90 jours (3 mois)
    if (resteARecouvrer > 0 && retardJours >= seuilJours) {
      const pers = personnes.find(pe => pe.id === p.personneId);
      const soc = societes.find(s => s.id === p.societeId);
      const patientNom = p.nomAgent || pers?.nomPrenom || 'Patient';
      const matricule = p.matricule || pers?.matricule || '-';
      const societeNom = p.societeNom || soc?.nom || 'Assurance';

      items.push({
        prestationId: p.id,
        numeroFacture: p.numeroFacture,
        dateFacture: dStr,
        societeNom,
        sousSociete: p.sousSociete || '',
        patientNom,
        matricule,
        montantBrut,
        ticketModerateur,
        montantARembourser: chargeAssurance,
        totalPaye,
        resteARecouvrer,
        retardJours,
        retardMois,
        statut: p.statut || 'En attente'
      });
    }
  });

  // Tri par retard décroissant (les plus en retard d'abord)
  items.sort((a, b) => b.retardJours - a.retardJours);

  // Synthèse par société
  const socMap: Record<string, {
    societeNom: string;
    dossiersCount: number;
    totalBrut: number;
    totalARembourser: number;
    totalPaye: number;
    resteARecouvrer: number;
    maxRetardJours: number;
  }> = {};

  items.forEach(it => {
    if (!socMap[it.societeNom]) {
      socMap[it.societeNom] = {
        societeNom: it.societeNom,
        dossiersCount: 0,
        totalBrut: 0,
        totalARembourser: 0,
        totalPaye: 0,
        resteARecouvrer: 0,
        maxRetardJours: 0,
      };
    }
    const s = socMap[it.societeNom];
    s.dossiersCount += 1;
    s.totalBrut += it.montantBrut;
    s.totalARembourser += it.montantARembourser;
    s.totalPaye += it.totalPaye;
    s.resteARecouvrer += it.resteARecouvrer;
    if (it.retardJours > s.maxRetardJours) {
      s.maxRetardJours = it.retardJours;
    }
  });

  const parSociete = Object.values(socMap).sort((a, b) => b.resteARecouvrer - a.resteARecouvrer);

  // Synthèse par mois (Récapitulatif Mensuel des impayés)
  const moisMap: Record<string, {
    moisKey: string;
    moisLibelle: string;
    dossiersCount: number;
    totalBrut: number;
    totalARembourser: number;
    totalPaye: number;
    resteARecouvrer: number;
  }> = {};

  const MOIS_FR = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  function formatMoisFR(key: string): string {
    if (!key || key === 'Inconnu') return 'Non spécifié';
    const parts = key.split('-');
    if (parts.length >= 2) {
      const year = parts[0];
      const monthIdx = parseInt(parts[1], 10) - 1;
      if (monthIdx >= 0 && monthIdx < 12) {
        return `${MOIS_FR[monthIdx]} ${year}`;
      }
    }
    return key;
  }

  items.forEach(it => {
    const mKey = it.dateFacture ? it.dateFacture.substring(0, 7) : 'Inconnu';
    if (!moisMap[mKey]) {
      moisMap[mKey] = {
        moisKey: mKey,
        moisLibelle: formatMoisFR(mKey),
        dossiersCount: 0,
        totalBrut: 0,
        totalARembourser: 0,
        totalPaye: 0,
        resteARecouvrer: 0,
      };
    }
    const m = moisMap[mKey];
    m.dossiersCount += 1;
    m.totalBrut += it.montantBrut;
    m.totalARembourser += it.montantARembourser;
    m.totalPaye += it.totalPaye;
    m.resteARecouvrer += it.resteARecouvrer;
  });

  const parMois = Object.values(moisMap).sort((a, b) => b.moisKey.localeCompare(a.moisKey));

  const totalARecouvrer = items.reduce((sum, i) => sum + i.resteARecouvrer, 0);
  const totalBrut = items.reduce((sum, i) => sum + i.montantBrut, 0);
  const totalTicketModerateur = items.reduce((sum, i) => sum + i.ticketModerateur, 0);
  const totalARembourser = items.reduce((sum, i) => sum + i.montantARembourser, 0);
  const totalPaye = items.reduce((sum, i) => sum + i.totalPaye, 0);

  return {
    items,
    totalARecouvrer,
    totalBrut,
    totalTicketModerateur,
    totalARembourser,
    totalPaye,
    dossiersCount: items.length,
    parSociete,
    parMois
  };
}

/**
 * Génère et télécharge un rapport PDF professionnel de l'état de recouvrement (> 3 mois de retard)
 */
export function generateRecouvrementPdf(
  data: RecouvrementSummary,
  options?: {
    titreEtablissement?: string;
    seuilMois?: number;
    nomFiltreSociete?: string;
  }
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const etablissement = options?.titreEtablissement || 'CENTRE MÉDICAL / HÔPITAL';
  const seuil = options?.seuilMois ?? 3;
  const filtreSoc = options?.nomFiltreSociete || 'Toutes les assurances';
  const dateGeneration = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Palette de couleurs
  const primaryColor: [number, number, number] = [30, 41, 59]; // slate-800
  const accentColor: [number, number, number] = [185, 28, 28]; // rose-700
  const emeraldColor: [number, number, number] = [4, 120, 87]; // emerald-700
  const indigoColor: [number, number, number] = [67, 56, 202]; // indigo-700

  // 1. En-tête supérieur
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, 297, 18, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(etablissement.toUpperCase(), 14, 11);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Édité le : ${dateGeneration}`, 283, 11, { align: 'right' });

  // 2. Titre du document
  doc.setTextColor(185, 28, 28);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('ÉTAT DE RECOUVREMENT DES CRÉANCES EN RETARD', 14, 28);

  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Factures non soldées échues avec retard supérieur à ${seuil} mois (> ${seuil * 30} jours) • Périmètre : ${filtreSoc}`,
    14,
    34
  );

  // 3. Bloc de synthèse (KPIs Cards)
  const cardY = 38;
  const cardH = 18;
  const cardW = 64;

  // Card 1 : Montant total à recouvrer
  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(254, 202, 202);
  doc.roundedRect(14, cardY, cardW, cardH, 2, 2, 'FD');
  doc.setTextColor(153, 27, 27);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL À RECOUVRER (> 3 MOIS)', 18, cardY + 5.5);
  doc.setFontSize(13);
  doc.text(formatMoney(data.totalARecouvrer), 18, cardY + 13);

  // Card 2 : Total Réclamé initial
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(82, cardY, cardW, cardH, 2, 2, 'FD');
  doc.setTextColor(51, 65, 85);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL FACTURÉ BRUT', 86, cardY + 5.5);
  doc.setFontSize(12);
  doc.text(formatMoney(data.totalBrut), 86, cardY + 13);

  // Card 3 : Total Déjà Réglé
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(150, cardY, cardW, cardH, 2, 2, 'FD');
  doc.setTextColor(4, 120, 87);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('DÉJÀ RÉGLÉ PAR ASSURANCES', 154, cardY + 5.5);
  doc.setFontSize(12);
  doc.text(formatMoney(data.totalPaye), 154, cardY + 13);

  // Card 4 : Dossiers & Organismes
  doc.setFillColor(238, 242, 255);
  doc.setDrawColor(199, 210, 254);
  doc.roundedRect(218, cardY, cardW, cardH, 2, 2, 'FD');
  doc.setTextColor(67, 56, 202);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('DOSSIERS EN SOUFFRANCE', 222, cardY + 5.5);
  doc.setFontSize(12);
  doc.text(`${data.dossiersCount} factures (${data.parSociete.length} ass.)`, 222, cardY + 13);

  let currentY = 60;

  // 1. RÉCAPITULATIF MENSUEL DES IMPAYÉS (Placé obligatoirement en PREMIÈRE PAGE)
  if (data.parMois && data.parMois.length > 0) {
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('1. Récapitulatif Mensuel des Impayés & Créances en Retard', 14, currentY);

    const moisHeaders = [
      'Mois / Période',
      'Factures',
      'Total Facturé',
      'Charge Assureur',
      'Déjà Réglé',
      'Solde Impayé (Reste à Recouvrer)'
    ];

    const moisRows = data.parMois.map(m => [
      m.moisLibelle,
      String(m.dossiersCount),
      formatMoney(m.totalBrut),
      formatMoney(m.totalARembourser),
      formatMoney(m.totalPaye),
      formatMoney(m.resteARecouvrer)
    ]);

    // Ligne de totalisation
    moisRows.push([
      'TOTAL GÉNÉRAL',
      String(data.dossiersCount),
      formatMoney(data.totalBrut),
      formatMoney(data.totalARembourser),
      formatMoney(data.totalPaye),
      formatMoney(data.totalARecouvrer)
    ]);

    autoTable(doc, {
      startY: currentY + 3,
      head: [moisHeaders],
      body: moisRows,
      theme: 'grid',
      headStyles: {
        fillColor: [185, 28, 28], // Rouge accentué pour les impayés
        textColor: 255,
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'left',
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 1.8,
        textColor: [30, 41, 59],
      },
      columnStyles: {
        0: { fontStyle: 'bold', minCellWidth: 45 },
        1: { halign: 'center', cellWidth: 20 },
        2: { halign: 'right', cellWidth: 40 },
        3: { halign: 'right', cellWidth: 40 },
        4: { halign: 'right', cellWidth: 40, textColor: [4, 120, 87] },
        5: { halign: 'right', cellWidth: 48, fontStyle: 'bold', textColor: [185, 28, 28] },
      },
      didParseCell: (hookData) => {
        if (hookData.section === 'body' && hookData.row.index === moisRows.length - 1) {
          hookData.cell.styles.fontStyle = 'bold';
          hookData.cell.styles.fillColor = [254, 242, 242];
        }
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 7;
  }

  // 2. Ventilation du Recouvrement par Organisme / Assurance
  if (data.parSociete.length > 0) {
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('2. Ventilation du Recouvrement par Organisme / Assurance', 14, currentY);

    const recapHeaders = [
      'Organisme / Assurance',
      'Factures',
      'Total Facturé',
      'Charge Assureur',
      'Déjà Réglé',
      'Solde à Recouvrer',
      'Max Retard'
    ];

    const recapRows = data.parSociete.map(s => [
      s.societeNom,
      String(s.dossiersCount),
      formatMoney(s.totalBrut),
      formatMoney(s.totalARembourser),
      formatMoney(s.totalPaye),
      formatMoney(s.resteARecouvrer),
      `${s.maxRetardJours} j (~${Math.floor(s.maxRetardJours / 30)} mois)`
    ]);

    // Ligne de totalisation
    recapRows.push([
      'TOTAL GÉNÉRAL',
      String(data.dossiersCount),
      formatMoney(data.totalBrut),
      formatMoney(data.totalARembourser),
      formatMoney(data.totalPaye),
      formatMoney(data.totalARecouvrer),
      '-'
    ]);

    autoTable(doc, {
      startY: currentY + 3,
      head: [recapHeaders],
      body: recapRows,
      theme: 'grid',
      headStyles: {
        fillColor: [51, 65, 85],
        textColor: 255,
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'left',
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 1.8,
        textColor: [30, 41, 59],
      },
      columnStyles: {
        0: { fontStyle: 'bold', minCellWidth: 45 },
        1: { halign: 'center', cellWidth: 16 },
        2: { halign: 'right', cellWidth: 32 },
        3: { halign: 'right', cellWidth: 32 },
        4: { halign: 'right', cellWidth: 32, textColor: [4, 120, 87] },
        5: { halign: 'right', cellWidth: 38, fontStyle: 'bold', textColor: [185, 28, 28] },
        6: { halign: 'center', cellWidth: 26 },
      },
      didParseCell: (hookData) => {
        if (hookData.section === 'body' && hookData.row.index === recapRows.length - 1) {
          hookData.cell.styles.fontStyle = 'bold';
          hookData.cell.styles.fillColor = [241, 245, 249];
        }
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 8;
  }

  // Saut de page dédié pour démarrer la liste nominative détaillée proprement en page 2
  doc.addPage();
  currentY = 20;

  // 3. Tableau Détaillé des Factures en Souffrance
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('3. Liste Nominative Détaillée des Factures à Recouvrer (> 3 mois)', 14, currentY);

  const detailHeaders = [
    'N° Facture',
    'Date Soins',
    'Organisme / Client',
    'Patient / Assuré',
    'Matricule',
    'Montant Brut',
    'Part Affilié',
    'Charge Assur.',
    'Déjà Payé',
    'Reste Dû',
    'Retard'
  ];

  const detailRows = data.items.map(item => [
    item.numeroFacture,
    formatDate(item.dateFacture),
    item.societeNom + (item.sousSociete ? ` (${item.sousSociete})` : ''),
    item.patientNom,
    item.matricule,
    formatMoney(item.montantBrut),
    formatMoney(item.ticketModerateur),
    formatMoney(item.montantARembourser),
    formatMoney(item.totalPaye),
    formatMoney(item.resteARecouvrer),
    `${item.retardJours} j (${item.retardMois} m)`
  ]);

  autoTable(doc, {
    startY: currentY + 3,
    head: [detailHeaders],
    body: detailRows,
    theme: 'striped',
    headStyles: {
      fillColor: [185, 28, 28],
      textColor: 255,
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'left',
    },
    styles: {
      fontSize: 7,
      cellPadding: 1.5,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 26, textColor: [67, 56, 202] },
      1: { cellWidth: 20 },
      2: { cellWidth: 32 },
      3: { cellWidth: 36, fontStyle: 'bold' },
      4: { cellWidth: 18 },
      5: { halign: 'right', cellWidth: 24 },
      6: { halign: 'right', cellWidth: 20, textColor: [180, 83, 9] },
      7: { halign: 'right', cellWidth: 24 },
      8: { halign: 'right', cellWidth: 22, textColor: [4, 120, 87] },
      9: { halign: 'right', cellWidth: 26, fontStyle: 'bold', textColor: [185, 28, 28] },
      10: { halign: 'center', cellWidth: 20, fontStyle: 'bold', textColor: [185, 28, 28] },
    },
    foot: [
      [
        'TOTAL',
        '',
        '',
        `${data.dossiersCount} dossiers`,
        '',
        formatMoney(data.totalBrut),
        formatMoney(data.totalTicketModerateur),
        formatMoney(data.totalARembourser),
        formatMoney(data.totalPaye),
        formatMoney(data.totalARecouvrer),
        ''
      ]
    ],
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [30, 41, 59],
      fontStyle: 'bold',
      fontSize: 7.5
    }
  });

  // 6. Pied de page sur toutes les pages
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 200, 283, 200);
    doc.text(
      `Document Confidentiel de Recouvrement • ${etablissement} • Seuil de retard appliqué : ${seuil} mois`,
      14,
      205
    );
    doc.text(`Page ${i} sur ${pageCount}`, 283, 205, { align: 'right' });
  }

  // Sauvegarde et téléchargement automatique
  const filename = `Etat_Recouvrement_Plus_3_Mois_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}


export function generateSelectedPrestationsPdf(
  prestations: Prestation[],
  paiements: Paiement[],
  societes: Societe[],
  personnes: Personne[],
  options?: {
    titreEtablissement?: string;
  }
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const etablissement = options?.titreEtablissement || 'CENTRE MÉDICAL / HÔPITAL';
  const dateGeneration = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, 297, 18, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(etablissement.toUpperCase(), 14, 11);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Édité le : ${dateGeneration}`, 283, 11, { align: 'right' });

  doc.setTextColor(185, 28, 28);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('ÉTAT DE RECOUVREMENT & RÉCAPITULATIF DES IMPAYÉS (SÉLECTION)', 14, 28);

  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');
  doc.text(`Synthèse mensuelle et détail des prestations sélectionnées (${prestations.length} dossier(s))`, 14, 34);

  // Calculs paiements
  const paiementsParPrestation: Record<string, number> = {};
  const paiementsParLigne: Record<string, number> = {};
  paiements.forEach(p => {
    p.lignes.forEach(l => {
      const paye = Number(l.totalPaye || l.montantPaye || 0);
      const exclu = Number(l.montantExclu || 0);
      if (paye > 0 || exclu > 0) {
        if (l.prestationId) paiementsParPrestation[l.prestationId] = (paiementsParPrestation[l.prestationId] || 0) + paye;
        if (l.lignePrestationId) paiementsParLigne[l.lignePrestationId] = (paiementsParLigne[l.lignePrestationId] || 0) + paye;
      }
    });
  });

  // Synthèse globale & Regroupements (Mois & Société)
  let totalFacture = 0;
  let totalTicket = 0;
  let totalRemb = 0;
  let totalPayeAll = 0;
  let totalResteAll = 0;

  const moisMap: Record<string, {
    moisKey: string;
    moisLibelle: string;
    dossiersCount: number;
    totalBrut: number;
    ticket: number;
    totalARembourser: number;
    totalPaye: number;
    resteARecouvrer: number;
  }> = {};

  const socMap: Record<string, {
    nom: string;
    dossiersCount: number;
    totalBrut: number;
    totalARembourser: number;
    totalPaye: number;
    resteARecouvrer: number;
  }> = {};

  const MOIS_FR = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  function formatMoisFR(key: string): string {
    if (!key || key === 'Inconnu') return 'Non spécifié';
    const parts = key.split('-');
    if (parts.length >= 2) {
      const year = parts[0];
      const monthIdx = parseInt(parts[1], 10) - 1;
      if (monthIdx >= 0 && monthIdx < 12) {
        return `${MOIS_FR[monthIdx]} ${year}`;
      }
    }
    return key;
  }

  const detailRows: any[] = [];

  prestations.forEach(p => {
    const pers = personnes.find(pe => pe.id === p.personneId);
    const soc = societes.find(s => s.id === p.societeId);
    const socName = p.societeNom || soc?.nom || 'Autre Organisme';

    const montantBrut = Number(p.totalPrestation ?? p.montantTotal ?? 0);
    const ticket = Number(p.participation ?? p.ticketModerateur ?? 0);
    const charge = Number(p.montantARembourser ?? Math.max(0, montantBrut - ticket));

    let prestPaye = Math.max(Number(p.totalPaye || 0), paiementsParPrestation[p.id] || 0);

    let linesPaye = 0;
    p.lignes.forEach(l => {
      const lPaye = Math.max(l.totalPaye || 0, paiementsParLigne[l.id] || 0);
      linesPaye += lPaye;
    });
    prestPaye = Math.max(prestPaye, linesPaye);

    const prestReste = Math.max(0, charge - prestPaye);

    totalFacture += montantBrut;
    totalTicket += ticket;
    totalRemb += charge;
    totalPayeAll += prestPaye;
    totalResteAll += prestReste;

    // Regroupement Mois
    const mKey = p.date ? p.date.substring(0, 7) : 'Inconnu';
    if (!moisMap[mKey]) {
      moisMap[mKey] = {
        moisKey: mKey,
        moisLibelle: formatMoisFR(mKey),
        dossiersCount: 0,
        totalBrut: 0,
        ticket: 0,
        totalARembourser: 0,
        totalPaye: 0,
        resteARecouvrer: 0,
      };
    }
    const mm = moisMap[mKey];
    mm.dossiersCount += 1;
    mm.totalBrut += montantBrut;
    mm.ticket += ticket;
    mm.totalARembourser += charge;
    mm.totalPaye += prestPaye;
    mm.resteARecouvrer += prestReste;

    // Regroupement Société
    if (!socMap[socName]) {
      socMap[socName] = {
        nom: socName,
        dossiersCount: 0,
        totalBrut: 0,
        totalARembourser: 0,
        totalPaye: 0,
        resteARecouvrer: 0,
      };
    }
    const sm = socMap[socName];
    sm.dossiersCount += 1;
    sm.totalBrut += montantBrut;
    sm.totalARembourser += charge;
    sm.totalPaye += prestPaye;
    sm.resteARecouvrer += prestReste;

    // Ligne principale de la prestation
    detailRows.push([
      { content: p.numeroFacture, styles: { fontStyle: 'bold', textColor: [67, 56, 202] } },
      formatDate(p.date),
      socName + (p.sousSociete ? ` (${p.sousSociete})` : ''),
      (p.nomAgent || pers?.nomPrenom || ''),
      (p.matricule || pers?.matricule || ''),
      { content: formatMoney(montantBrut), styles: { fontStyle: 'bold' } },
      formatMoney(ticket),
      { content: formatMoney(charge), styles: { fontStyle: 'bold' } },
      formatMoney(prestPaye),
      { content: formatMoney(prestReste), styles: { fontStyle: 'bold', textColor: [185, 28, 28] } },
    ]);

    // Lignes d'actes
    p.lignes.forEach(l => {
      const lBrut = l.totalPrestation || 0;
      const lTicket = l.ticketModerateur ?? Math.round((p.ticketModerateur || 0) / (p.lignes.length || 1));
      const lCharge = l.montantARembourser ?? Math.max(0, lBrut - lTicket);
      const lPaye = Math.max(l.totalPaye || 0, paiementsParLigne[l.id] || 0);
      const lReste = Math.max(0, lCharge - lPaye);

      detailRows.push([
        { content: `   ↳ Acte: ${l.code}`, styles: { textColor: [100, 116, 139] } },
        { content: l.libelle || '', styles: { textColor: [100, 116, 139] } },
        '',
        '',
        '',
        { content: formatMoney(lBrut), styles: { textColor: [100, 116, 139] } },
        { content: formatMoney(lTicket), styles: { textColor: [100, 116, 139] } },
        { content: formatMoney(lCharge), styles: { textColor: [100, 116, 139] } },
        { content: formatMoney(lPaye), styles: { textColor: [100, 116, 139] } },
        { content: formatMoney(lReste), styles: { textColor: [100, 116, 139] } }
      ]);
    });
  });

  // Ligne de TOTAL GÉNÉRAL en bas de la table détaillée
  detailRows.push([
    { content: `TOTAL GÉNÉRAL (${prestations.length} Factures)`, styles: { fontStyle: 'bold', fillColor: [254, 242, 242] } },
    { content: '', styles: { fillColor: [254, 242, 242] } },
    { content: '', styles: { fillColor: [254, 242, 242] } },
    { content: '', styles: { fillColor: [254, 242, 242] } },
    { content: '', styles: { fillColor: [254, 242, 242] } },
    { content: formatMoney(totalFacture), styles: { fontStyle: 'bold', fillColor: [254, 242, 242] } },
    { content: formatMoney(totalTicket), styles: { fontStyle: 'bold', textColor: [180, 83, 9], fillColor: [254, 242, 242] } },
    { content: formatMoney(totalRemb), styles: { fontStyle: 'bold', fillColor: [254, 242, 242] } },
    { content: formatMoney(totalPayeAll), styles: { fontStyle: 'bold', textColor: [4, 120, 87], fillColor: [254, 242, 242] } },
    { content: formatMoney(totalResteAll), styles: { fontStyle: 'bold', textColor: [185, 28, 28], fillColor: [254, 242, 242] } },
  ]);

  // CARTOUCHES KPIS
  const cardY = 38;
  const cardH = 18;
  const cardW = 64;

  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(254, 202, 202);
  doc.roundedRect(14, cardY, cardW, cardH, 2, 2, 'FD');
  doc.setTextColor(153, 27, 27);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('RESTE À RECOUVRER (SÉLECTION)', 18, cardY + 5.5);
  doc.setFontSize(13);
  doc.text(formatMoney(totalResteAll), 18, cardY + 13);

  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(82, cardY, cardW, cardH, 2, 2, 'FD');
  doc.setTextColor(51, 65, 85);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL FACTURÉ BRUT', 86, cardY + 5.5);
  doc.setFontSize(12);
  doc.text(formatMoney(totalFacture), 86, cardY + 13);

  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(150, cardY, cardW, cardH, 2, 2, 'FD');
  doc.setTextColor(4, 120, 87);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('DÉJÀ RÉGLÉ', 154, cardY + 5.5);
  doc.setFontSize(12);
  doc.text(formatMoney(totalPayeAll), 154, cardY + 13);

  doc.setFillColor(238, 242, 255);
  doc.setDrawColor(199, 210, 254);
  doc.roundedRect(218, cardY, cardW, cardH, 2, 2, 'FD');
  doc.setTextColor(67, 56, 202);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('DOSSIERS SÉLECTIONNÉS', 222, cardY + 5.5);
  doc.setFontSize(12);
  doc.text(`${prestations.length} factures`, 222, cardY + 13);

  let currentY = 60;

  // 1. RÉCAPITULATIF MENSUEL DES IMPAYÉS SUR LA PREMIÈRE PAGE
  const parMois = Object.values(moisMap).sort((a, b) => b.moisKey.localeCompare(a.moisKey));
  if (parMois.length > 0) {
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('1. Récapitulatif Mensuel des Impayés & Créances (Sélection)', 14, currentY);

    const moisHeaders = [
      'Mois / Période',
      'Factures',
      'Total Facturé',
      'Ticket Mod.',
      'Charge Assureur',
      'Déjà Réglé',
      'Solde Impayé (Reste à Recouvrer)'
    ];

    const moisRows = parMois.map(m => [
      m.moisLibelle,
      String(m.dossiersCount),
      formatMoney(m.totalBrut),
      formatMoney(m.ticket),
      formatMoney(m.totalARembourser),
      formatMoney(m.totalPaye),
      formatMoney(m.resteARecouvrer)
    ]);

    // TOTAL GÉNÉRAL en bas du tableau mensuel
    moisRows.push([
      'TOTAL GÉNÉRAL',
      String(prestations.length),
      formatMoney(totalFacture),
      formatMoney(totalTicket),
      formatMoney(totalRemb),
      formatMoney(totalPayeAll),
      formatMoney(totalResteAll)
    ]);

    autoTable(doc, {
      startY: currentY + 3,
      head: [moisHeaders],
      body: moisRows,
      theme: 'grid',
      headStyles: {
        fillColor: [185, 28, 28],
        textColor: 255,
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'left',
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 1.8,
        textColor: [30, 41, 59],
      },
      columnStyles: {
        0: { fontStyle: 'bold', minCellWidth: 40 },
        1: { halign: 'center', cellWidth: 20 },
        2: { halign: 'right', cellWidth: 35 },
        3: { halign: 'right', cellWidth: 35 },
        4: { halign: 'right', cellWidth: 38 },
        5: { halign: 'right', cellWidth: 38, textColor: [4, 120, 87] },
        6: { halign: 'right', cellWidth: 45, fontStyle: 'bold', textColor: [185, 28, 28] },
      },
      didParseCell: (hookData) => {
        if (hookData.section === 'body' && hookData.row.index === moisRows.length - 1) {
          hookData.cell.styles.fontStyle = 'bold';
          hookData.cell.styles.fillColor = [254, 242, 242];
        }
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 7;
  }

  // 2. VENTILATION PAR ORGANISME SUR LA PREMIÈRE PAGE
  const parSociete = Object.values(socMap).sort((a, b) => b.resteARecouvrer - a.resteARecouvrer);
  if (parSociete.length > 0 && currentY < 160) {
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('2. Ventilation par Organisme / Assurance (Sélection)', 14, currentY);

    const recapHeaders = [
      'Organisme / Assurance',
      'Dossiers',
      'Total Facturé',
      'Charge Assureur',
      'Déjà Réglé',
      'Reste Dû'
    ];

    const recapRows = parSociete.map(s => [
      s.nom,
      String(s.dossiersCount),
      formatMoney(s.totalBrut),
      formatMoney(s.totalARembourser),
      formatMoney(s.totalPaye),
      formatMoney(s.resteARecouvrer)
    ]);

    // TOTAL GÉNÉRAL
    recapRows.push([
      'TOTAL GÉNÉRAL',
      String(prestations.length),
      formatMoney(totalFacture),
      formatMoney(totalRemb),
      formatMoney(totalPayeAll),
      formatMoney(totalResteAll)
    ]);

    autoTable(doc, {
      startY: currentY + 3,
      head: [recapHeaders],
      body: recapRows,
      theme: 'grid',
      headStyles: {
        fillColor: [51, 65, 85],
        textColor: 255,
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'left',
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 1.8,
        textColor: [30, 41, 59],
      },
      columnStyles: {
        0: { fontStyle: 'bold', minCellWidth: 55 },
        1: { halign: 'center', cellWidth: 20 },
        2: { halign: 'right', cellWidth: 45 },
        3: { halign: 'right', cellWidth: 45 },
        4: { halign: 'right', cellWidth: 45, textColor: [4, 120, 87] },
        5: { halign: 'right', cellWidth: 50, fontStyle: 'bold', textColor: [185, 28, 28] },
      },
      didParseCell: (hookData) => {
        if (hookData.section === 'body' && hookData.row.index === recapRows.length - 1) {
          hookData.cell.styles.fontStyle = 'bold';
          hookData.cell.styles.fillColor = [254, 242, 242];
        }
      },
    });
  }

  // 3. TABLEAU DÉTAILLÉ NOMINATIF SUR LES PAGES SUIVANTES
  doc.addPage();
  currentY = 20;

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('3. Liste Nominative Détaillée des Factures & Actes Sélectionnés', 14, currentY);

  const detailHeaders = [
    'N° Facture / Code',
    'Date / Libellé Acte',
    'Organisme / Client',
    'Patient / Assuré',
    'Matricule',
    'Montant Brut',
    'Ticket Mod.',
    'Charge Assur.',
    'Déjà Payé',
    'Reste Dû'
  ];

  autoTable(doc, {
    startY: currentY + 3,
    head: [detailHeaders],
    body: detailRows,
    theme: 'grid',
    headStyles: {
      fillColor: [51, 65, 85],
      textColor: 255,
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'left',
    },
    styles: {
      fontSize: 7,
      cellPadding: 1.5,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 35 },
      2: { cellWidth: 40 },
      3: { cellWidth: 40 },
      4: { cellWidth: 20 },
      5: { halign: 'right', cellWidth: 20 },
      6: { halign: 'right', cellWidth: 20, textColor: [180, 83, 9] },
      7: { halign: 'right', cellWidth: 20 },
      8: { halign: 'right', cellWidth: 20, textColor: [4, 120, 87] },
      9: { halign: 'right', cellWidth: 20 }
    },
    didParseCell: (hookData) => {
      // Style des actes sous la prestation
      if (hookData.section === 'body' && hookData.row.raw[0]?.content?.includes('↳')) {
        hookData.cell.styles.fillColor = [248, 250, 252];
      }
      // Style de la ligne TOTAL GÉNÉRAL à la fin
      if (hookData.section === 'body' && hookData.row.index === detailRows.length - 1) {
        hookData.cell.styles.fontStyle = 'bold';
        hookData.cell.styles.fillColor = [254, 242, 242];
      }
    }
  });

  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 200, 283, 200);
    doc.text(`Document Confidentiel de Recouvrement (Sélection) • ${etablissement}`, 14, 205);
    doc.text(`Page ${i} sur ${pageCount}`, 283, 205, { align: 'right' });
  }

  const filename = `Recouvrement_Selection_Detaille_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}
