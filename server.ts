import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import { PDFParse } from 'pdf-parse';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB max
});

let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

const waitMs = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function parseNumeric(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const str = String(val).trim().replace(/[\s\u00A0\u202F]/g, '').replace(/,/g, '.').replace(/[^\d.-]/g, '');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function normalizeDateStr(dateStr: any): string {
  if (!dateStr) return '';
  const trimmed = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    let year = dmyMatch[3];
    if (year.length === 2) {
      const yr = parseInt(year, 10);
      year = yr < 70 ? `20${year}` : `19${year}`;
    }
    return `${year}-${month}-${day}`;
  }
  return trimmed;
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    const parser = new PDFParse({ data: new Uint8Array(buffer), verbosity: 0 });
    const textResult = await parser.getText();
    if (textResult && typeof textResult.text === 'string') {
      return textResult.text;
    }
  } catch (err) {
    console.warn('[PDFParse] Erreur extraction texte direct PDF:', err);
  }
  return '';
}

function isMonthString(val?: string): boolean {
  if (!val) return false;
  const trimmed = val.trim();
  return /^(Janvier|F[ée]vrier|Mars|Avril|Mai|Juin|Juillet|Ao[uû]t|Septembre|Octobre|Novembre|D[ée]cembre)(\s+\d{2,4})?$/i.test(trimmed)
    || /^(Mois\s+de\s+prise\s+en\s+charge\s*:?\s*)?(Janvier|F[ée]vrier|Mars|Avril|Mai|Juin|Juillet|Ao[uû]t|Septembre|Octobre|Novembre|D[ée]cembre)/i.test(trimmed);
}

function extractInvoiceCode(text: string): string {
  if (!text) return '';
  // Pattern 1: SALFA format e.g. FA-04/MCI/26-030 or FA-01/ASCOMA/26-001 or FA-02/BSA/26-015
  const m1 = text.match(/\b(FA[-_\s]*\d{1,4}\s*\/[A-Za-z0-9\s\-_\.]+\/\s*\d{2,4}(?:[-_\s]*\d+)?)\b/i);
  if (m1) return m1[1].replace(/\s+/g, '').trim();

  // Pattern 2: Explicit "Facture N° : XXX" where XXX is not a month name
  const m2 = text.match(/Facture\s*(?:N[°o]|Num[ée]ro)?\s*[:\.]?\s*([A-Za-z0-9\/\-_\.]+)/i);
  if (m2 && !isMonthString(m2[1])) return m2[1].trim();

  // Pattern 3: Standard FA-XXX or FACT-XXX or BORD-XXX
  const m3 = text.match(/\b(FA[-_][A-Za-z0-9\/\-_]+)\b/i) || text.match(/\b(FACT[-_][A-Za-z0-9\/\-_]+)\b/i);
  if (m3 && !isMonthString(m3[1])) return m3[1].trim();

  return '';
}

