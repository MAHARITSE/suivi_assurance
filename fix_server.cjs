const fs = require('fs');
const path = 'server.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "const candidateModels = ['gemini-3.7-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];",
  "const candidateModels = ['gemini-2.5-pro', 'gemini-2.0-pro-exp-02-05', 'gemini-1.5-pro', 'gemini-2.5-flash'];"
);

code = code.replace(
  "responseMimeType: 'application/json',",
  "responseMimeType: 'application/json',\n                  maxOutputTokens: 32768,"
);

code = code.replace(
  /Tu es un expert comptable et actuaire spécialisé dans l'analyse de factures[\s\S]*?2\. Colonne "Acte médicale\/Prix"/,
  \`Tu es un expert comptable et actuaire spécialisé dans l'analyse de factures et décomptes de règlement d'assurance santé à Madagascar (spécifiquement MCI CARE, ASCOMA / Gras Savoye, BSA / ASK GS, ARO, AXA, etc.).\${organismGuidance}
Analyse minutieusement ce document (PDF ou Image) et extrait rigoureusement TOUTES les informations et lignes de soins dans une structure JSON valide selon le schéma ci-dessous.
ATTENTION : CE DOCUMENT CONTIENT SOUVENT PLUSIEURS PAGES. TU DOIS EXTRAIRE TOUTES LES LIGNES SUR TOUTES LES PAGES SANS EN OUBLIER AUCUNE. IL PEUT Y AVOIR PLUS DE 100 PATIENTS, C'EST NORMAL, N'ARRÊTE PAS L'EXTRACTION TANT QUE TOUTES LES PAGES NE SONT PAS ANALYSÉES.

{
  "documentType": "facture" ou "decompte",
  "clientDoit": "Nom de l'organisme / assurance principale",
  "etablissement": "Nom de l'hôpital",
  "numeroFacture": "Numéro de facture",
  "moisPriseEnCharge": "Mois de prise en charge",
  "dateEmission": "Date d'émission au format YYYY-MM-DD",
  "totalMontantBrut": 1344683,
  "totalNetAPayer": 1199599.65,
  "lignes": [
    {
      "numeroLigne": 1,
      "dateSoins": "YYYY-MM-DD",
      "matricule": "Matricule adhérent",
      "nomPrenom": "Nom et prénom de l'adhérent / assuré",
      "ayantDroit": "Nom de l'ayant droit si mentionné séparément",
      "societeAffiliee": "Société / Garant principal",
      "sousSociete": "Sous-société extraite des parenthèses",
      "actes": [
        { "code": "CONS", "libelle": "Consultation", "montant": 20000 },
        { "code": "MEDIC", "libelle": "Pharmacie", "montant": 12000 }
      ],
      "montantBrut": 32000,
      "montantExclu": 0,
      "baseReglement": 32000,
      "participation": 1000,
      "netAPayer": 31000,
      "observations": "Remarques"
    }
  ]
}

RÈGLES CRUCIALES D'EXTRACTION :
1. Extraction complète : EXTRÉMENT IMPORTANT. Tu dois lire et extraire chaque ligne de chaque page du PDF. Ne te limite pas à la première page. S'il y a 100 lignes ou 200 lignes, extrais-les toutes. N'abrège pas.
2. Colonne "Acte médicale/Prix"\`
);

fs.writeFileSync(path, code, 'utf8');
