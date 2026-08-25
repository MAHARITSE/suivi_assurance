import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import { PDFParse } from 'pdf-parse';
import { initialSocietes, initialPersonnes, initialFamilles, initialPrestations, initialPaiements } from './src/data/initialData';

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

function detectOrganismeFromText(text: string, chosenOrg?: string): { clientDoit: string; garant?: string } {
  if (chosenOrg && chosenOrg !== 'AUTO' && chosenOrg !== 'ALL' && chosenOrg !== 'CUSTOM') {
    return { clientDoit: chosenOrg };
  }
  const t = text.toLowerCase();

  // 1. MCI CARE / SANLAMALLIANZ
  if (t.includes('mci care') || t.includes('mcicare') || t.includes('sanlamallianz') || t.includes('compagnie sanlamallianz')) {
    const garantMatch = text.match(/Garant\s*:\s*([^\n\r]+)/i);
    const garant = garantMatch ? garantMatch[1].trim() : (t.includes('sanlamallianz') ? 'COMPAGNIE SANLAMALLIANZ' : undefined);
    return { clientDoit: 'MCI CARE', garant };
  }

  // 2. BSA / ASK GS / GRAS SAVOYE
  if (t.includes('bsa / ask gs') || t.includes('bsa/ask gs') || t.includes('ask gs') || t.includes('gras savoye') || t.includes('releve de remboursements des frais de sante') || t.includes('relevé de remboursements des frais de santé')) {
    return { clientDoit: 'BSA' };
  }

  // 3. ASCOMA
  if (t.includes('ascoma') || t.includes('decompte de reglement tiers payant') || t.includes('décompte de règlement tiers payant') || (t.includes('dispensaire lutherien') && t.includes('code : 599'))) {
    return { clientDoit: 'ASCOMA' };
  }

  // 4. NY HAVANA
  if (t.includes('ny havana') || t.includes('ny-havana') || t.includes('nyhavana')) {
    return { clientDoit: 'NY HAVANA' };
  }

  // 5. SANLAM
  if (t.includes('sanlam')) {
    return { clientDoit: 'SANLAMALLIANZ' };
  }

  return { clientDoit: 'MCI CARE' };
}

