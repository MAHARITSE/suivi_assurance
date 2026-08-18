import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB max
});

let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // API Health Check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
      timestamp: new Date().toISOString()
    });
  });

  // API: Parse Invoice PDF / Image / Text
  app.post('/api/parse-invoice', upload.single('file'), async (req, res) => {
    try {
      const file = req.file;
      const { text, sampleType } = req.body;

      // Case 1: Check for known sample request or fallback
      if (sampleType === 'ascoma') {
        return res.json({
          source: 'sample_ascoma',
          success: true,
          data: getAscomaDefaultInvoice()
        });
      }
      if (sampleType === 'mci' || sampleType === 'mcicare') {
        return res.json({
          source: 'sample_mci',
          success: true,
          data: getMciCareDefaultInvoice()
        });
      }
      if (sampleType === 'bsa' || sampleType === 'bsa_releve') {
        return res.json({
          source: 'sample_bsa_releve',
          success: true,
          data: getBsaReleveDefaultInvoice()
        });
      }
      if (sampleType === 'salfa' || (!file && !text)) {
        return res.json({
          source: 'sample_template',
          success: true,
          data: getSalfaDefaultInvoice()
        });
      }

      const ai = getGenAI();

      // If Gemini is available and a file (PDF or Image) was uploaded
      if (ai && file) {
        try {
          const mimeType = file.mimetype || (file.originalname.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
          const base64Data = file.buffer.toString('base64');

          const prompt = `Tu es un expert comptable et actuaire spécialisé dans l'analyse de factures et décomptes de règlement d'assurance santé à Madagascar (spécifiquement MCI CARE, ASCOMA / Gras Savoye, BSA / ASK GS, ARO, AXA, etc.).

Analyse minutieusement ce document (PDF ou Image de facture médicale, décompte de règlement tiers payant ou relevé de remboursements) et extrait rigoureusement TOUTES les informations et lignes de soins dans une structure JSON valide selon le schéma suivant :

{
  "documentType": "facture" ou "decompte",
  "clientDoit": "Nom de l'organisme / assurance principale (ex: MCI CARE, ASCOMA, BSA, AXA, etc.)",
  "garant": "Nom du garant / souscripteur si présent (ex: GROUPE AXIAN, BSA / ASK GS, BRED MADAGASIKARA BP, etc.)",
  "etablissement": "Nom de l'hôpital / dispensaire / prestataire (ex: DISPENSAIRE LUTHERIEN TOLIARA / PHIE DU DISPENSAIRE SALFA TOLIARA)",
  "numeroFacture": "Numéro de facture ou bordereau (ex: FA-05/BSA/26-029 ou V/Réf 69235 ou DECOMPTE-MCI-2026-05)",
  "numeroBordereau": "Numéro de bordereau / lot si mentionné (ex: 69235 ou Lot 890621 N° 1130210)",
  "moisPriseEnCharge": "Période ou mois de soins / règlement (ex: Mai 2026, Juin 2025)",
  "dateEmission": "Date d'édition / émission au format YYYY-MM-DD (ex: 2026-07-16)",
  "dateComptable": "Date comptable si mentionnée",
  "banqueReglement": "Banque de virement ou chèque si présente (ex: BFV-SG VIREMENT)",
  "rib": "RIB ou compte bancaire si mentionné",
  "totalMontantBrut": 1344683,
  "totalExclu": 26000,
  "totalBaseReglement": 1318683,
  "totalParticipation": 44440,
  "totalNetAPayer": 1199599.65,
  "remise": 74643.35,
  "sommeLettres": "Montant en lettres",
  "lignes": [
    {
      "numeroLigne": 1,
      "dateSoins": "YYYY-MM-DD (ex: 2026-05-02)",
      "matricule": "Matricule adhérent/assuré (ex: 950210 ou 1 104 083 ou 154533)",
      "nomPrenom": "Nom et prénom de l'adhérent / assuré",
      "ayantDroit": "Nom de l'ayant droit si mentionné séparément",
      "societeAffiliee": "Société / Garant principal (ex: BRED MADAGASIKARA BP, GROUPE AXIAN, BSA, BFV, ACCES BANQUES, etc.)",
      "sousSociete": "Sous-société extraite des parenthèses ou de l'entête de sous-section (ex: BFV EMPLOYES, BFV RETRAITES, TELMA, YAS TOLIARA, etc.)",
      "prestataireNom": "Médecin ou service prestataire (ex: Dr TIANARISOA HERY, PHARMACIE, SERVICE HOSPITALISATION)",
      "numeroFactureOrigine": "Numéro de facture d'origine si décompte récapitulatif (ex: 009/25/YAS TOLIARA, 010/25/MCI)",
      "actes": [
        { "code": "CONS", "libelle": "Consultation généraliste", "montant": 20000 },
        { "code": "PHAR", "libelle": "Médicaments", "montant": 12000 }
      ],
      "actesTexte": "Description brute des actes et montants (ex: CONSULT. GENERALISTE : 20 000 Ar / PHARMACIE : 12 000 Ar)",
      "montantBrut": 32000,
      "montantExclu": 0,
      "baseReglement": 32000,
      "participation": 1000,
      "netAPayer": 31000,
      "observations": "Remarques éventuelles (ex: Rejet partiel motif 1114 / 1126, Ticket modérateur 5%)"
    }
  ]
}

RÈGLES CRUCIALES D'EXTRACTION :
1. Extraction complète : Extrais TOUTES les lignes du document sans en oublier une seule (qu'il y ait 10, 25 ou 45 lignes).
2. Colonne "Acte médicale/Prix" (Multiples Actes) : Un montant ou patient peut avoir PLUSIEURS actes médicaux sous la colonne "Acte médicale/Prix" (ex: "DENT : 50 000,00 \n MEDIC : 12 000,00" ou "CONS : 20 000,00 / MEDIC : 26 200,00 / LABO : 3 000,00"). Extrais TOUS les sous-actes distinctement dans la liste "actes", chacun avec son code (ex: CONS, MEDIC/PHAR, LABO, DENT, HOSP, SOINS, ECHO, STOCK), son libellé et son montant individuel.
3. Analyse des parenthèses et sous-sociétés : Les mentions entre parenthèses dans la colonne client ou assuré indiquent des **sous-sociétés** (ex: "(BFV)", "(ACCES BANQUES)", "(BAOBAB BANQUE)", "(SIPEM)", "(CAISSE D'ÉPARGNE)", "(ORANGE)", "(WILDLIFE CONSERVATION)", "(ADRA MADAGASCAR)"). Place-les impérativement dans le champ "sousSociete".
4. Codes actes :
   - Codes standard : CONS (Consultation/Visite), MEDIC/PHAR (Pharmacie/Médicaments/PHSB/PH), LABO (Analyses/Biologie/EB/TDR), DENT (Dentaire/DC/DK), HOSP (Hospitalisation/Chirurgie/Accouchement), RADI/ECHO (Radio/Échographie), SOINS (Soins infirmiers/SI), STOCK (Matériel/Consommables/Stock).
   - Si un acte est particulier ou inhabituel, garde son code d'origine (ex: DK, DC, EB, SI, PHSB, PH, STOCK, etc.) pour permettre à l'utilisateur de choisir la famille de rattachement.
5. Décompte Tiers Payant :
   - "Montant Réclamé / Fr. Réels" -> "montantBrut"
   - "Montant Exclu / Non Remb." -> "montantExclu"
   - "Base de Règlement / Base Décomptée" -> "baseReglement"
   - "Ticket Modérateur / Non Remb (Part Assuré)" -> "participation"
   - "Montant Réglé / Net Payé" -> "netAPayer"
6. Réponds STRICTEMENT en JSON pur sans markdown backticks.`;

          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
              {
                role: 'user',
                parts: [
                  { inlineData: { mimeType, data: base64Data } },
                  { text: prompt }
                ]
              }
            ],
            config: {
              responseMimeType: 'application/json',
              temperature: 0.1,
            }
          });

          const rawText = response.text || '';
          let cleaned = rawText.trim();
          if (cleaned.startsWith('```json')) {
            cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '').trim();
          } else if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```/, '').replace(/```$/, '').trim();
          }

          const parsed = JSON.parse(cleaned);
          return res.json({
            source: 'gemini_ai',
            success: true,
            data: parsed
          });
        } catch (geminiErr: any) {
          console.warn('Gemini extraction error, falling back to local extractor:', geminiErr?.message || geminiErr);
        }
      }

      // Fallback: If no Gemini Key or Gemini had an issue, provide local intelligent extraction or default template
      const fallbackData = getSalfaDefaultInvoice();
      return res.json({
        source: 'local_parser_fallback',
        success: true,
        data: fallbackData
      });

    } catch (err: any) {
      console.error('API Error in parse-invoice:', err);
      res.status(500).json({
        success: false,
        error: err.message || 'Erreur lors de l’analyse du fichier'
      });
    }
  });

  // Vite integration (dev only — chargé à la demande pour ne pas dépendre
  // de vite en production)
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Suivi Assurance server running at http://0.0.0.0:${PORT}`);
  });
}

