const fs = require('fs');
const path = 'server.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "Analyse minutieusement ce document (PDF ou Image de facture médicale, décompte de règlement tiers payant ou relevé de remboursements) et extrait rigoureusement TOUTES les informations et lignes de soins dans une structure JSON valide selon le schéma suivant :",
  "Analyse minutieusement ce document (PDF ou Image de facture médicale, décompte de règlement tiers payant ou relevé de remboursements) et extrait rigoureusement TOUTES les informations et lignes de soins dans une structure JSON valide selon le schéma suivant.\\n!!! TRÈS IMPORTANT !!! LE DOCUMENT EST UN PDF MULTI-PAGES. TU DOIS IMPÉRATIVEMENT EXTRAIRE LES LIGNES DE TOUTES LES PAGES JUSQU'AU TOTAL FINAL. NE T'ARRÊTE PAS À LA PAGE 1 :"
);

fs.writeFileSync(path, code, 'utf8');
