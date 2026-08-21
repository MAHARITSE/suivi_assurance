import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

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
  const str = String(val).trim().replace(/\s/g, '').replace(/,/g, '.').replace(/[^\d.-]/g, '');
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

      const ai = getGenAI();

      if (!ai) {
        return res.status(400).json({
          success: false,
          error: "Clé API Gemini non configurée. Veuillez configurer la variable GEMINI_API_KEY dans les paramètres pour activer l'extraction par Intelligence Artificielle."
        });
      }

      try {
        const mimeType = file.mimetype || (file.originalname.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
        const base64Data = file.buffer.toString('base64');

        const organismGuidance = chosenOrganism
          ? `\nORGANISME D'ASSURANCE OU TIERS-PAYEUR CIBLÉ : "${chosenOrganism}".
- Assigne "${chosenOrganism}" dans le champ "clientDoit".`
          : `\nORGANISME D'ASSURANCE PRINCIPAL : Extrait le nom EXACT de la société / tiers-payeur / assurance figurant après la mention "Doit :" ou "Client :" ou "Organisme :" ou sur l'en-tête (ex: "Doit : ASCOMA" -> clientDoit = "ASCOMA"). NE FORCE PAS "MCI CARE" ou autre si le document indique "ASCOMA" ou un autre nom !`;

        const systemInstruction = `Tu es un expert comptable et actuaire spécialisé dans la numérisation et l'extraction 100% exhaustive de factures médicales et décomptes d'assurance.${organismGuidance}

RÈGLES D'EXTRACTION CRUCIALES POUR DOCUMENTS MULTI-PAGES :
1. DÉTECTION DU CLIENT (clientDoit) :
   - Inspecte attentivement l'en-tête (ex: "Doit : ASCOMA" -> clientDoit = "ASCOMA").
   - Ne remplace JAMAIS le nom extrait par un autre si un organisme précis est lisible sur la facture.

2. EXTRACTION TOTALE DE TOUTES LES PAGES SANS TRONCATURE :
   - Ce document PDF comporte PLUSIEURS PAGES (Page 1, Page 2, Page 3, Page 4, Page 5, Page 6...).
   - Tu DOIS parcourir CHAQUE PAGE et extraire LA TOTALITÉ SANS EXCEPTION des lignes de prestations du N° 1 jusqu'au dernier N° du document (ex: N° 1 à 128 ou plus).
   - Ne te limite JAMAIS aux 10 premières lignes. Extrait absolument TOUS les patients de la première à la dernière page.

3. DÉTAILS DES LIGNES :
   - "numeroLigne" : Numéro séquentiel (1, 2, 3... 128).
   - "dateSoins" : Date des soins au format YYYY-MM-DD.
   - "matricule" : Mlle ou Matricule (ex: "1086748", "821", "JR741").
   - "nomPrenom" : Nom complet et prénom du patient.
   - "societeAffiliee" : Nom de la société d'assurance (ex: "ASCOMA").
   - "sousSociete" : Entreprise/employeur figurant entre parenthèses sous le nom (ex: "COPEFRITO", "ERG MADAGASCAR", "GIZ", "BLUE VENTURES", "ANKA MADAGASCAR").
   - "actes" : Liste des actes médicales/prix (ex: CONS, MEDIC, LABO, HOSP, etc.).
   - "montantBrut", "participation", "netAPayer".

4. FORMAT JSON : Réponds STRICTEMENT en JSON conforme au schéma.`;

        const promptText = `Analyse l'intégralité de ce document PDF multi-pages (${chosenDocType || 'facture médicale SALFA'}). Extrait CHAQUE ligne de prestation de la page 1 jusqu'à la fin (jusqu'à 128+ lignes). Extrait précisément l'organisme ("Doit : ASCOMA").`;

        const invoiceSchema = {
          type: Type.OBJECT,
          properties: {
            documentType: { type: Type.STRING, description: "Type de document: 'facture' ou 'decompte'." },
            clientDoit: { type: Type.STRING, description: "Nom exact de l'organisme d'assurance ou tiers payeur (ex: ASCOMA)" },
            garant: { type: Type.STRING, description: "Nom du souscripteur ou garant" },
            etablissement: { type: Type.STRING, description: "Nom de l'établissement prestataire (ex: HOPITALY LOTERANA TOLIARY TANAMBAO)" },
            numeroFacture: { type: Type.STRING, description: "Numéro de facture ou référence (ex: FA-03/ASC/25-002)" },
            numeroBordereau: { type: Type.STRING },
            moisPriseEnCharge: { type: Type.STRING, description: "Mois de prise en charge (ex: Mars 2025)" },
            dateEmission: { type: Type.STRING, description: "Date d'émission YYYY-MM-DD" },
            dateComptable: { type: Type.STRING },
            banqueReglement: { type: Type.STRING },
            rib: { type: Type.STRING },
            nombreTotalLignes: { type: Type.INTEGER, description: "Nombre total exact de lignes dans le document (ex: 128)" },
            totalMontantBrut: { type: Type.NUMBER },
            totalExclu: { type: Type.NUMBER },
            totalBaseReglement: { type: Type.NUMBER },
            totalParticipation: { type: Type.NUMBER },
            totalNetAPayer: { type: Type.NUMBER },
            remise: { type: Type.NUMBER },
            sommeLettres: { type: Type.STRING },
            lignes: {
              type: Type.ARRAY,
              description: "TOUTES les lignes de prestations extraites de toutes les pages du document sans omission.",
              items: {
                type: Type.OBJECT,
                properties: {
                  numeroLigne: { type: Type.INTEGER },
                  dateSoins: { type: Type.STRING, description: "Date des soins au format YYYY-MM-DD" },
                  matricule: { type: Type.STRING, description: "Matricule Mlle" },
                  nomPrenom: { type: Type.STRING, description: "Nom complet du patient / soigné" },
                  ayantDroit: { type: Type.STRING },
                  societeAffiliee: { type: Type.STRING, description: "Société d'assurance (ex: ASCOMA)" },
                  sousSociete: { type: Type.STRING, description: "Entreprise entre parenthèses (ex: COPEFRITO)" },
                  prestataireNom: { type: Type.STRING },
                  numeroFactureOrigine: { type: Type.STRING },
                  actes: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        code: { type: Type.STRING, description: "Code de l'acte (CONS, MEDIC, LABO, DENT, HOSP, RADI, ECHO, SOINS)" },
                        libelle: { type: Type.STRING, description: "Libellé de l'acte" },
                        montant: { type: Type.NUMBER, description: "Montant individuel" }
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

        // Order models for comprehensive extraction: 3.7-flash and 3.1-pro first
        const modelsToTry = [
          { name: 'gemini-3.7-flash', versionLabel: 'Flash 3.7', useSchema: true, useThinking: true },
          { name: 'gemini-3.1-pro-preview', versionLabel: 'Pro Preview 3.1', useSchema: true, useThinking: false },
          { name: 'gemini-flash-latest', versionLabel: 'Flash Latest', useSchema: true, useThinking: false },
          { name: 'gemini-3.1-flash-lite', versionLabel: 'Flash Lite', useSchema: true, useThinking: false },
          { name: 'gemini-3.7-flash', versionLabel: 'Flash 3.7 Unconstrained', useSchema: false, useThinking: false },
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

            if (candidate.useThinking) {
              configObj.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
            }

            const contentText = candidate.useSchema
              ? promptText
              : `${promptText}\n\nRetourne STRICTEMENT un objet JSON valide conforme aux champs: documentType, clientDoit, etablissement, numeroFacture, numeroBordereau, dateEmission, totalMontantBrut, totalParticipation, totalNetAPayer, nombreTotalLignes, lignes (array d'objets contenant: numeroLigne, dateSoins, matricule, nomPrenom, societeAffiliee, sousSociete, montantBrut, participation, netAPayer, actes, observations).`;

            const aiResp = await ai.models.generateContent({
              model: candidate.name,
              contents: [
                {
                  role: 'user',
                  parts: [
                    { inlineData: { mimeType, data: base64Data } },
                    { text: contentText }
                  ]
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
            await waitMs(300);
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

              // Calculate totals
              const computedBrut = sanitizedLignes.reduce((sum: number, l: any) => sum + l.montantBrut, 0);
              const computedPart = sanitizedLignes.reduce((sum: number, l: any) => sum + l.participation, 0);
              const computedNet = sanitizedLignes.reduce((sum: number, l: any) => sum + l.netAPayer, 0);

              const finalResult = {
                documentType: String(parsed.documentType || chosenDocType || 'facture').toLowerCase(),
                clientDoit: chosenOrganism || String(parsed.clientDoit || '').trim() || 'Société Inconnue',
                garant: String(parsed.garant || '').trim(),
                etablissement: String(parsed.etablissement || 'Établissement de Santé').trim(),
                numeroFacture: String(parsed.numeroFacture || parsed.numeroBordereau || `DOC-${Date.now().toString().substring(6)}`).trim(),
                numeroBordereau: String(parsed.numeroBordereau || parsed.numeroFacture || '').trim(),
                moisPriseEnCharge: String(parsed.moisPriseEnCharge || new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })).trim(),
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
        console.warn('Gemini extraction top-level error:', geminiErr?.message || geminiErr);
      }

      return res.status(500).json({ 
        success: false, 
        error: "L'extraction du document par l'IA n'a pas pu aboutir. Veuillez cliquer sur Réessayer pour relancer l'analyse." 
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