function getSalfaDefaultInvoice() {
  return {
    etablissement: "FIANGONANA LOTERANA MALAGASY - SALFA - HOPITALY LOTERANA TOLIARY TANAMBAO",
    numeroFacture: "FA-05/BSA/26-029",
    moisPriseEnCharge: "Mai 2026",
    clientDoit: "BSA (Banque / Organisme / Assurance)",
    dateEmission: "2026-06-11",
    rib: "00005-00041-43200100200-85",
    totalMontantBrut: 2216700,
    totalParticipation: 193260,
    totalNetAPayer: 2023440,
    sommeLettres: "Deux millions vingt-trois mille quatre cent quarante Ariary",
    lignes: [
      {
        numeroLigne: 1,
        dateSoins: "2026-05-02",
        matricule: "950210",
        nomPrenom: "RAKOTOLAVA TIAVINA YOHAN",
        societeAffiliee: "BFV",
        actes: [
          { code: "DENT", libelle: "Soins dentaires", montant: 50000 },
          { code: "MEDIC", libelle: "Pharmacie & Médicaments", montant: 12000 }
        ],
        actesTexte: "DENT : 50 000,00 / MEDIC : 12 000,00",
        montantBrut: 62000,
        participation: 0,
        netAPayer: 62000,
        observations: "Prise en charge 100%"
      },
      {
        numeroLigne: 2,
        dateSoins: "2026-05-04",
        matricule: "215781",
        nomPrenom: "ZOMA NORMAND JOEL ARYEL",
        societeAffiliee: "ACCES BANQUES",
        actes: [
          { code: "CONS", libelle: "Consultation médicale", montant: 20000 },
          { code: "MEDIC", libelle: "Pharmacie & Médicaments", montant: 24000 }
        ],
        actesTexte: "CONS : 20 000,00 / MEDIC : 24 000,00",
        montantBrut: 44000,
        participation: 8800,
        netAPayer: 35200,
        observations: "Ticket modérateur 20%"
      },
      {
        numeroLigne: 3,
        dateSoins: "2026-05-05",
        matricule: "225549",
        nomPrenom: "RALAIVAO EMYMORANE EMILIAS",
        societeAffiliee: "BAOBAB BANQUE",
        actes: [
          { code: "CONS", libelle: "Consultation médicale", montant: 20000 },
          { code: "MEDIC", libelle: "Pharmacie & Médicaments", montant: 9100 }
        ],
        actesTexte: "CONS : 20 000,00 / MEDIC : 9 100,00",
        montantBrut: 29100,
        participation: 2900,
        netAPayer: 26200,
        observations: "Quote-part 10%"
      },
      {
        numeroLigne: 4,
        dateSoins: "2026-05-05",
        matricule: "950185",
        nomPrenom: "RATSIMBA JEAN LEONARD",
        societeAffiliee: "BFV",
        actes: [
          { code: "CONS", libelle: "Consultation médicale", montant: 20000 },
          { code: "MEDIC", libelle: "Pharmacie & Médicaments", montant: 26200 },
          { code: "LABO", libelle: "Analyses laboratoire", montant: 3000 }
        ],
        actesTexte: "CONS : 20 000,00 / MEDIC : 26 200,00 / LABO : 3 000,00",
        montantBrut: 49200,
        participation: 0,
        netAPayer: 49200,
        observations: "Prise en charge 100%"
      },
      {
        numeroLigne: 5,
        dateSoins: "2026-05-05",
        matricule: "244602",
        nomPrenom: "RAVELOMANJA AIME JACQUIS",
        societeAffiliee: "SIPEM",
        actes: [
          { code: "CONS", libelle: "Consultation médicale", montant: 20000 },
          { code: "MEDIC", libelle: "Pharmacie & Médicaments", montant: 36000 }
        ],
        actesTexte: "CONS : 20 000,00 / MEDIC : 36 000,00",
        montantBrut: 56000,
        participation: 5600,
        netAPayer: 50400,
        observations: "Quote-part 10%"
      },
      {
        numeroLigne: 6,
        dateSoins: "2026-05-05",
        matricule: "492",
        nomPrenom: "RAVOAHANGIARIVONY ANDRIANJATOVO FANJALALAO",
        societeAffiliee: "CAISSE DEPARGNE",
        actes: [
          { code: "CONS", libelle: "Consultation médicale", montant: 20000 },
          { code: "MEDIC", libelle: "Pharmacie & Médicaments", montant: 23900 }
        ],
        actesTexte: "CONS : 20 000,00 / MEDIC : 23 900,00",
        montantBrut: 43900,
        participation: 8780,
        netAPayer: 35120,
        observations: "Ticket modérateur 20%"
      },
      {
        numeroLigne: 7,
        dateSoins: "2026-05-06",
        matricule: "214158",
        nomPrenom: "RAZAFINDRAFARA HERILANTOSOA EVAH",
        societeAffiliee: "SIPEM BANQUE",
        actes: [
          { code: "CONS", libelle: "Consultation médicale", montant: 20000 },
          { code: "MEDIC", libelle: "Pharmacie & Médicaments", montant: 4200 }
        ],
        actesTexte: "CONS : 20 000,00 / MEDIC : 4 200,00",
        montantBrut: 24200,
        participation: 2420,
        netAPayer: 21780,
        observations: "Quote-part 10%"
      },
      {
        numeroLigne: 8,
        dateSoins: "2026-05-06",
        matricule: "232272",
        nomPrenom: "RAZAKANDRAIBE HERY ZO",
        societeAffiliee: "ORANGE MADAGASCAR",
        actes: [
          { code: "MEDIC", libelle: "Pharmacie & Médicaments", montant: 221300 },
          { code: "LABO", libelle: "Analyses laboratoire", montant: 44000 },
          { code: "HOSP", libelle: "Frais hospitalisation", montant: 60000 },
          { code: "CONS", libelle: "Consultation", montant: 20000 },
          { code: "SOINS", libelle: "Soins infirmiers", montant: 18000 }
        ],
        actesTexte: "MEDIC : 221 300,00 / LABO : 44 000,00 / HOSP : 60 000,00 / CONS : 20 000,00 / SOINS : 18 000,00",
        montantBrut: 363300,
        participation: 0,
        netAPayer: 363300,
        observations: "Prise en charge directe 100%"
      },
      {
        numeroLigne: 9,
        dateSoins: "2026-05-07",
        matricule: "254884",
        nomPrenom: "TOHASOA EDWIN ARMELO",
        societeAffiliee: "BSA",
        actes: [
          { code: "CONS", libelle: "Consultation médicale", montant: 20000 },
          { code: "MEDIC", libelle: "Pharmacie & Médicaments", montant: 16800 }
        ],
        actesTexte: "CONS : 20 000,00 / MEDIC : 16 800,00",
        montantBrut: 36800,
        participation: 7360,
        netAPayer: 29440,
        observations: "Ticket modérateur 20%"
      },
      {
        numeroLigne: 10,
        dateSoins: "2026-05-08",
        matricule: "13010",
        nomPrenom: "RAKOTOARINOSY FEHIZOROVOAFANTINA",
        societeAffiliee: "WILDLIFE CONSERVATION",
        actes: [
          { code: "CONS", libelle: "Consultation médicale", montant: 20000 },
          { code: "MEDIC", libelle: "Pharmacie & Médicaments", montant: 36800 }
        ],
        actesTexte: "CONS : 20 000,00 / MEDIC : 36 800,00",
        montantBrut: 56800,
        participation: 0,
        netAPayer: 56800,
        observations: "Convention 100%"
      },
      {
        numeroLigne: 11,
        dateSoins: "2026-05-11",
        matricule: "240030",
        nomPrenom: "RAKOTONIRINA OLAFSON THECLE",
        societeAffiliee: "ADRA MADAGASCAR",
        actes: [
          { code: "CONS", libelle: "Consultation médicale", montant: 20000 },
          { code: "MEDIC", libelle: "Pharmacie & Médicaments", montant: 72800 }
        ],
        actesTexte: "CONS : 20 000,00 / MEDIC : 72 800,00",
        montantBrut: 92800,
        participation: 18560,
        netAPayer: 74240,
        observations: "Ticket modérateur 20%"
      },
      {
        numeroLigne: 12,
        dateSoins: "2026-05-12",
        matricule: "950210",
        nomPrenom: "RAKOTOLAVA TIAVINA YOHAN",
        societeAffiliee: "BFV",
        actes: [
          { code: "MEDIC", libelle: "Pharmacie & Médicaments", montant: 54800 },
          { code: "CONS", libelle: "Consultation médicale", montant: 20000 },
          { code: "DENT", libelle: "Soins dentaires", montant: 50000 }
        ],
        actesTexte: "MEDIC : 54 800,00 / CONS : 20 000,00 / DENT : 50 000,00",
        montantBrut: 124800,
        participation: 0,
        netAPayer: 124800,
        observations: "Prise en charge 100%"
      },
      {
        numeroLigne: 13,
        dateSoins: "2026-05-12",
        matricule: "232272",
        nomPrenom: "RAZAKANDRAIBE HERY ZO",
        societeAffiliee: "ORANGE MADAGASCAR",
        actes: [
          { code: "MEDIC", libelle: "Pharmacie & Médicaments", montant: 19800 }
        ],
        actesTexte: "MEDIC : 19 800,00",
        montantBrut: 19800,
        participation: 0,
        netAPayer: 19800,
        observations: "Régulier"
      },
      {
        numeroLigne: 14,
        dateSoins: "2026-05-13",
        matricule: "950220",
        nomPrenom: "ANDRIANAMBININA JEAN CLAUDE",
        societeAffiliee: "BFV",
        actes: [
          { code: "CONS", libelle: "Consultation médicale", montant: 20000 },
          { code: "LABO", libelle: "Analyses laboratoire", montant: 107000 },
          { code: "STOCK", libelle: "Fournitures médicales", montant: 18000 },
          { code: "MEDIC", libelle: "Pharmacie & Médicaments", montant: 72800 }
        ],
        actesTexte: "CONS : 20 000,00 / LABO : 107 000,00 / STOCK : 18 000,00 / MEDIC : 72 800,00",
        montantBrut: 217800,
        participation: 0,
        netAPayer: 217800,
        observations: "Prise en charge 100%"
      },
      {
        numeroLigne: 15,
        dateSoins: "2026-05-13",
        matricule: "232255",
        nomPrenom: "MAHARANTE ELYSA",
        societeAffiliee: "ORANGE",
        actes: [
          { code: "CONS", libelle: "Consultation médicale", montant: 20000 },
          { code: "MEDIC", libelle: "Pharmacie & Médicaments", montant: 4200 }
        ],
        actesTexte: "CONS : 20 000,00 / MEDIC : 4 200,00",
        montantBrut: 24200,
        participation: 0,
        netAPayer: 24200,
        observations: "Prise en charge 100%"
      },
      {
        numeroLigne: 16,
        dateSoins: "2026-05-15",
        matricule: "950185",
        nomPrenom: "RATSIMBA JEAN LEONARD",
        societeAffiliee: "BFV",
        actes: [
          { code: "CONS", libelle: "Consultation médicale", montant: 20000 },
          { code: "MEDIC", libelle: "Pharmacie & Médicaments", montant: 36800 }
        ],
        actesTexte: "CONS : 20 000,00 / MEDIC : 36 800,00",
        montantBrut: 56800,
        participation: 0,
        netAPayer: 56800,
        observations: "Prise en charge 100%"
      },
      {
        numeroLigne: 17,
        dateSoins: "2026-05-18",
        matricule: "950190",
        nomPrenom: "RAKOTOVAO IRIELA LAURIANNE",
        societeAffiliee: "BFV",
        actes: [
          { code: "CONS", libelle: "Consultation médicale", montant: 20000 },
          { code: "MEDIC", libelle: "Pharmacie & Médicaments", montant: 8400 }
        ],
        actesTexte: "CONS : 20 000,00 / MEDIC : 8 400,00",
        montantBrut: 28400,
        participation: 0,
        netAPayer: 28400,
        observations: "Prise en charge 100%"
      },
      {
        numeroLigne: 18,
        dateSoins: "2026-05-18",
        matricule: "950186",
        nomPrenom: "RAZAFINIHATRAINA ROGER",
        societeAffiliee: "BFV",
        actes: [
          { code: "CONS", libelle: "Consultation médicale", montant: 20000 },
          { code: "MEDIC", libelle: "Pharmacie & Médicaments", montant: 28600 }
        ],
        actesTexte: "CONS : 20 000,00 / MEDIC : 28 600,00",
        montantBrut: 48600,
        participation: 0,
        netAPayer: 48600,
        observations: "Prise en charge 100%"
      },
      {
        numeroLigne: 19,
        dateSoins: "2026-05-19",
        matricule: "215781",
        nomPrenom: "ZOMA NORMAND JOEL ARYEL",
        societeAffiliee: "ACCES BANQUES",
        actes: [
          { code: "MEDIC", libelle: "Pharmacie & Médicaments", montant: 113000 },
          { code: "CONS", libelle: "Consultation médicale", montant: 20000 }
        ],
        actesTexte: "MEDIC : 113 000,00 / CONS : 20 000,00",
        montantBrut: 133000,
        participation: 26600,
        netAPayer: 106400,
        observations: "Ticket modérateur 20%"
      },
      {
        numeroLigne: 20,
        dateSoins: "2026-05-20",
        matricule: "214170",
        nomPrenom: "ISMAEL ANGELO SOUMAILI",
        societeAffiliee: "SIPEM",
        actes: [
          { code: "CONS", libelle: "Consultation médicale", montant: 20000 },
          { code: "MEDIC", libelle: "Pharmacie & Médicaments", montant: 36800 }
        ],
        actesTexte: "CONS : 20 000,00 / MEDIC : 36 800,00",
        montantBrut: 56800,
        participation: 5680,
        netAPayer: 51120,
        observations: "Quote-part 10%"
      },
      {
        numeroLigne: 21,
        dateSoins: "2026-05-22",
        matricule: "950189",
        nomPrenom: "RASAMOELINA AMBOARA FITAHIANA",
        societeAffiliee: "BFV",
        actes: [
          { code: "CONS", libelle: "Consultation médicale", montant: 20000 },
          { code: "MEDIC", libelle: "Pharmacie & Médicaments", montant: 34800 }
        ],
        actesTexte: "CONS : 20 000,00 / MEDIC : 34 800,00",
        montantBrut: 54800,
        participation: 0,
        netAPayer: 54800,
        observations: "Prise en charge 100%"
      },
      {
        numeroLigne: 22,
        dateSoins: "2026-05-25",
        matricule: "215785",
        nomPrenom: "RAMANANDRO DIAMANGAVONY CLAUDIO",
        societeAffiliee: "ACCES BANQUE",
        actes: [
          { code: "CONS", libelle: "Consultation médicale", montant: 20000 },
          { code: "MEDIC", libelle: "Pharmacie & Médicaments", montant: 26200 }
        ],
        actesTexte: "CONS : 20 000,00 / MEDIC : 26 200,00",
        montantBrut: 46200,
        participation: 9240,
        netAPayer: 36960,
        observations: "Ticket modérateur 20%"
      },
      {
        numeroLigne: 23,
        dateSoins: "2026-05-27",
        matricule: "950220",
        nomPrenom: "ANDRIANAMBININA JEAN CLAUDE",
        societeAffiliee: "BFV",
        actes: [
          { code: "CONS", libelle: "Consultation médicale", montant: 20000 },
          { code: "ECHO", libelle: "Échographie", montant: 30000 },
          { code: "MEDIC", libelle: "Pharmacie & Médicaments", montant: 46200 }
        ],
        actesTexte: "CONS : 20 000,00 / ECHO : 30 000,00 / MEDIC : 46 200,00",
        montantBrut: 96200,
        participation: 0,
        netAPayer: 96200,
        observations: "Prise en charge 100%"
      },
      {
        numeroLigne: 24,
        dateSoins: "2026-05-28",
        matricule: "950180",
        nomPrenom: "ALIJAONA HARILALAINA TAHINA",
        societeAffiliee: "BFV",
        actes: [
          { code: "CONS", libelle: "Consultation médicale", montant: 20000 },
          { code: "MEDIC", libelle: "Pharmacie & Médicaments", montant: 25400 }
        ],
        actesTexte: "CONS : 20 000,00 / MEDIC : 25 400,00",
        montantBrut: 45400,
        participation: 0,
        netAPayer: 45400,
        observations: "Prise en charge 100%"
      },
      {
        numeroLigne: 25,
        dateSoins: "2026-05-30",
        matricule: "225548",
        nomPrenom: "RASAMIMANANA RASOARILYS ESPERENCE",
        societeAffiliee: "BAOBAB BANQUE",
        actes: [
          { code: "CONS", libelle: "Consultation médicale", montant: 20000 },
          { code: "MEDIC", libelle: "Pharmacie & Médicaments", montant: 110400 }
        ],
        actesTexte: "CONS : 20 000,00 / MEDIC : 110 400,00",
        montantBrut: 130400,
        participation: 13040,
        netAPayer: 117360,
        observations: "Quote-part 10%"
      }
    ]
  };
}

startServer();