function parseMciDeterministicLines(text: string, orgName: string) {
  const lines: any[] = [];
  const mciLineRegex = /(?:^|\n)\s*(\d{5,8})\s+([A-ZÀ-ÿ\s\-\.\'\/\(\)]+?)\s+(\d{2}\/\d{2}\/\d{4})\s+([A-Z0-9]{1,8})\s+(.*?)(?=\n|$)/g;
  let match;
  let idx = 0;
  while ((match = mciLineRegex.exec(text)) !== null) {
    idx++;
    const mat = match[1];
    const nom = match[2].trim();
    const dateSoins = normalizeDateStr(match[3]);
    const codeActe = match[4].trim().toUpperCase();
    const rest = match[5].trim();

    let montantBrut = 0;
    let montantExclu = 0;
    let baseReglement = 0;
    let netAPayer = 0;

    const percentParts = rest.split(/(\d{1,2}%)/);
    if (percentParts.length >= 3) {
      const beforePct = percentParts[0].trim();
      const afterPct = percentParts[2].trim();

      const numTokens = beforePct.match(/(\d{1,3}(?:\s+\d{3})*|\d+)/g) || [];
      if (numTokens.length >= 3) {
        montantBrut = parseNumeric(numTokens[0]);
        montantExclu = parseNumeric(numTokens[1]);
        baseReglement = parseNumeric(numTokens[2]);
      } else if (numTokens.length === 2) {
        montantBrut = parseNumeric(numTokens[0]);
        baseReglement = parseNumeric(numTokens[1]);
      } else if (numTokens.length === 1) {
        montantBrut = parseNumeric(numTokens[0]);
        baseReglement = montantBrut;
      }

      const afterTokens = afterPct.match(/(\d{1,3}(?:\s+\d{3})*|\d+)/g) || [];
      if (afterTokens.length > 0) {
        netAPayer = parseNumeric(afterTokens[0]);
      }
    } else {
      const numTokens = rest.match(/(\d{1,3}(?:\s+\d{3})*|\d+)/g) || [];
      if (numTokens.length >= 1) montantBrut = parseNumeric(numTokens[0]);
      if (numTokens.length >= 2) netAPayer = parseNumeric(numTokens[numTokens.length - 1]);
    }

    if (!baseReglement) baseReglement = montantBrut;
    if (!netAPayer) netAPayer = montantBrut;
    const participation = Math.max(0, montantBrut - netAPayer);

    lines.push({
      numeroLigne: idx,
      dateSoins,
      matricule: mat,
      nomPrenom: nom,
      societeAffiliee: orgName || 'MCI CARE',
      sousSociete: '',
      actes: [{ code: codeActe, libelle: codeActe, montant: montantBrut }],
      actesTexte: `${codeActe}: ${montantBrut}`,
      montantBrut,
      montantExclu,
      baseReglement,
      participation,
      netAPayer,
      observations: ''
    });
  }
  return lines;
}

function parseAscomaDeterministicLines(text: string, orgName: string) {
  const lines: any[] = [];
  const ascomaRegex = /(?:^|\n)\s*(\d{2}\/\d{2}\/\d{4})\s+([\d\s]{5,12})\s+([A-ZÀ-ÿa-z\s\-\.]+?)\s+(ANALYSE DE LABORATOIRE|PHARMACIE|CONSULT\.\s*GENERALISTE|CONSULTATION|EXAMEN|[A-Z0-9\s\.\,\-\/]{3,30}?)\s+(\d+)\s+(\d+)\s+(.*?)(?=\n|$)/g;
  let match;
  let idx = 0;
  while ((match = ascomaRegex.exec(text)) !== null) {
    idx++;
    const dateSoins = normalizeDateStr(match[1]);
    const mat = match[2].replace(/\s+/g, '').trim();
    const nom = match[3].trim();
    const codeActe = match[4].trim();
    const rest = match[7].trim();

    const amounts = rest.match(/(\d[\d\s]*,\d{2})/g) || [];
    let montantBrut = 0;
    let montantExclu = 0;
    let baseReglement = 0;
    let participation = 0;
    let netAPayer = 0;

    if (amounts.length >= 5) {
      montantBrut = parseNumeric(amounts[0]);
      montantExclu = parseNumeric(amounts[1]);
      baseReglement = parseNumeric(amounts[2]);
      participation = parseNumeric(amounts[3]);
      netAPayer = parseNumeric(amounts[4]);
    } else if (amounts.length >= 3) {
      montantBrut = parseNumeric(amounts[0]);
      participation = parseNumeric(amounts[amounts.length - 2]);
      netAPayer = parseNumeric(amounts[amounts.length - 1]);
      baseReglement = montantBrut;
    }

    lines.push({
      numeroLigne: idx,
      dateSoins,
      matricule: mat,
      nomPrenom: nom,
      societeAffiliee: orgName || 'ASCOMA',
      sousSociete: '',
      actes: [{ code: codeActe.substring(0, 10).toUpperCase(), libelle: codeActe, montant: montantBrut }],
      actesTexte: `${codeActe}: ${montantBrut}`,
      montantBrut,
      montantExclu,
      baseReglement,
      participation,
      netAPayer,
      observations: ''
    });
  }
  return lines;
}

function parseBsaDeterministicLines(text: string, orgName: string) {
  const lines: any[] = [];
  const bsaRegex = /(\d{7}-\d{1,2})\s+ADHESION:\s*(\d+)\s+([A-ZÀ-ÿ\s\-\.]+?)\s+Client:\s*([^\n\r]+)[\s\n\r]*(\d{2}\/\d{2}\/\d{4})\s+([\s\S]*?)(?=(?:\d{7}-\d{1,2}\s+ADHESION)|$)/gi;
  let m;
  let idx = 0;
  while ((m = bsaRegex.exec(text)) !== null) {
    idx++;
    const mat = m[2].trim();
    const nom = m[3].trim();
    const clientStr = m[4].trim();
    const dateSoins = normalizeDateStr(m[5]);
    const rest = m[6].trim();

    let sousSociete = '';
    const sousSocMatch = clientStr.match(/\(([^)]+)\)/);
    if (sousSocMatch) {
      sousSociete = sousSocMatch[1].trim();
    } else {
      sousSociete = clientStr;
    }

    const acteMatch = rest.match(/\b(CG|PH|ECH|EB|DC|SUP\s*90|SI)\b/i);
    const codeActe = acteMatch ? acteMatch[1].toUpperCase() : 'CG';

    const amounts = rest.match(/(\d[\d\s]*,\d{2})/g) || [];
    let montantBrut = 0;
    let montantExclu = 0;
    let participation = 0;
    let netAPayer = 0;

    if (amounts.length >= 5) {
      // BSA format with 5 amounts: [FR.REELS, NON REMB, BASE, REMB, TPG*]
      montantBrut = parseNumeric(amounts[0]);
      montantExclu = parseNumeric(amounts[1]);
      netAPayer = parseNumeric(amounts[3]);
      participation = parseNumeric(amounts[4]);
    } else if (amounts.length === 4) {
      // BSA format with 4 amounts: [FR.REELS, REMB, NON REMB, TPG*] or [FR.REELS, NON REMB, REMB, TPG*]
      montantBrut = parseNumeric(amounts[0]);
      participation = parseNumeric(amounts[3]);
      const v1 = parseNumeric(amounts[1]);
      const v2 = parseNumeric(amounts[2]);
      if (v1 >= v2 && v2 === 0) {
        netAPayer = v1;
        montantExclu = v2;
      } else {
        montantExclu = v1;
        netAPayer = v2;
      }
    } else if (amounts.length === 3) {
      // BSA format with 3 amounts: [FR.REELS, REMB, TPG*]
      montantBrut = parseNumeric(amounts[0]);
      netAPayer = parseNumeric(amounts[1]);
      participation = parseNumeric(amounts[2]);
    } else if (amounts.length >= 1) {
      montantBrut = parseNumeric(amounts[0]);
      netAPayer = amounts.length > 1 ? parseNumeric(amounts[1]) : montantBrut;
    }

    if (montantBrut === 0 && (netAPayer > 0 || participation > 0)) {
      montantBrut = netAPayer + participation + montantExclu;
    }

    lines.push({
      numeroLigne: idx,
      dateSoins,
      matricule: mat,
      nomPrenom: nom,
      societeAffiliee: orgName || 'BSA',
      sousSociete,
      actes: [{ code: codeActe, libelle: codeActe, montant: montantBrut }],
      actesTexte: `${codeActe}: ${montantBrut}`,
      montantBrut,
      montantExclu,
      baseReglement: montantBrut,
      participation,
      netAPayer: netAPayer || Math.max(0, montantBrut - participation - montantExclu),
      observations: ''
    });
  }
  return lines;
}

function parseSalfaDeterministicLines(text: string, orgName: string) {
  const lines: any[] = [];
  const rowRegex = /(?:^|\n)\s*(\d{1,3})\s+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})(?:\s+(\d{4,10}))?\s+([\s\S]*?)(?=(?:\n\s*\d{1,3}\s+\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})|(?:\n\s*Total\s+)|(?:\n\s*Arr[êe]tez)|$)/gi;
  let match;
  let idx = 0;
  while ((match = rowRegex.exec(text)) !== null) {
    idx++;
    const rowNum = parseInt(match[1], 10) || idx;
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
    const actRegex = /(CONS|MEDIC|SOINS|DENT|LABO|STOCK|HOSP|ECHO|RADI|CHIR|PHAR|CG|PH|EB|DC|SI|ECH|CD|DETAR|DSC|SUP\s*90)\s*:\s*([\d\s\u00A0\u202F]+,\d{2})/gi;
    let actMatch;
    while ((actMatch = actRegex.exec(body)) !== null) {
      const code = actMatch[1].toUpperCase().replace(/\s+/g, ' ');
      const rawMontant = actMatch[2].trim();
      const actAmt = parseNumeric(rawMontant);
      actes.push({
        code,
        libelle: code === 'CONS' || code === 'CG' ? 'Consultation' : code === 'MEDIC' || code === 'PH' ? 'Pharmacie' : code === 'SOINS' || code === 'SI' ? 'Soins' : code === 'DENT' || code === 'DC' || code === 'CD' ? 'Dentaire' : code === 'LABO' || code === 'EB' ? 'Laboratoire' : code === 'STOCK' ? 'Stock' : code === 'HOSP' ? 'Hospitalisation' : code === 'ECHO' || code === 'ECH' ? 'Échographie' : code === 'RADI' ? 'Radiologie' : code === 'CHIR' ? 'Chirurgie' : code,
        montant: actAmt
      });
    }

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

    lines.push({
      numeroLigne: rowNum,
      dateSoins,
      matricule,
      nomPrenom: patientName,
      societeAffiliee: orgName || 'MCI CARE',
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
  return lines;
}

function parseDeterministicInvoice(text: string, chosenOrganism?: string, chosenDocType?: string) {
  if (!text || text.trim().length < 20) return null;

  const orgDetection = detectOrganismeFromText(text, chosenOrganism);

  const result: any = {
    documentType: (chosenDocType || 'facture').toLowerCase(),
    clientDoit: orgDetection.clientDoit,
    garant: orgDetection.garant || '',
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
  const doitMatch = text.match(/Doit\s*:\s*([^\n\r]+)/i) || text.match(/Client\s*:\s*([^\n\r]+)/i);
  if (doitMatch && !result.clientDoit) result.clientDoit = doitMatch[1].trim();

  // Invoice Number vs Month of coverage
  const invoiceCode = extractInvoiceCode(text);
  if (invoiceCode) {
    result.numeroFacture = invoiceCode;
  } else {
    const factMatch = text.match(/Facture\s*(?:N[°o]|Num[ée]ro)?\s*[:\.]?\s*([A-Za-z0-9\/\-_\.]+)/i);
    if (factMatch && !isMonthString(factMatch[1])) {
      result.numeroFacture = factMatch[1].trim();
    }
  }

  const bordMatch = text.match(/Bordereau\s*N[°o]\s*:\s*([^\n\r]+)/i) || 
    text.match(/V\/R[ée]f\.?\s*[:\.]?\s*([0-9A-Za-z\-_]+)/i) || 
    text.match(/N[°o]\s*:\s*(\d{6,10})/i) ||
    text.match(/Lot\s*:\s*(\d{5,10})/i) ||
    text.match(/BORD-[\w\/\-]+/i);
  if (bordMatch) result.numeroBordereau = (bordMatch[1] || bordMatch[0]).trim();

  const monthRegex = /(Janvier|F[ée]vrier|Mars|Avril|Mai|Juin|Juillet|Ao[uû]t|Septembre|Octobre|Novembre|D[ée]cembre)\s+\d{4}/i;
  const moisMatch = text.match(/Mois\s*de\s*prise\s*en\s*charge\s*:\s*([^\n\r]+)/i) || text.match(monthRegex);
  if (moisMatch) {
    const rawMois = (moisMatch[1] || moisMatch[0]).trim();
    const cleanMois = (text.match(monthRegex)?.[0] || rawMois.split(/\n|Facture/i)[0]).trim();
    result.moisPriseEnCharge = cleanMois;
  }

  const etabMatch = text.match(/HOPITALY\s+LOTERANA[^\n\r]+/i) || 
    text.match(/DISPENSAIRE\s+LOTERANA[^\n\r]+/i) || 
    text.match(/DISPENSAIRE\s+LUTHERIEN[^\n\r]+/i) || 
    text.match(/SAMPAN['’]ASA\s+LOTERANA[^\n\r]+/i) || 
    text.match(/CENTRE\s+DE\s+SANTE[^\n\r]+/i);
  if (etabMatch) result.etablissement = etabMatch[0].trim();
  else result.etablissement = 'DISPENSAIRE LOTERANA SALFA TOLIARA';

  const ribMatch = text.match(/RIB\s*:\s*([0-9\-\s]+)/i) || text.match(/N[°o]\s+de\s+Compte\s*[:\.]?\s*([0-9\-\s]+)/i);
  if (ribMatch) result.rib = ribMatch[1].trim();

  const dateMatch = text.match(/(?:Toliara\s+)?le,?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i) || 
    text.match(/Edité\s+le\s+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i) ||
    text.match(/Edition\s+du\s*:\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i) ||
    text.match(/A\s*,\s*le\s+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i) ||
    text.match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/);
  if (dateMatch) result.dateEmission = normalizeDateStr(dateMatch[1]);

  const dateComptMatch = text.match(/Date\s+comptable\s*:\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
  if (dateComptMatch) result.dateComptable = normalizeDateStr(dateComptMatch[1]);

  const banqueMatch = text.match(/Banque\s*:\s*([^\n\r]+)/i);
  if (banqueMatch) result.banqueReglement = banqueMatch[1].trim();

  const remiseMatch = text.match(/Montant\s+Remise\s+([\d\s\u00A0\u202F,.]+)/i) || text.match(/Remise\s*:\s*([\d\s\u00A0\u202F,.]+)/i);
  if (remiseMatch) result.remise = parseNumeric(remiseMatch[1]);

  const sommeMatch = text.match(/Arr[êe]tez?\s+[àa]\s+la\s+somme\s+de\s*:\s*([^\n\r]+)/i) || text.match(/virement\s+de\s+([\d\s\u00A0\u202F,.]+)\s+MGA/i);
  if (sommeMatch) result.sommeLettres = sommeMatch[1].trim();

  const totalMatch = text.match(/Total\s+([\d\s\u00A0\u202F,.]+)\s+([\d\s\u00A0\u202F,.]+)\s+([\d\s\u00A0\u202F,.]+)/i) ||
    text.match(/Total\s+g[ée]n[ée]ral\s*:\s*\d+\s+\d+\s+([\d\s\u00A0\u202F,.]+)\s+([\d\s\u00A0\u202F,.]+)\s+([\d\s\u00A0\u202F,.]+)/i) ||
    text.match(/Total\s+facture\s*#?\s*:\s*[^\s]+\s+([\d\s\u00A0\u202F,.]+)\s+([\d\s\u00A0\u202F,.]+)\s+([\d\s\u00A0\u202F,.]+)/i);
  if (totalMatch) {
    const numbers = totalMatch[0].match(/(\d[\d\s\u00A0\u202F]*,\d{2})/g);
    if (numbers && numbers.length >= 3) {
      result.totalMontantBrut = parseNumeric(numbers[0]);
      result.totalParticipation = parseNumeric(numbers[1]);
      result.totalNetAPayer = parseNumeric(numbers[2]);
    }
  }

  // Multi-format extraction strategy
  let extractedLignes: any[] = [];

  if (result.clientDoit === 'MCI CARE' || text.toLowerCase().includes('mci care')) {
    extractedLignes = parseMciDeterministicLines(text, result.clientDoit);
  }

  if (extractedLignes.length === 0 && (result.clientDoit === 'ASCOMA' || text.toLowerCase().includes('ascoma') || text.toLowerCase().includes('tiers payant'))) {
    extractedLignes = parseAscomaDeterministicLines(text, result.clientDoit);
  }

  if (extractedLignes.length === 0 && (result.clientDoit === 'BSA' || text.toLowerCase().includes('bsa') || text.toLowerCase().includes('frais de sante'))) {
    extractedLignes = parseBsaDeterministicLines(text, result.clientDoit);
  }

  if (extractedLignes.length === 0) {
    extractedLignes = parseSalfaDeterministicLines(text, result.clientDoit);
  }

  result.lignes = extractedLignes;

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
          : `\nAUTO-DÉTECTION DE L'ORGANISME D'ASSURANCE / TIERS-PAYEUR :
- Si le document est un "Décompte de Règlement Tiers Payant" (avec Centre Dispensaire Lutherien Toliara, Code 599, V/Réf, ou remise 7%) -> clientDoit = "ASCOMA".
- Si le document est "BSA / ASK GS MADAGASCAR" ou "RELEVE DE REMBOURSEMENTS DES FRAIS DE SANTE" (avec Lot, N° décompte, Ordre de virement, BFV, BRED) -> clientDoit = "BSA".
- Si le document mentionne "MCI CARE MADAGASCAR" ou "DECOMPTE DE REGLEMENT FACTURES" ou "Garant: COMPAGNIE SANLAMALLIANZ" -> clientDoit = "MCI CARE" et garant = "COMPAGNIE SANLAMALLIANZ".
- Si le document mentionne "NY HAVANA" -> clientDoit = "NY HAVANA".
- Si le document mentionne "SANLAM" seul -> clientDoit = "SANLAMALLIANZ".`;

        const systemInstruction = `Tu es un expert comptable et actuaire spécialisé dans la numérisation et l'extraction 100% exhaustive de factures médicales et décomptes d'assurance à Madagascar.${organismGuidance}

FORMATS DE DÉCOMPTES ET FACTURES SUPPORTÉS :
1. FORMAT ASCOMA ("Décompte de Règlement Tiers Payant") :
   - En-tête : "Décompte de Règlement Tiers Payant", "Centre : DISPENSAIRE LUTHERIEN TOLIARA", "Code : 599", "V/Réf".
   - clientDoit : "ASCOMA".
   - Parcourt chaque tableau de prestataire (SERVICE BIOLOGIE, PHARMACIE, GENERALISTE...).
   - Colonnes : Date des Soins, Matricule Bénéficiaire, Bénéficiaire, Acte Médical, Qté, Montant Réclamé, Montant Exclu, Base de Règlement, Ticket Modérateur, Montant Réglé.
   - Récapitulatif : Extrait le Montant Net, Taux Remise (7%), Montant Remise.

2. FORMAT BSA / ASK GS ("RELEVE DE REMBOURSEMENTS DES FRAIS DE SANTE") :
   - En-tête : "BSA / ASK GS MADAGASCAR", "RELEVE DE REMBOURSEMENTS DES FRAIS DE SANTE", "Lot", "N°" (ex: 1129370), "Banque : BFV-SG VIREMENT".
   - clientDoit : "BSA".
   - numeroBordereau : Numéro de décompte (ex: "1129370" ou "861387").
   - numeroFacture : Facture N° indiquée en bas de page (ex: "FA-02/BFV/26-022").
   - sousSociete : Extrait du champ "Client: BRED MADAGASIKARA BP (BFV EMPLOYES / RETRAITES / GRADES)" -> "BRED MADAGASIKARA (BFV EMPLOYES)".
   - Colonnes : DATE, AYANT-DROIT, EXECUTANT, ACTE (CG, PH, ECH, EB, DC, SUP 90, SI), FR.REELS (montantBrut), Tx (%), REMB (netAPayer), NON REMB (montantExclu), TPG* (participation).
   - RÈGLE CRUCIALE POUR BSA : Le champ "montantBrut" correspond STRICTEMENT et SANS EXCEPTION à la valeur de la colonne "FR.REELS" (Frais Réels engagés/facturés, Montant Brut sans déduction de Ticket Modérateur ou remboursement). Ne JAMAIS mettre la valeur de REMB ou du Ticket Modérateur dans "montantBrut".
   - "netAPayer" = valeur de la colonne "REMB" (Montant Remboursé par l'assurance).
   - "participation" = valeur de la colonne "TPG*" (Ticket Modérateur / Part patient).
   - "montantExclu" = valeur de la colonne "NON REMB" (Montant non remboursé / exclu).

3. FORMAT MCI CARE / SANLAMALLIANZ ("DECOMPTE DE REGLEMENT FACTURES") :
   - En-tête : "MCI CARE MADAGASCAR", "DECOMPTE DE REGLEMENT FACTURES", "Garant: 104 COMPAGNIE SANLAMALLIANZ", "Facture #: FA-03/MCI/26-031".
   - clientDoit : "MCI CARE", garant : "COMPAGNIE SANLAMALLIANZ".
   - Colonnes : Matricule, Bénéficiaire, Date de soins, Actes (C, CD, DETAR, DSC...), Montant réclamé, Mtt non remboursé, Base décomptée, Ticket Modérateur, Montant réglé.

RÈGLES D'EXTRACTION CRUCIALES :
1. EXTRACTION TOTALE DE TOUTES LES PAGES SANS TRONCATURE :
   - Ce document comporte PLUSIEURS PAGES (Page 1, Page 2, Page 3...).
   - Tu DOIS parcourir CHAQUE PAGE et extraire LA TOTALITÉ SANS EXCEPTION des lignes de prestations du début jusqu'au dernier patient.
   - Ne te limite JAMAIS aux premières lignes. Extrait absolument TOUS les patients de la première à la dernière page.

2. DÉTAILS DES LIGNES :
   - "numeroLigne" : Numéro séquentiel (1, 2, 3...).
   - "dateSoins" : Date des soins au format YYYY-MM-DD.
   - "matricule" : Matricule de l'assuré (ex: "1 089 912" -> "1089912", "144154", "950179", ou "-").
   - "nomPrenom" : Nom complet du patient / bénéficiaire / ayant-droit.
   - "societeAffiliee" : Nom de la société d'assurance ("ASCOMA", "BSA", "MCI CARE", etc.).
   - "sousSociete" : Employeur / filiale (ex: "BRED MADAGASIKARA (BFV EMPLOYES)", "CONSERVATION INTERNATIONALE", "MAQC", etc.).
   - "actes" : Liste décomposée des actes médicaux avec "code" (CONS, MEDIC, SOINS, DENT, LABO, ECHO, etc.), "libelle", et "montant".
   - "montantBrut", "montantExclu", "participation", "netAPayer".

3. FORMAT JSON : Réponds STRICTEMENT en JSON valide.`;

        let promptText = `Analyse l'intégralité de ce document (${chosenDocType || 'décompte de règlement ou facture médicale'}).
Identifie précisément la société d'assurance (ASCOMA, BSA / ASK GS, MCI CARE / SANLAMALLIANZ, NY HAVANA) et extrait CHAQUE ligne de prestation de la page 1 jusqu'à la dernière page sans omission.
Décompose rigoureusement chaque acte médical, les matricules, les montants réclamés, montants exclus, tickets modérateurs et montants réglés.`;

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
          { name: 'gemini-2.0-flash', versionLabel: 'Gemini 2.0 Flash', useSchema: true },
          { name: 'gemini-1.5-flash', versionLabel: 'Gemini 1.5 Flash', useSchema: true },
          { name: 'gemini-1.5-pro', versionLabel: 'Gemini 1.5 Pro', useSchema: true },
          { name: 'gemini-2.0-flash', versionLabel: 'Gemini 2.0 Flash (Direct)', useSchema: false },
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

            const parts: any[] = [
              { inlineData: { mimeType, data: base64Data } },
              { text: promptText }
            ];

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

                const mBrut = parseNumeric(l.montantBrut || l.montantReclame || l.totalPrestation || l.fraisReels || l.frReels || 0);
                const mPart = parseNumeric(l.participation || l.ticketModerateur || l.partAssure || l.tpg || 0);
                const mExclu = parseNumeric(l.montantExclu || l.nonRemb || 0);
                const mNet = parseNumeric(l.netAPayer || l.montantRegle || l.montantRembourse || l.remb || 0);
                
                const finalBrut = mBrut || (mNet > 0 ? (mNet + mPart + mExclu) : 0);
                const finalNet = mNet || (finalBrut > 0 ? Math.max(0, finalBrut - mPart - mExclu) : 0);
                const mBase = parseNumeric(l.baseReglement || finalBrut);

                const actesList = Array.isArray(l.actes) && l.actes.length > 0
                  ? l.actes.map((a: any) => ({
                      code: String(a.code || 'CONS').trim().toUpperCase().substring(0, 10),
                      libelle: String(a.libelle || a.code || 'Acte de soins').trim(),
                      montant: parseNumeric(a.montant || finalBrut || finalNet)
                    }))
                  : [{
                      code: String(l.actesTexte || 'CONS').trim().toUpperCase().substring(0, 10),
                      libelle: String(l.actesTexte || 'Acte de soins').trim(),
                      montant: finalBrut || finalNet
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
                  montantBrut: finalBrut,
                  montantExclu: mExclu,
                  baseReglement: mBase,
                  participation: mPart,
                  netAPayer: finalNet,
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

  // In-memory mock store for dev preview mode (pre-loaded with database dump records)
  const devDb: Record<string, any[]> = {
    societes: [...initialSocietes],
    personnes: [...initialPersonnes],
    familles: [...initialFamilles],
    prestations: [...initialPrestations],
    paiements: [...initialPaiements]
  };

  // Support for api.php in dev preview server
  app.all('/api.php', express.json(), (req, res) => {
    const action = String(req.query.action || '');
    if (action === 'check_db' || action === 'health') {
      return res.json({
        success: true,
        data: {
          connected: true,
          database: 'suivi_assurance_salfa (Dev Sandbox)',
          message: 'Mode Développement Connecté',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (devDb[action] !== undefined) {
      if (req.method === 'GET') {
        return res.json({ success: true, data: devDb[action] });
      }
      if (req.method === 'POST') {
        const item = req.body;
        if (!item || !item.id) {
          return res.status(400).json({ success: false, error: 'Données manquantes ou id non fourni' });
        }
        const idx = devDb[action].findIndex(x => x.id === item.id);
        if (idx >= 0) {
          devDb[action][idx] = item;
        } else {
          devDb[action].unshift(item);
        }
        return res.json({ success: true, data: item });
      }
      if (req.method === 'DELETE') {
        const id = String(req.query.id || '');
        devDb[action] = devDb[action].filter(x => x.id !== id);
        return res.json({ success: true, data: { id, deleted: true } });
      }
    }

    return res.json({ success: true, data: [] });
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

