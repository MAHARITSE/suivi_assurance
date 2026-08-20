const fs = require('fs');
const path = 'src/utils/recouvrementPdf.ts';
let code = fs.readFileSync(path, 'utf8');
const newExportCode = `
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
  doc.text(\`Édité le : \${dateGeneration}\`, 283, 11, { align: 'right' });

  doc.setTextColor(185, 28, 28);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('ÉTAT DE RECOUVREMENT DÉTAILLÉ (SÉLECTION)', 14, 28);

  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');
  doc.text(\`Détail des factures sélectionnées avec leurs actes médicaux\`, 14, 34);

  // Synthèse data
  let totalFacture = 0;
  let totalTicket = 0;
  let totalRemb = 0;
  let totalPayeAll = 0;
  let totalResteAll = 0;

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

  const detailRows: any[] = [];
  
  prestations.forEach(p => {
    const pers = personnes.find(pe => pe.id === p.personneId);
    const soc = societes.find(s => s.id === p.societeId);
    
    const montantBrut = Number(p.totalPrestation ?? p.montantTotal ?? 0);
    const ticket = Number(p.participation ?? p.ticketModerateur ?? 0);
    const charge = Number(p.montantARembourser ?? Math.max(0, montantBrut - ticket));
    
    let excluTotal = 0;
    
    let prestPaye = Math.max(Number(p.totalPaye || 0), paiementsParPrestation[p.id] || 0);
    
    // Check lines paye vs exclu
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

    // Ligne principale de la prestation
    detailRows.push([
      { content: p.numeroFacture, styles: { fontStyle: 'bold', textColor: [67, 56, 202] } },
      formatDate(p.date),
      (p.societeNom || soc?.nom || '') + (p.sousSociete ? \` (\${p.sousSociete})\` : ''),
      (p.nomAgent || pers?.nomPrenom || ''),
      (p.matricule || pers?.matricule || ''),
      { content: formatMoney(montantBrut), styles: { fontStyle: 'bold' } },
      formatMoney(ticket),
      { content: formatMoney(charge), styles: { fontStyle: 'bold' } },
      formatMoney(prestPaye),
      { content: formatMoney(prestReste), styles: { fontStyle: 'bold', textColor: [185, 28, 28] } },
    ]);

    // Ajouter les lignes (actes médicaux)
    p.lignes.forEach(l => {
      const lBrut = l.totalPrestation || 0;
      const lTicket = l.ticketModerateur ?? Math.round((p.ticketModerateur || 0) / (p.lignes.length || 1));
      const lCharge = l.montantARembourser ?? Math.max(0, lBrut - lTicket);
      const lPaye = Math.max(l.totalPaye || 0, paiementsParLigne[l.id] || 0);
      const lReste = Math.max(0, lCharge - lPaye);

      detailRows.push([
        { content: \`   ↳ Acte: \${l.code}\`, styles: { textColor: [100, 116, 139] } },
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
  doc.text(\`\${prestations.length} factures\`, 222, cardY + 13);

  let currentY = 60;

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
    startY: currentY,
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
      // Light gray background for act lines
      if (hookData.section === 'body' && hookData.row.raw[0]?.content?.includes('↳')) {
        hookData.cell.styles.fillColor = [248, 250, 252];
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
    doc.text(\`Document Confidentiel de Recouvrement (Sélection) • \${etablissement}\`, 14, 205);
    doc.text(\`Page \${i} sur \${pageCount}\`, 283, 205, { align: 'right' });
  }

  const filename = \`Recouvrement_Selection_Detaille_\${new Date().toISOString().split('T')[0]}.pdf\`;
  doc.save(filename);
}
`;
fs.writeFileSync(path, code + '\n' + newExportCode, 'utf8');