function parseDeterministicInvoice(text: string, chosenOrganism?: string, chosenDocType?: string) {
  if (!text || text.trim().length < 20) return null;

  const result: any = {
    documentType: (chosenDocType || 'facture').toLowerCase(),
    clientDoit: '',
    garant: '',
    moisPriseEnCharge: '',
    numeroFacture: '',
    numeroBordereau: '',
    etablissement: '',
    dateEmission: '',
    dateComptable: '',
    banqueReglement: '',
    rib: '',
    sommeLettres: '',
    totalMontantBrut: 0,
    totalExclu: 0,
    totalBaseReglement: 0,
    totalParticipation: 0,
    totalNetAPayer: 0,
    remise: 0,
    lignes: []
  };

  // Header extraction
  const doitMatch = text.match(/Doit\s*:\s*([^\n\r]+)/i);
  if (doitMatch) result.clientDoit = doitMatch[1].trim();
  else if (chosenOrganism) result.clientDoit = chosenOrganism;

  // Invoice Number vs Month of coverage
  const invoiceCode = extractInvoiceCode(text);
  if (invoiceCode) {
    result.numeroFacture = invoiceCode;
  } else {
    const factMatch = text.match(/Facture\s*N[°o]\s*:\s*([^\n\r]+)/i);
    if (factMatch && !isMonthString(factMatch[1])) {
      result.numeroFacture = factMatch[1].trim();
    }
  }

  const bordMatch = text.match(/Bordereau\s*N[°o]\s*:\s*([^\n\r]+)/i) || text.match(/BORD-[\w\/\-]+/i);
  if (bordMatch) result.numeroBordereau = (bordMatch[1] || bordMatch[0]).trim();

  const monthRegex = /(Janvier|F[ée]vrier|Mars|Avril|Mai|Juin|Juillet|Ao[uû]t|Septembre|Octobre|Novembre|D[ée]cembre)\s+\d{4}/i;
  const moisMatch = text.match(/Mois\s*de\s*prise\s*en\s*charge\s*:\s*([^\n\r]+)/i) || text.match(monthRegex);
  if (moisMatch) {
    const rawMois = (moisMatch[1] || moisMatch[0]).trim();
    const cleanMois = (text.match(monthRegex)?.[0] || rawMois.split(/\n|Facture/i)[0]).trim();
    result.moisPriseEnCharge = cleanMois;
  }

  const etabMatch = text.match(/HOPITALY\s+LOTERANA[^\n\r]+/i) || text.match(/SAMPAN['’]ASA\s+LOTERANA[^\n\r]+/i) || text.match(/CENTRE\s+DE\s+SANTE[^\n\r]+/i);
  if (etabMatch) result.etablissement = etabMatch[0].trim();
  else result.etablissement = 'HOPITALY LOTERANA TOLIARY TANAMBAO';

  const ribMatch = text.match(/RIB\s*:\s*([0-9\-\s]+)/i);
  if (ribMatch) result.rib = ribMatch[1].trim();

  const dateMatch = text.match(/(?:Toliara\s+)?le,?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i) || text.match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/);
  if (dateMatch) result.dateEmission = normalizeDateStr(dateMatch[1]);

  const sommeMatch = text.match(/Arr[êe]tez?\s+[àa]\s+la\s+somme\s+de\s*:\s*([^\n\r]+)/i);
  if (sommeMatch) result.sommeLettres = sommeMatch[1].trim();

  const totalMatch = text.match(/Total\s+([\d\s\u00A0\u202F,.]+)\s+([\d\s\u00A0\u202F,.]+)\s+([\d\s\u00A0\u202F,.]+)/i);
  if (totalMatch) {
    const numbers = totalMatch[0].match(/(\d[\d\s\u00A0\u202F]*,\d{2})/g);
    if (numbers && numbers.length >= 3) {
      result.totalMontantBrut = parseNumeric(numbers[0]);
      result.totalParticipation = parseNumeric(numbers[1]);
      result.totalNetAPayer = parseNumeric(numbers[2]);
    }
  }

  // Row line matcher: e.g. "1 01/04/26 ..." or "14 26/04/26 156237 ..."
  const rowRegex = /(?:^|\n)\s*(\d{1,3})\s+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})(?:\s+(\d{4,10}))?\s+([\s\S]*?)(?=(?:\n\s*\d{1,3}\s+\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})|(?:\n\s*Total\s+)|(?:\n\s*Arr[êe]tez)|$)/gi;
  
  let match;
  while ((match = rowRegex.exec(text)) !== null) {
    const rowNum = parseInt(match[1], 10);
    const dateSoins = normalizeDateStr(match[2].trim());
    let matricule = match[3] ? match[3].trim() : '-';
    let body = match[4].trim();

    const matInBody = body.match(/^(\d{5,10})\s+/);
    if (matInBody && matricule === '-') {
      matricule = matInBody[1];
      body = body.substring(matInBody[0].length).trim();
    }

    let sousSociete = '';
    const sousSocMatch = body.match(/\(([^)]+)\)/);
    if (sousSocMatch) {
      sousSociete = sousSocMatch[1].trim();
    }

    let patientName = '';
    const nameMatch = body.match(/^([A-ZÀ-ÿ\s\-\.\']+?)(?=\s*\(|\s*(?:CONS|MEDIC|SOINS|DENT|LABO|STOCK|HOSP|ECHO|RADI|CHIR|PHAR)\s*:)/i);
    if (nameMatch) {
      patientName = nameMatch[1].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    } else {
      const firstLine = body.split('\n')[0].trim();
      patientName = firstLine.replace(/\s*\([^)]*\)/g, '').trim();
    }

    const actes: Array<{ code: string; libelle: string; montant: number }> = [];
    const actRegex = /(CONS|MEDIC|SOINS|DENT|LABO|STOCK|HOSP|ECHO|RADI|CHIR|PHAR)\s*:\s*([\d\s\u00A0\u202F]+,\d{2})/gi;
    let actMatch;
    while ((actMatch = actRegex.exec(body)) !== null) {
      const code = actMatch[1].toUpperCase();
      const rawMontant = actMatch[2].trim();
      const actAmt = parseNumeric(rawMontant);
      actes.push({
        code,
        libelle: code === 'CONS' ? 'Consultation' : code === 'MEDIC' ? 'Médicaments' : code === 'SOINS' ? 'Soins' : code === 'DENT' ? 'Dentaire' : code === 'LABO' ? 'Laboratoire' : code === 'STOCK' ? 'Stock' : code === 'HOSP' ? 'Hospitalisation' : code === 'ECHO' ? 'Échographie' : code === 'RADI' ? 'Radiologie' : code === 'CHIR' ? 'Chirurgie' : code,
        montant: actAmt
      });
    }

    // Extract row amounts
    const rowAmounts = body.match(/(\d[\d\s\u00A0\u202F]*,\d{2})/g) || [];
    let montantBrut = 0;
    let participation = 0;
    let netAPayer = 0;

    if (rowAmounts.length >= actes.length + 3) {
      const totals = rowAmounts.slice(rowAmounts.length - 3);
      montantBrut = parseNumeric(totals[0]);
      participation = parseNumeric(totals[1]);
      netAPayer = parseNumeric(totals[2]);
    } else if (actes.length > 0) {
      montantBrut = actes.reduce((sum, a) => sum + a.montant, 0);
      participation = Math.round(montantBrut * 0.1);
      netAPayer = montantBrut - participation;
    }

    result.lignes.push({
      numeroLigne: rowNum,
      dateSoins,
      matricule,
      nomPrenom: patientName,
      societeAffiliee: result.clientDoit || chosenOrganism || 'MCI CARE',
      sousSociete,
      actes: actes.length > 0 ? actes : [{ code: 'CONS', libelle: 'Acte de soins', montant: montantBrut || netAPayer }],
      actesTexte: actes.length > 0 ? actes.map(a => `${a.code}: ${a.montant}`).join(' / ') : 'CONS',
      montantBrut: montantBrut || netAPayer,
      montantExclu: 0,
      baseReglement: montantBrut || netAPayer,
      participation,
      netAPayer: netAPayer || montantBrut,
      observations: ''
    });
  }

  if (result.lignes.length > 0) {
    const computedBrut = result.lignes.reduce((s: number, l: any) => s + l.montantBrut, 0);
    const computedPart = result.lignes.reduce((s: number, l: any) => s + l.participation, 0);
    const computedNet = result.lignes.reduce((s: number, l: any) => s + l.netAPayer, 0);

    result.nombreTotalLignes = result.lignes.length;
    if (!result.totalMontantBrut) result.totalMontantBrut = computedBrut;
    if (!result.totalParticipation) result.totalParticipation = computedPart;
    if (!result.totalNetAPayer) result.totalNetAPayer = computedNet;
    result.totalBaseReglement = result.totalMontantBrut;

    return result;
  }

  return null;
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

  // API: Parse Invoice / Prestations / Decompte PDF / Image
  app.post('/api/parse-invoice', upload.single('file'), async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      const file = req.file;
      const { targetOrganism, docType, insuranceType } = req.body;

      const chosenOrganism = (targetOrganism || insuranceType || '').trim();
      const chosenDocType = (docType || '').trim().toLowerCase();

      if (!file) {
        return res.status(400).json({
          success: false,
          error: "Aucun fichier n'a été transmis pour l'analyse."
        });
      }

      const mimeType = file.mimetype || (file.originalname.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
      const isPdf = mimeType.includes('pdf') || file.originalname.toLowerCase().endsWith('.pdf');

      // 1. Text extraction from PDF
      let extractedPdfText = '';
      if (isPdf) {
        extractedPdfText = await extractTextFromPdf(file.buffer);
        if (extractedPdfText && extractedPdfText.trim().length > 0) {
          console.log(`[PDFParse] Texte extrait avec succès (${extractedPdfText.length} caractères)`);
        }
      }

      // 2. Run deterministic parser on extracted text (immediate fallback and structure baseline)
      const deterministicResult = extractedPdfText ? parseDeterministicInvoice(extractedPdfText, chosenOrganism, chosenDocType) : null;
      if (deterministicResult && deterministicResult.lignes.length > 0) {
        console.log(`[Deterministic Parser] ${deterministicResult.lignes.length} lignes extraites avec succès!`);
      }

      const ai = getGenAI();

      // If no AI key is configured but deterministic parser extracted lines, return directly!
      if (!ai) {
        if (deterministicResult && deterministicResult.lignes.length > 0) {
          return res.json({
            source: 'pdf_text_parser',
            success: true,
            data: deterministicResult
          });
        }

        return res.status(400).json({
          success: false,
          error: "Clé API Gemini non configurée. Veuillez configurer la variable GEMINI_API_KEY dans les paramètres pour activer l'extraction par Intelligence Artificielle."
        });
      }

      try {
        const base64Data = file.buffer.toString('base64');

        const organismGuidance = chosenOrganism
          ? `\nORGANISME D'ASSURANCE OU TIERS-PAYEUR CIBLÉ : "${chosenOrganism}".
- Assigne "${chosenOrganism}" dans le champ "clientDoit".`
          : `\nORGANISME D'ASSURANCE PRINCIPAL : Extrait le nom EXACT de la société / tiers-payeur / assurance figurant après la mention "Doit :" ou "Client :" ou "Organisme :" ou sur l'en-tête (ex: "Doit : ASCOMA" -> clientDoit = "ASCOMA", "Doit : MCI CARE" -> clientDoit = "MCI CARE").`;

        const systemInstruction = `Tu es un expert comptable et actuaire spécialisé dans la numérisation et l'extraction 100% exhaustive de factures médicales et décomptes d'assurance.${organismGuidance}

RÈGLES D'EXTRACTION CRUCIALES :
1. NUMÉRO DE FACTURE (numeroFacture) VS MOIS DE PRISE EN CHARGE (moisPriseEnCharge) :
   - "numeroFacture" : Référence exacte du document (ex: "FA-04/MCI/26-030", "FA-01/ASCOMA/26-001", "FACT-2026-001").
   - ⚠️ RÈGLE ABSOLUE : "Avril 2026", "Mars 2026", etc. sont des MOIS DE PRISE EN CHARGE ("moisPriseEnCharge") et NE SONT JAMAIS des numéros de facture !
   - Si tu vois "Facture N° : FA-04/MCI/26-030" et "Mois de prise en charge : Avril 2026", alors numeroFacture = "FA-04/MCI/26-030" et moisPriseEnCharge = "Avril 2026".

2. DÉTECTION DU CLIENT (clientDoit) :
   - Inspecte attentivement l'en-tête (ex: "Doit : ASCOMA" -> clientDoit = "ASCOMA", "Doit : MCI CARE" -> clientDoit = "MCI CARE").
   - Ne remplace JAMAIS le nom extrait par un autre si un organisme précis est lisible sur la facture.

3. EXTRACTION TOTALE DE TOUTES LES PAGES SANS TRONCATURE :
   - Ce document comporte PLUSIEURS PAGES (Page 1, Page 2, Page 3...).
   - Tu DOIS parcourir CHAQUE PAGE et extraire LA TOTALITÉ SANS EXCEPTION des lignes de prestations du N° 1 jusqu'au dernier N° du document.
   - Ne te limite JAMAIS aux premières lignes. Extrait absolument TOUS les patients de la première à la dernière page.

4. DÉTAILS DES LIGNES :
   - "numeroLigne" : Numéro séquentiel (1, 2, 3...).
   - "dateSoins" : Date des soins au format YYYY-MM-DD.
   - "matricule" : Mlle ou Matricule (ex: "144154", "156237", ou "-").
   - "nomPrenom" : Nom complet et prénom du patient.
   - "societeAffiliee" : Nom de la société d'assurance (ex: "MCI CARE", "ASCOMA").
   - "sousSociete" : Entreprise/employeur figurant entre parenthèses sous le nom (ex: "MAQC", "CONSERVATION INTERNATIONALE", "BASE TOLIARA", "FSS", "UWS MADAGASCAR").
   - "actes" : Liste décomposée des actes médicales/prix avec "code", "libelle", et "montant" (ex: code="CONS" libelle="Consultation" montant=20000; code="MEDIC" libelle="Médicaments" montant=35000; code="SOINS"; code="DENT"; code="LABO"; code="STOCK"; code="HOSP"; code="ECHO"; code="RADI").
   - "montantBrut", "participation", "netAPayer".

5. FORMAT JSON : Réponds STRICTEMENT en JSON valide.`;

        let promptText = `Analyse l'intégralité de ce document (${chosenDocType || 'facture médicale SALFA'}). Extrait CHAQUE ligne de prestation de la page 1 jusqu'à la fin. Décompose rigoureusement chaque acte médical (CONS, MEDIC, SOINS, DENT, LABO, STOCK, HOSP, etc.), les matricules et les sous-sociétés entre parenthèses.
ATTENTION : Le numéro de facture est la référence alphanumérique comme "FA-04/MCI/26-030" et non pas le mois "Avril 2026".`;

        if (extractedPdfText && extractedPdfText.length > 50) {
          promptText += `\n\nTEXTE COMPLET EXTRAIT DU DOCUMENT :\n${extractedPdfText}`;
        }

        const invoiceSchema = {
          type: Type.OBJECT,
          properties: {
            documentType: { type: Type.STRING, description: "Type de document: 'facture' ou 'decompte'." },
            clientDoit: { type: Type.STRING, description: "Nom exact de l'organisme d'assurance ou tiers payeur" },
            garant: { type: Type.STRING },
            etablissement: { type: Type.STRING, description: "Nom de l'établissement prestataire" },
            numeroFacture: { type: Type.STRING, description: "Numéro ou code alphanumérique de facture (ex: 'FA-04/MCI/26-030'). Ne JAMAIS mettre un mois comme 'Avril 2026' ici." },
            numeroBordereau: { type: Type.STRING, description: "Numéro de bordereau si présent" },
            moisPriseEnCharge: { type: Type.STRING, description: "Mois et année de prise en charge (ex: 'Avril 2026')" },
            dateEmission: { type: Type.STRING, description: "Date d'émission YYYY-MM-DD" },
            dateComptable: { type: Type.STRING },
            banqueReglement: { type: Type.STRING },
            rib: { type: Type.STRING },
            nombreTotalLignes: { type: Type.INTEGER },
            totalMontantBrut: { type: Type.NUMBER },
            totalExclu: { type: Type.NUMBER },
            totalBaseReglement: { type: Type.NUMBER },
            totalParticipation: { type: Type.NUMBER },
            totalNetAPayer: { type: Type.NUMBER },
            remise: { type: Type.NUMBER },
            sommeLettres: { type: Type.STRING },
            lignes: {
              type: Type.ARRAY,
              description: "TOUTES les lignes de prestations extraites de toutes les pages sans omission.",
              items: {
                type: Type.OBJECT,
                properties: {
                  numeroLigne: { type: Type.INTEGER },
                  dateSoins: { type: Type.STRING },
                  matricule: { type: Type.STRING },
                  nomPrenom: { type: Type.STRING },
                  ayantDroit: { type: Type.STRING },
                  societeAffiliee: { type: Type.STRING },
                  sousSociete: { type: Type.STRING },
                  prestataireNom: { type: Type.STRING },
                  numeroFactureOrigine: { type: Type.STRING },
                  actes: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        code: { type: Type.STRING },
                        libelle: { type: Type.STRING },
                        montant: { type: Type.NUMBER }
                      },
                      required: ["code", "montant"]
                    }
                  },
                  actesTexte: { type: Type.STRING },
                  montantBrut: { type: Type.NUMBER },
                  montantExclu: { type: Type.NUMBER },
                  baseReglement: { type: Type.NUMBER },
                  participation: { type: Type.NUMBER },
                  netAPayer: { type: Type.NUMBER },
                  observations: { type: Type.STRING }
                },
                required: ["numeroLigne", "nomPrenom", "montantBrut", "netAPayer"]
              }
            }
          },
          required: ["documentType", "clientDoit", "lignes"]
        };

        let responseText = '';
        const errors: string[] = [];

        // Models to try in order of capability and availability
        const modelsToTry = [
          { name: 'gemini-2.5-flash', versionLabel: 'Gemini 2.5 Flash', useSchema: true },
          { name: 'gemini-3.7-flash', versionLabel: 'Gemini 3.7 Flash', useSchema: true },
          { name: 'gemini-2.5-pro', versionLabel: 'Gemini 2.5 Pro', useSchema: true },
          { name: 'gemini-2.5-flash', versionLabel: 'Gemini 2.5 Flash (Direct)', useSchema: false },
        ];

        let attemptCount = 0;
        for (const candidate of modelsToTry) {
          if (responseText) break;
          attemptCount++;
          try {
            console.log(`[Gemini OCR] Essai ${attemptCount}/${modelsToTry.length} (${candidate.versionLabel}: ${candidate.name})...`);
            const configObj: any = {
              systemInstruction,
              responseMimeType: 'application/json',
              temperature: 0.1,
              maxOutputTokens: 65536,
            };

            if (candidate.useSchema) {
              configObj.responseSchema = invoiceSchema;
            }

            const parts: any[] = [];
            if (!extractedPdfText || extractedPdfText.length < 500) {
              parts.push({ inlineData: { mimeType, data: base64Data } });
            }
            parts.push({ text: promptText });

            const aiResp = await ai.models.generateContent({
              model: candidate.name,
              contents: [
                {
                  role: 'user',
                  parts
                }
              ],
              config: configObj
            });

            if (aiResp.text && aiResp.text.trim()) {
              responseText = aiResp.text.trim();
              console.log(`[Gemini OCR] Succès avec ${candidate.versionLabel}`);
              break;
            }
          } catch (err: any) {
            const errMsg = err?.message || String(err);
            errors.push(`${candidate.versionLabel} (${candidate.name}): ${errMsg}`);
            console.warn(`[Gemini OCR] Échec de la tentative avec ${candidate.versionLabel}:`, errMsg);
            await waitMs(200);
          }
        }

        if (responseText) {
          let parsed: any = null;
          let cleaned = responseText.trim();
          if (cleaned.startsWith('```json')) {
            cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '').trim();
          } else if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```/, '').replace(/```$/, '').trim();
          }

          try {
            parsed = JSON.parse(cleaned);
          } catch {
            const firstBrace = cleaned.indexOf('{');
            const lastBrace = cleaned.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace > firstBrace) {
              try {
                parsed = JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
              } catch {
                parsed = null;
              }
            }
          }

          if (parsed && typeof parsed === 'object') {
            const rawLignes = Array.isArray(parsed.lignes) ? parsed.lignes : [];

            if (rawLignes.length > 0) {
              const sanitizedLignes = rawLignes.map((l: any, idx: number) => {
                let rawNom = String(l.nomPrenom || l.patient || l.nom || `Patient ${idx + 1}`).trim();
                let sousSoc = String(l.sousSociete || '').trim();

                // Extract sub-society in parentheses if present
                const parenMatch = rawNom.match(/^([^(]+)\s*\(([^)]+)\)$/);
                if (parenMatch) {
                  rawNom = parenMatch[1].trim();
                  if (!sousSoc) sousSoc = parenMatch[2].trim();
                }

                const mBrut = parseNumeric(l.montantBrut || l.montantReclame || l.totalPrestation || l.baseReglement || 0);
                const mPart = parseNumeric(l.participation || l.ticketModerateur || l.partAssure || 0);
                const mNet = parseNumeric(l.netAPayer || l.montantRegle || l.montantRembourse || (mBrut > 0 ? Math.max(0, mBrut - mPart) : 0));
                const mExclu = parseNumeric(l.montantExclu || 0);
                const mBase = parseNumeric(l.baseReglement || mBrut);

                const actesList = Array.isArray(l.actes) && l.actes.length > 0
                  ? l.actes.map((a: any) => ({
                      code: String(a.code || 'CONS').trim().toUpperCase().substring(0, 10),
                      libelle: String(a.libelle || a.code || 'Acte de soins').trim(),
                      montant: parseNumeric(a.montant || mBrut || mNet)
                    }))
                  : [{
                      code: String(l.actesTexte || 'CONS').trim().toUpperCase().substring(0, 10),
                      libelle: String(l.actesTexte || 'Acte de soins').trim(),
                      montant: mBrut || mNet
                    }];

                return {
                  numeroLigne: parseInt(String(l.numeroLigne), 10) || idx + 1,
                  dateSoins: normalizeDateStr(l.dateSoins) || normalizeDateStr(parsed.dateEmission) || new Date().toISOString().split('T')[0],
                  matricule: String(l.matricule || '-').trim(),
                  nomPrenom: rawNom,
                  ayantDroit: String(l.ayantDroit || '').trim(),
                  societeAffiliee: String(chosenOrganism || l.societeAffiliee || parsed.clientDoit || '').trim(),
                  sousSociete: sousSoc,
                  prestataireNom: String(l.prestataireNom || '').trim(),
                  numeroFactureOrigine: String(l.numeroFactureOrigine || '').trim(),
                  actes: actesList,
                  actesTexte: String(l.actesTexte || actesList.map((a: any) => `${a.code}: ${a.montant}`).join(' / ')).trim(),
                  montantBrut: mBrut || mNet,
                  montantExclu: mExclu,
                  baseReglement: mBase,
                  participation: mPart,
                  netAPayer: mNet || (mBrut > 0 ? Math.max(0, mBrut - mPart) : 0),
                  observations: String(l.observations || '').trim()
                };
              });

              // Detect invoice number vs month of coverage
              let finalFactureNum = String(parsed.numeroFacture || '').trim();
              let finalMois = String(parsed.moisPriseEnCharge || '').trim();

              // If finalFactureNum contains only month name (e.g. "Avril 2026")
              if (isMonthString(finalFactureNum)) {
                if (!finalMois || isMonthString(finalFactureNum)) {
                  finalMois = finalFactureNum;
                }
                finalFactureNum = '';
              }

              // If finalMois has the invoice code (e.g. "FA-04/MCI/26-030")
              const codeInMois = extractInvoiceCode(finalMois);
              if (codeInMois && !finalFactureNum) {
                finalFactureNum = codeInMois;
                finalMois = finalMois.replace(codeInMois, '').trim();
              }

              // Search extracted PDF text or deterministic result if still missing
              if (!finalFactureNum || isMonthString(finalFactureNum)) {
                const codeInText = extractInvoiceCode(extractedPdfText) || extractInvoiceCode(responseText) || deterministicResult?.numeroFacture;
                if (codeInText) {
                  finalFactureNum = codeInText;
                }
              }

              if (!finalMois) {
                const monthInText = (extractedPdfText || responseText || '').match(/(Janvier|F[ée]vrier|Mars|Avril|Mai|Juin|Juillet|Ao[uû]t|Septembre|Octobre|Novembre|D[ée]cembre)\s+\d{4}/i);
                if (monthInText) finalMois = monthInText[0].trim();
              }

              // If deterministic parser found more lines than Gemini, prefer the full multi-page deterministic lines
              if (deterministicResult && deterministicResult.lignes.length > sanitizedLignes.length) {
                console.log(`[Parser Merge] Le parseur direct a extrait ${deterministicResult.lignes.length} lignes vs ${sanitizedLignes.length} pour Gemini.`);
                return res.json({
                  source: 'hybrid_text_parser',
                  success: true,
                  data: {
                    ...deterministicResult,
                    clientDoit: chosenOrganism || String(parsed.clientDoit || deterministicResult.clientDoit || 'MCI CARE').trim(),
                    numeroFacture: finalFactureNum || String(deterministicResult.numeroFacture || `FA-${Date.now().toString().substring(6)}`).trim(),
                    moisPriseEnCharge: finalMois || String(deterministicResult.moisPriseEnCharge || 'Avril 2026').trim(),
                  }
                });
              }

              const computedBrut = sanitizedLignes.reduce((sum: number, l: any) => sum + l.montantBrut, 0);
              const computedPart = sanitizedLignes.reduce((sum: number, l: any) => sum + l.participation, 0);
              const computedNet = sanitizedLignes.reduce((sum: number, l: any) => sum + l.netAPayer, 0);

              const finalResult = {
                documentType: String(parsed.documentType || chosenDocType || 'facture').toLowerCase(),
                clientDoit: chosenOrganism || String(parsed.clientDoit || '').trim() || 'MCI CARE',
                garant: String(parsed.garant || '').trim(),
                etablissement: String(parsed.etablissement || 'HOPITALY LOTERANA TOLIARY TANAMBAO').trim(),
                numeroFacture: finalFactureNum || String(parsed.numeroBordereau || `FA-${Date.now().toString().substring(6)}`).trim(),
                numeroBordereau: String(parsed.numeroBordereau || finalFactureNum || '').trim(),
                moisPriseEnCharge: finalMois || new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
                dateEmission: normalizeDateStr(parsed.dateEmission) || new Date().toISOString().split('T')[0],
                dateComptable: normalizeDateStr(parsed.dateComptable) || '',
                banqueReglement: String(parsed.banqueReglement || '').trim(),
                rib: String(parsed.rib || '').trim(),
                nombreTotalLignes: sanitizedLignes.length,
                totalMontantBrut: parseNumeric(parsed.totalMontantBrut) || computedBrut,
                totalExclu: parseNumeric(parsed.totalExclu) || 0,
                totalBaseReglement: parseNumeric(parsed.totalBaseReglement) || (computedBrut - (parseNumeric(parsed.totalExclu) || 0)),
                totalParticipation: parseNumeric(parsed.totalParticipation) || computedPart,
                totalNetAPayer: parseNumeric(parsed.totalNetAPayer) || computedNet,
                remise: parseNumeric(parsed.remise) || 0,
                sommeLettres: String(parsed.sommeLettres || '').trim(),
                lignes: sanitizedLignes
              };

              return res.json({
                source: 'gemini_ai',
                success: true,
                data: finalResult
              });
            }
          }
        }

        // If Gemini failed or didn't return text, but deterministic result is available, use it!
        if (deterministicResult && deterministicResult.lignes.length > 0) {
          console.log('[Fallback] Utilisation du parseur direct de documents.');
          return res.json({
            source: 'pdf_text_parser',
            success: true,
            data: deterministicResult
          });
        }

        if (errors.length > 0) {
          const hasQuota = errors.some(e => e.includes('429') || e.includes('quota') || e.includes('RESOURCE_EXHAUSTED'));
          if (hasQuota) {
            return res.status(429).json({
              success: false,
              error: "La limite de requêtes temporaire a été atteinte. Veuillez patienter quelques instants et cliquer sur 'Réessayer l'analyse IA'."
            });
          }
        }
      } catch (geminiErr: any) {
        console.warn('Gemini extraction error:', geminiErr?.message || geminiErr);
        if (deterministicResult && deterministicResult.lignes.length > 0) {
          return res.json({
            source: 'pdf_text_parser',
            success: true,
            data: deterministicResult
          });
        }
      }

      return res.status(500).json({ 
        success: false, 
        error: "L'extraction du document n'a pas pu aboutir. Veuillez vérifier le fichier et cliquer sur Réessayer." 
      });

    } catch (err: any) {
      console.error('API Error in parse-invoice:', err);
      res.status(500).json({
        success: false,
        error: err.message || "Erreur lors de l'analyse du fichier."
      });
    }
  });

  // Explicit JSON 404 handler for unmatched /api/* calls
  app.all('/api/*all', (req, res) => {
    res.status(404).json({
      success: false,
      error: `Endpoint non trouvé: ${req.method} ${req.originalUrl}`
    });
  });

  // Global Error Handler for /api and multer errors returning JSON
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled server error:', err);
    if (res.headersSent) {
      return next(err);
    }
    res.status(500).json({
      success: false,
      error: err?.message || 'Erreur interne du serveur'
    });
  });

  // Vite integration (dev only)
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

startServer();

