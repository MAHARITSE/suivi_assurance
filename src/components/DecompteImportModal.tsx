import React, { useState, useRef, useMemo } from 'react';
import { 
  X, 
  Upload, 
  FileText, 
  Sparkles, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  Building2, 
  Receipt,
  Search,
  Check,
  Download,
  Info,
  Layers,
  ArrowRight,
  Plus,
  Link as LinkIcon,
  Link2,
  Unlink,
  ChevronRight,
  ArrowLeft,
  FileSpreadsheet,
  ScanLine,
  Calendar,
  CalendarCheck,
  Tag,
  Filter,
  ShieldCheck,
  ShieldAlert,
  Ban,
  User,
  Edit3,
  Files,
  Clock,
  FastForward
} from 'lucide-react';
import { 
  Paiement, 
  LignePaiement, 
  Prestation, 
  LignePrestation, 
  Societe, 
  Personne, 
  Famille, 
  ParsedFactureAssurance,
  FactureLigneParsed 
} from '../types';
import { formatMoney, formatDate, generateId, normalizeDateISO } from '../utils/formatters';
import { downloadDecomptesExcelTemplate } from '../utils/excelTemplates';
import { findBestMatchingSociete } from '../utils/societyMatcher';
import * as XLSX from 'xlsx';

interface DecompteImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  societes: Societe[];
  personnes: Personne[];
  prestations: Prestation[];
  familles: Famille[];
  paiements?: Paiement[];
  onSavePaiement: (newPaiement: Paiement, updatedPrestations: Prestation[], newSocietes?: Societe[], newPersonnes?: Personne[]) => void;
}

export interface MatchCandidate {
  prestationId: string;
  prestationNum: string;
  prestationDate: string;
  lignePrestationId: string;
  codeActe: string;
  libelleActe: string;
  societeId?: string;
  societeNom?: string;
  sousSociete?: string;
  personneId: string;
  personneNom: string;
  matricule: string;
  montantInitial: number;
  ticketModerateur: number;
  montantARembourser: number;
  dejaPaye: number;
  resteAPayer: number;
}

export interface SettlementRowItem {
  rowId: string;
  originalIndex: number;
  dateSoins: string;
  matricule: string;
  nomPrenom: string;
  sousSociete: string;
  actCode: string;
  actLibelle: string;
  montantBrut: number;
  montantExclu: number;
  participation: number;
  netAPayer: number;
  observations: string;
  articlesCount?: number;
  mergedArticles?: string[];
  // Matching status
  matchedCandidate: MatchCandidate | null;
  createNewPrestation: boolean;
  selected: boolean;
}

export function normalizeActFamilyCode(rawCode: string): string {
  const c = (rawCode || '').toUpperCase().trim();
  if (c.includes('PHAR') || c.includes('MEDIC') || c.includes('MED') || c === 'PH' || c.includes('PHARMACIE') || c.includes('ARTICLE') || c.includes('DROGUERIE')) return 'MEDIC';
  if (c.includes('CONS') || c.includes('CG') || c.includes('VISITE') || c.includes('GENERALISTE') || c.includes('MEDECIN') || c === 'CS') return 'CONS';
  if (c.includes('LABO') || c.includes('EB') || c.includes('ANALYSE') || c.includes('BIOLOGIE') || c.includes('TDR') || c.includes('EXAMEN') || c.includes('BIO')) return 'LABO';
  if (c.includes('DENT') || c === 'DC' || c === 'DK' || c.includes('DENTAIRE') || c.includes('ODONTO') || c.includes('EXTRACTION')) return 'DENT';
  if (c.includes('ECHO') || c.includes('RADI') || c.includes('RADIO') || c.includes('IMAG') || c.includes('ENDOSCOPIE') || c.includes('SCANNER')) return 'ECHO';
  if (c.includes('SOIN') || c === 'SI' || c.includes('PANSEMENT') || c.includes('INJECTION') || c.includes('PERFUSION') || c === 'AMI') return 'SOINS';
  if (c.includes('HOSP') || c.includes('CHIR') || c.includes('SEJOUR') || c.includes('ACCOUCHEMENT') || c.includes('MATERNITE') || c.includes('BLOC')) return 'HOSP';
  if (c.includes('STOCK')) return 'STOCK';
  return c || 'ACTE';
}

export function isRealMatricule(mat?: string | null): boolean {
  if (!mat) return false;
  const clean = mat.trim().toUpperCase();
  if (
    !clean ||
    clean === '-' ||
    clean === '--' ||
    clean === 'N/A' ||
    clean === 'NA' ||
    clean === 'NON RENSEIGNÉ' ||
    clean === 'NON RENSEIGNE' ||
    clean === 'AUCUN' ||
    clean === 'NULL' ||
    clean === 'UNDEFINED' ||
    clean === '.' ||
    clean === '0'
  ) {
    return false;
  }
  return clean.length >= 1;
}

export type ConfrontationType = 'PERFECT' | 'SAME_DATE' | 'SAME_AMOUNT' | 'VERIFY' | 'UNLINKED';

export interface ConfrontationDetails {
  type: ConfrontationType;
  isSameDate: boolean;
  isSameMontantBrut: boolean;
  isSameMontantNet: boolean;
  isSameMontant: boolean;
  diffMontantBrut: number;
  label: string;
  badgeClass: string;
  cardBorderClass: string;
  rowBorderClass: string;
  tagColor: string;
}

export function getConfrontationDetails(
  dateSoins: string,
  montantBrut: number,
  netAPayer: number,
  candidate: MatchCandidate | null,
  participation: number = 0
): ConfrontationDetails {
  if (!candidate) {
    return {
      type: 'UNLINKED',
      isSameDate: false,
      isSameMontantBrut: false,
      isSameMontantNet: false,
      isSameMontant: false,
      diffMontantBrut: 0,
      label: 'Non rattaché (Créer)',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
      cardBorderClass: 'border-slate-200 bg-slate-50/60',
      rowBorderClass: 'border-l-4 border-l-slate-300',
      tagColor: 'slate'
    };
  }

  const cleanDateSoins = (dateSoins || '').trim().substring(0, 10);
  const cleanCandDate = (candidate.prestationDate || '').trim().substring(0, 10);
  const isSameDate = Boolean(cleanDateSoins && cleanCandDate && cleanDateSoins === cleanCandDate);

  const brut = Number(montantBrut || netAPayer || 0);
  const tm = Number(participation || 0);
  const netDecompte = netAPayer || Math.max(0, brut - tm);

  const candBrut = Number(candidate.montantInitial || 0);
  const candRemb = Number(candidate.montantARembourser || 0);
  const candReste = Number(candidate.resteAPayer || 0);

  const isSameMontantBrut = Math.abs(brut - candBrut) < 2;
  const isSameMontantNet = Math.abs(netDecompte - candRemb) < 2 
    || Math.abs(netDecompte - candReste) < 2 
    || Math.abs(netDecompte - candBrut) < 2
    || (tm > 0 && Math.abs((brut - tm) - candBrut) < 2);

  const isSameMontant = isSameMontantBrut || isSameMontantNet;
  const diffMontantBrut = brut - candBrut;

  if (isSameDate && isSameMontant) {
    return {
      type: 'PERFECT',
      isSameDate,
      isSameMontantBrut,
      isSameMontantNet,
      isSameMontant,
      diffMontantBrut,
      label: isSameMontantBrut ? 'Même Date & Montant Brut' : 'Même Date & Net Conforme',
      badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold',
      cardBorderClass: 'border-emerald-300 bg-emerald-50/70',
      rowBorderClass: 'border-l-4 border-l-emerald-500 bg-emerald-50/30',
      tagColor: 'emerald'
    };
  }

  if (isSameDate && !isSameMontant) {
    return {
      type: 'SAME_DATE',
      isSameDate,
      isSameMontantBrut,
      isSameMontantNet,
      isSameMontant,
      diffMontantBrut,
      label: 'Même Date (Écart Montant)',
      badgeClass: 'bg-sky-100 text-sky-900 border-sky-300 font-semibold',
      cardBorderClass: 'border-sky-300 bg-sky-50/60',
      rowBorderClass: 'border-l-4 border-l-sky-500 bg-sky-50/20',
      tagColor: 'sky'
    };
  }

  if (!isSameDate && isSameMontant) {
    return {
      type: 'SAME_AMOUNT',
      isSameDate,
      isSameMontantBrut,
      isSameMontantNet,
      isSameMontant,
      diffMontantBrut,
      label: 'Même Montant (Date différente)',
      badgeClass: 'bg-purple-100 text-purple-900 border-purple-300 font-semibold',
      cardBorderClass: 'border-purple-300 bg-purple-50/60',
      rowBorderClass: 'border-l-4 border-l-purple-500 bg-purple-50/20',
      tagColor: 'purple'
    };
  }

  return {
    type: 'VERIFY',
    isSameDate,
    isSameMontantBrut,
    isSameMontantNet,
    isSameMontant,
    diffMontantBrut,
    label: 'À vérifier (Dates & Montants diffèrent)',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 font-medium',
    cardBorderClass: 'border-amber-300 bg-amber-50/60',
    rowBorderClass: 'border-l-4 border-l-amber-500 bg-amber-50/20',
    tagColor: 'amber'
  };
}

export const DecompteImportModal: React.FC<DecompteImportModalProps> = ({
  isOpen,
  onClose,
  societes,
  personnes,
  prestations,
  familles,
  paiements = [],
  onSavePaiement,
}) => {
  const [selectedInsurance, setSelectedInsurance] = useState<string>('');
  const [parsedDoc, setParsedDoc] = useState<ParsedFactureAssurance | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUploadedFile, setLastUploadedFile] = useState<File | null>(null);
  const [rows, setRows] = useState<SettlementRowItem[]>([]);
  const [confrontFilter, setConfrontFilter] = useState<'ALL' | 'PERFECT' | 'SAME_DATE' | 'SAME_AMOUNT' | 'VERIFY' | 'UNLINKED'>('ALL');
  const [groupOnImport, setGroupOnImport] = useState<boolean>(true);
  const [missingSocPrompt, setMissingSocPrompt] = useState<{ socName: string } | null>(null);
  const [selectedOverrideSocId, setSelectedOverrideSocId] = useState<string>('');
  const [showUnlinkedConfirmModal, setShowUnlinkedConfirmModal] = useState<boolean>(false);
  
  // Multi-File Queue Processing state
  const [fileQueue, setFileQueue] = useState<File[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = useState<number>(0);
  const [batchHistory, setBatchHistory] = useState<Array<{ fileName: string; count: number; status: 'SUCCESS' | 'SKIPPED' }>>([]);
  const [batchNotice, setBatchNotice] = useState<string | null>(null);

  // Search / Change Link modal state
  const [searchingRowId, setSearchingRowId] = useState<string | null>(null);
  const [actSearchQuery, setActSearchQuery] = useState<string>('');

  // Main Table search & sorting state
  const [tableSearchQuery, setTableSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'DEFAULT' | 'STATUS' | 'DATE' | 'PATIENT' | 'AMOUNT'>('DEFAULT');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');

  const excelInputRef = useRef<HTMLInputElement>(null);

  const activeSocietesList = useMemo(() => {
    return societes.filter(s => s.id !== 'soc-salfa' && !s.code?.toLowerCase().includes('salfa') && !s.nom?.toLowerCase().includes('hopitaly loterana'));
  }, [societes]);

  const getEffectiveInsurance = () => {
    if (!selectedInsurance) return '';
    const matched = activeSocietesList.find(s => s.id === selectedInsurance || s.nom === selectedInsurance);
    return matched ? matched.nom : selectedInsurance;
  };

  const handleResetAndBack = () => {
    setParsedDoc(null);
    setRows([]);
    setErrorMessage(null);
    setLastUploadedFile(null);
    setSearchingRowId(null);
    setIsProcessing(false);
    setConfrontFilter('ALL');
    setTableSearchQuery('');
    setSortBy('DEFAULT');
    setSortOrder('ASC');
    setFileQueue([]);
    setCurrentFileIndex(0);
    setBatchNotice(null);
    if (excelInputRef.current) {
      excelInputRef.current.value = '';
    }
  };

  const handleSkipCurrentFile = () => {
    if (fileQueue.length > 1 && currentFileIndex + 1 < fileQueue.length) {
      const skippedFileName = fileQueue[currentFileIndex]?.name || 'Fichier';
      setBatchHistory(prev => [...prev, { fileName: skippedFileName, count: 0, status: 'SKIPPED' }]);
      const nextIdx = currentFileIndex + 1;
      setCurrentFileIndex(nextIdx);
      const nextFile = fileQueue[nextIdx];
      setBatchNotice(`Fichier « ${skippedFileName} » ignoré. Chargement du fichier ${nextIdx + 1} / ${fileQueue.length}...`);
      processFile(nextFile);
    } else {
      handleClose();
    }
  };

  const handleFilesSelected = (selectedFiles: FileList | File[]) => {
    const list = Array.from(selectedFiles).filter(f => {
      const ext = f.name.toLowerCase();
      return ext.endsWith('.xlsx') || ext.endsWith('.xls') || ext.endsWith('.csv');
    });

    if (list.length === 0) {
      setErrorMessage("Veuillez sélectionner au moins un fichier Excel (.xlsx, .xls, .csv).");
      return;
    }

    setFileQueue(list);
    setCurrentFileIndex(0);
    setBatchHistory([]);
    setBatchNotice(list.length > 1 ? `${list.length} fichiers ajoutés à la file d'attente. Traitement du fichier 1 / ${list.length}...` : null);
    processFile(list[0]);
  };

  const handleClose = () => {
    handleResetAndBack();
    onClose();
  };

  // Compute ALL eligible unpaid / partially paid acts across database
  // Compute ALL eligible unpaid / partially paid acts across database
  // EXCLUDING all acts where resteAPayer <= 0 or prestation is already fully paid!
  const allEligibleActs: MatchCandidate[] = useMemo(() => {
    const list: MatchCandidate[] = [];

    prestations.forEach(prest => {
      // Exclude fully paid or rejected prestations
      if (prest.statut === 'Payé' || prest.statut === 'Rejeté') return;

      const pers = personnes.find(p => p.id === prest.personneId);
      const persNom = prest.nomAgent || pers?.nomPrenom || 'Patient';
      const persMat = prest.matricule || pers?.matricule || '-';
      const socNom = prest.societeNom || societes.find(s => s.id === prest.societeId)?.nom || '';
      const sousSoc = prest.sousSociete || '';

      if (prest.lignes && prest.lignes.length > 0) {
        prest.lignes.forEach((ligne, lIdx) => {
          const brut = ligne.totalPrestation || 0;
          const part = ligne.ticketModerateur ?? Math.round((prest.ticketModerateur || 0) / (prest.lignes.length || 1));
          const remb = ligne.montantARembourser ?? Math.max(0, brut - part);
          const dejaPaye = ligne.totalPaye || 0;
          const reste = Math.max(0, remb - dejaPaye);

          // Exclude acts that are already fully settled!
          if (reste > 0) {
            const fam = familles.find(f => f.code.toUpperCase() === (ligne.code || '').toUpperCase());
            list.push({
              prestationId: prest.id,
              prestationNum: prest.numeroFacture,
              prestationDate: prest.date,
              lignePrestationId: ligne.id || `${prest.id}-lig-${lIdx}`,
              codeActe: ligne.code || 'CONS',
              libelleActe: ligne.libelle || fam?.libelle || ligne.code || 'Acte de soins',
              societeId: prest.societeId,
              societeNom: socNom,
              sousSociete: sousSoc,
              personneId: prest.personneId,
              personneNom: persNom,
              matricule: persMat,
              montantInitial: brut,
              ticketModerateur: part,
              montantARembourser: remb,
              dejaPaye: dejaPaye,
              resteAPayer: reste
            });
          }
        });
      } else {
        // Fallback for prestation without split sub-lines
        const tot = prest.montantTotal ?? prest.totalPrestation ?? 0;
        const mod = prest.ticketModerateur ?? prest.participation ?? 0;
        const remb = prest.montantARembourser ?? Math.max(0, tot - mod);
        const dejaPaye = prest.totalPaye || 0;
        const reste = Math.max(0, remb - dejaPaye);

        if (reste > 0) {
          list.push({
            prestationId: prest.id,
            prestationNum: prest.numeroFacture,
            prestationDate: prest.date,
            lignePrestationId: `${prest.id}-main`,
            codeActe: 'ACTE',
            libelleActe: prest.commentaires || 'Prestation globale',
            societeId: prest.societeId,
            societeNom: socNom,
            sousSociete: sousSoc,
            personneId: prest.personneId,
            personneNom: persNom,
            matricule: persMat,
            montantInitial: tot,
            ticketModerateur: mod,
            montantARembourser: remb,
            dejaPaye: dejaPaye,
            resteAPayer: reste
          });
        }
      }
    });

    return list;
  }, [prestations, personnes, societes, familles]);

  // Intelligent Automatic Matcher for a settlement line
  // Confronts date of care against prescription act date, gross amount without ticket moderator against prescription act gross amount, and society
  // STRICT RULE: Automatic linking is strictly restricted to the same month & year (YYYY-MM).
  const autoMatchSettlementLine = (
    matricule: string, 
    nomPrenom: string, 
    actCode: string,
    dateSoins: string,
    montantBrut: number,
    netMontant: number,
    targetSocId?: string
  ): MatchCandidate | null => {
    if (allEligibleActs.length === 0) return null;

    const cleanMatricule = (matricule || '').replace(/\s+/g, '').toLowerCase();
    const cleanNom = (nomPrenom || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const cleanCode = normalizeActFamilyCode(actCode);
    const cleanDateSoins = (dateSoins || '').trim().substring(0, 10);
    const isoDateSoins = normalizeDateISO(dateSoins);
    const monthSoins = isoDateSoins ? isoDateSoins.substring(0, 7) : '';
    const brutMontant = Number(montantBrut || netMontant || 0);

    let bestCandidate: MatchCandidate | null = null;
    let highestScore = -1;

    allEligibleActs.forEach(cand => {
      let score = 0;
      const candMatricule = (cand.matricule || '').replace(/\s+/g, '').toLowerCase();
      const candNom = (cand.personneNom || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      const candDate = (cand.prestationDate || '').trim().substring(0, 10);
      const isoCandDate = normalizeDateISO(cand.prestationDate);
      const monthCand = isoCandDate ? isoCandDate.substring(0, 7) : '';

      // 1. REGLE STRICTE DE LIAISON AUTOMATIQUE : Même mois & année uniquement (YYYY-MM)
      if (!monthSoins || !monthCand || monthSoins !== monthCand) {
        return; // Ne pas lier automatiquement si pas dans le même mois
      }

      const candCode = normalizeActFamilyCode(cand.codeActe);
      const candBrut = Number(cand.montantInitial || 0);
      const candRemb = Number(cand.montantARembourser || 0);
      const candReste = Number(cand.resteAPayer || 0);

      // 2. Patient matching
      const exactMat = cleanMatricule && candMatricule && cleanMatricule !== '-' && cleanMatricule === candMatricule;
      const partialMat = cleanMatricule && candMatricule && cleanMatricule !== '-' && (cleanMatricule.includes(candMatricule) || candMatricule.includes(cleanMatricule));
      const nameMatch = cleanNom && candNom && (candNom.includes(cleanNom) || cleanNom.includes(candNom));

      if (exactMat) score += 100;
      else if (partialMat) score += 80;
      else if (nameMatch) score += 75;
      else {
        // Skip candidate if no patient relation
        return;
      }

      // 3. STRICT INTER-SOCIETY RULE: Disallow inter-company/inter-society matching
      if (targetSocId) {
        const targetSoc = societes.find(s => s.id === targetSocId || s.nom.toLowerCase() === targetSocId.toLowerCase());
        const expectedSocId = targetSoc?.id || targetSocId;
        const candSocId = cand.societeId;
        
        if (candSocId && candSocId !== expectedSocId) {
          // Reject candidate if it belongs to a different society/garant
          return;
        }
        score += 80;
      }

      // 4. Date de soins vs Date de l'acte dans la prescription
      const isSameDate = Boolean(cleanDateSoins && candDate && cleanDateSoins === candDate);
      if (isSameDate) {
        score += 70;
      }

      // 5. Montant sans ticket modérateur (Montant brut initial)
      const isSameGrossAmount = Math.abs(brutMontant - candBrut) < 2;
      const isSameNetAmount = Math.abs(netMontant - candRemb) < 2 || Math.abs(netMontant - candReste) < 2;

      if (isSameGrossAmount) {
        score += 70;
      } else if (isSameNetAmount) {
        score += 45;
      } else if (candBrut > 0 && Math.abs(brutMontant - candBrut) / candBrut <= 0.15) {
        score += 20;
      }

      // 6. Code / Famille Acte matching
      const exactCode = cleanCode && candCode && (cleanCode === candCode);
      if (exactCode) {
        score += 45;
      }

      // Bonus for total perfect match (Same Patient + Same Date + Same Gross Amount)
      if (isSameDate && isSameGrossAmount) {
        score += 60;
      }

      if (score > highestScore && score >= 100) {
        highestScore = score;
        bestCandidate = cand;
      }
    });

    return bestCandidate;
  };

  const processLoadedDocument = (
    doc: ParsedFactureAssurance, 
    groupEnabled: boolean = groupOnImport,
    overrideSocId?: string
  ) => {
    setParsedDoc(doc);
    const targetSocId = overrideSocId || selectedInsurance || (activeSocietesList.find(s => s.nom.toLowerCase() === (doc.clientDoit || '').toLowerCase())?.id);

    // 1. Expand raw settlement lines
    const rawItems: Array<{
      originalIndex: number;
      matricule: string;
      nomPrenom: string;
      sousSociete: string;
      dateSoins: string;
      actCode: string;
      actLibelle: string;
      montantBrut: number;
      montantExclu: number;
      participation: number;
      netAPayer: number;
      observations: string;
      articlesCount: number;
    }> = [];

    doc.lignes.forEach((l, idx) => {
      // For BSA and healthcare statements: the true patient is the person aligned with the date of care
      const effectiveNom = (l.ayantDroit && l.ayantDroit.trim()) ? l.ayantDroit.trim() : l.nomPrenom;

      // If line has multiple acts
      if (l.actes && l.actes.length > 0) {
        l.actes.forEach((act) => {
          const actMontant = act.montant || Math.round(l.montantBrut / (l.actes?.length || 1));
          const partRatio = l.montantBrut > 0 ? actMontant / l.montantBrut : 1 / (l.actes?.length || 1);
          const actPart = Math.round((l.participation || 0) * partRatio);
          const actExclu = Math.round((l.montantExclu || 0) * partRatio);
          const actNet = (l.actes?.length === 1 && l.netAPayer !== undefined)
            ? l.netAPayer
            : Math.max(0, actMontant - actPart - actExclu);

          rawItems.push({
            originalIndex: idx,
            matricule: l.matricule,
            nomPrenom: effectiveNom,
            sousSociete: l.sousSociete || '',
            dateSoins: l.dateSoins,
            actCode: act.code || 'CONS',
            actLibelle: act.libelle || act.code || 'Acte de soins',
            montantBrut: actMontant,
            montantExclu: actExclu,
            participation: actPart,
            netAPayer: actNet,
            observations: l.observations || '',
            articlesCount: 1,
          });
        });
      } else {
        const actCode = (l.actesTexte || 'CONS').substring(0, 6).toUpperCase();
        rawItems.push({
          originalIndex: idx,
          matricule: l.matricule,
          nomPrenom: effectiveNom,
          sousSociete: l.sousSociete || '',
          dateSoins: l.dateSoins,
          actCode: actCode,
          actLibelle: l.actesTexte || 'Prestation médicale',
          montantBrut: l.montantBrut,
          montantExclu: l.montantExclu || 0,
          participation: l.participation || 0,
          netAPayer: l.netAPayer,
          observations: l.observations || '',
          articlesCount: 1,
        });
      }
    });

    // 2. Optional: Group by Person + Date + Normalized Act family (to aggregate individual articles into single acts)
    let finalItems: Array<{
      originalIndex: number;
      matricule: string;
      nomPrenom: string;
      sousSociete: string;
      dateSoins: string;
      actCode: string;
      actLibelle: string;
      montantBrut: number;
      montantExclu: number;
      participation: number;
      netAPayer: number;
      observations: string;
      articlesCount: number;
      mergedArticles?: string[];
    }> = rawItems;

    if (groupEnabled) {
      const groupedMap = new Map<string, typeof rawItems[0] & { mergedArticles: string[] }>();

      rawItems.forEach(item => {
        const normNom = (item.nomPrenom || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ');
        const normDate = (item.dateSoins || '').trim().substring(0, 10);
        const normFamily = normalizeActFamilyCode(item.actCode);
        const key = `${normNom}|${normDate}|${normFamily}`;

        if (groupedMap.has(key)) {
          const existing = groupedMap.get(key)!;
          existing.montantBrut += item.montantBrut;
          existing.montantExclu += item.montantExclu;
          existing.participation += item.participation;
          existing.netAPayer += item.netAPayer;
          existing.articlesCount += 1;
          if (item.actLibelle && !existing.mergedArticles.includes(item.actLibelle)) {
            existing.mergedArticles.push(item.actLibelle);
          }
          if (item.observations && !existing.observations.includes(item.observations)) {
            existing.observations = existing.observations ? `${existing.observations} • ${item.observations}` : item.observations;
          }
        } else {
          groupedMap.set(key, {
            ...item,
            actCode: normFamily,
            mergedArticles: item.actLibelle ? [item.actLibelle] : []
          });
        }
      });

      finalItems = Array.from(groupedMap.values()).map(g => {
        let displayLibelle = g.actLibelle;
        if (g.articlesCount > 1) {
          const preview = g.mergedArticles.slice(0, 3).join(', ') + (g.mergedArticles.length > 3 ? ` (+${g.mergedArticles.length - 3})` : '');
          displayLibelle = `${g.actCode} (${g.articlesCount} articles regroupés : ${preview})`;
        }
        return {
          ...g,
          actLibelle: displayLibelle
        };
      });
    }

    // 3. Auto-match confrontation with eligible DB prescription acts
    const builtRows: SettlementRowItem[] = finalItems.map((item, rowIdx) => {
      const matched = autoMatchSettlementLine(
        item.matricule,
        item.nomPrenom,
        item.actCode,
        item.dateSoins,
        item.montantBrut,
        item.netAPayer,
        targetSocId
      );

      return {
        rowId: `row-${rowIdx}`,
        originalIndex: item.originalIndex,
        dateSoins: item.dateSoins,
        matricule: item.matricule,
        nomPrenom: item.nomPrenom,
        sousSociete: item.sousSociete || '',
        actCode: item.actCode,
        actLibelle: item.actLibelle,
        montantBrut: item.montantBrut,
        montantExclu: item.montantExclu,
        participation: item.participation,
        netAPayer: item.netAPayer,
        observations: item.observations,
        articlesCount: item.articlesCount,
        mergedArticles: item.mergedArticles,
        matchedCandidate: matched,
        createNewPrestation: !matched,
        selected: true
      };
    });

    setRows(builtRows);
    setIsProcessing(false);
  };

  const handleToggleGrouping = (newVal: boolean) => {
    setGroupOnImport(newVal);
    if (parsedDoc) {
      setIsProcessing(true);
      setTimeout(() => {
        processLoadedDocument(parsedDoc, newVal);
      }, 100);
    }
  };

  const handleSocietyChange = (newSocId: string) => {
    setSelectedInsurance(newSocId);
    const matched = activeSocietesList.find(s => s.id === newSocId);
    const socName = matched ? matched.nom : newSocId;
    if (parsedDoc) {
      const updatedDoc: ParsedFactureAssurance = {
        ...parsedDoc,
        clientDoit: socName,
        garant: socName,
        lignes: parsedDoc.lignes.map(l => ({
          ...l,
          societeAffiliee: socName
        }))
      };
      setParsedDoc(updatedDoc);
      setIsProcessing(true);
      setTimeout(() => {
        processLoadedDocument(updatedDoc, groupOnImport, newSocId);
      }, 50);
    }
  };

  const processFile = async (file: File) => {
    const chosenOrg = getEffectiveInsurance();

    setIsProcessing(true);
    setErrorMessage(null);
    setLastUploadedFile(file);

    try {
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const data = new Uint8Array(event.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const firstSheet = workbook.Sheets[sheetName];
            const jsonRows: any[] = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

            if (jsonRows.length === 0) throw new Error('Le fichier Excel est vide ou ne contient aucune ligne de données.');

            // Detect company from file name, sheet names, and raw contents
            const fileNameLower = file.name.toLowerCase();
            const sheetNamesLower = workbook.SheetNames.join(' ').toLowerCase();
            const sampleText = JSON.stringify(jsonRows.slice(0, 10)).toLowerCase();
            const fullContextText = `${fileNameLower} ${sheetNamesLower} ${sampleText}`;

            let detectedCompanyKey = '';
            if (fullContextText.includes('bsa') || fullContextText.includes('gras savoye') || fullContextText.includes('ask gs') || fullContextText.includes('grassavoye') || fullContextText.includes('releve de remboursements des frais de sante')) {
              detectedCompanyKey = 'BSA';
            } else if (fullContextText.includes('ascoma') || fullContextText.includes('joubert') || fullContextText.includes('dispensaire lutherien')) {
              detectedCompanyKey = 'ASCOMA';
            } else if (fullContextText.includes('mci') || fullContextText.includes('mcicare') || fullContextText.includes('conservation international')) {
              detectedCompanyKey = 'MCI CARE';
            } else if (fullContextText.includes('havana') || fullContextText.includes('ny havana')) {
              detectedCompanyKey = 'NY HAVANA';
            } else if (fullContextText.includes('sanlam') || fullContextText.includes('allianz')) {
              detectedCompanyKey = 'SANLAM';
            }

            const matchedDetectedSoc = detectedCompanyKey ? findBestMatchingSociete(detectedCompanyKey, societes, selectedInsurance) : null;
            if (matchedDetectedSoc && !selectedInsurance) {
              setSelectedInsurance(matchedDetectedSoc.id);
            }

            let inferredBordereau = '';
            let inferredOrganisme = chosenOrg || matchedDetectedSoc?.nom || detectedCompanyKey || '';
            let inferredDateReglement = new Date().toISOString().split('T')[0];

            const lignes: FactureLigneParsed[] = jsonRows.map((row, idx) => {
              const getVal = (keys: string[]) => {
                for (const k of keys) {
                  const cleanK = k.toLowerCase().replace(/[\s_\-\.\/]/g, '');
                  const foundKey = Object.keys(row).find(rk => {
                    const cleanRk = rk.toLowerCase().replace(/[\s_\-\.\/]/g, '');
                    return cleanRk === cleanK;
                  });
                  if (foundKey && row[foundKey] !== undefined && row[foundKey] !== '') return row[foundKey];
                }
                return '';
              };

              const rawBord = String(getVal(['Ref_Bordereau', 'RefBordereau', 'Bordereau', 'N° Bordereau', 'Numero_Reglement', 'Ref_Paiement', 'Ref_Decompte']) || '').trim();
              if (rawBord && !inferredBordereau) inferredBordereau = rawBord;

              const rawOrg = String(getVal(['Organisme', 'Assurance', 'Societe', 'Société', 'Client', 'Garant', 'Assureur', 'Payeur', 'Organisme_Payeur']) || '').trim() || chosenOrg;
              let lineSoc = chosenOrg || inferredOrganisme || '';
              if (rawOrg && rawOrg !== 'Organisme') {
                const matched = findBestMatchingSociete(rawOrg, societes, chosenOrg || inferredOrganisme);
                lineSoc = matched ? matched.nom : rawOrg;
                if (!inferredOrganisme) inferredOrganisme = lineSoc;
              }

              const rawDateReg = String(getVal(['Date_Reglement', 'Date_Paiement', 'Date_Reglement_Paiement', 'Date Reglement', 'Date Paiement']) || '').trim();
              if (rawDateReg) inferredDateReglement = normalizeDateISO(rawDateReg);

              // 1. Chercher d'abord le nom de la personne soignée / patient aligné à la date du soin
              const nomPatientSoin = String(getVal([
                'Patient', 'Nom_Patient', 'Nom Patient', 'Nom du Patient', 'Nom_du_Patient',
                'Beneficiaire', 'Bénéficiaire', 'Nom_Beneficiaire', 'Nom_Bénéficiaire', 'Nom Bénéficiaire', 'Nom Beneficiaire',
                'Ayant_Droit', 'Ayant Droit', 'AyantDroit', 'Nom_Ayant_Droit', 'Nom Ayant Droit', 'Nom_AyantDroit',
                'Personne_Soignee', 'Personne Soignée', 'Nom_Soigne', 'Nom Soigné', 'Soigné', 'Soigne',
                'Nom_Soin', 'Nom Soin', 'Nom_Soins', 'Nom Soins', 'Nom_Date_Soin', 'Nom Date Soin', 'Nom_Date_Soins', 'Nom Date des Soins',
                'Malade', 'Nom_Malade', 'Nom Malade'
              ]) || '').trim();

              // 2. Chercher le nom de l'adhérent / titulaire de l'adhésion
              const nomAdherent = String(getVal([
                'Adherent', 'Adhérent', 'Nom_Adherent', 'Nom_Adhérent', 'Nom Adhérent', 'Nom Adherent', 'Adherent_Nom',
                'Adhesion', 'Adhésion', 'Titulaire', 'Nom_Titulaire', 'Nom Titulaire'
              ]) || '').trim();

              // 3. Chercher les autres colonnes de nom général
              const nomGeneral = String(getVal([
                'Nom_Agent', 'Nom Agent', 'Nom et Prénom', 'Nom et Prenom', 'Nom_Prenom', 'Nom', 'Assuré', 'Assure', 'Nom Assuré', 'Nom Assure', 'Nom_Assure'
              ]) || '').trim();

              // Règle BSA : Pour BSA et relevés de soins, le vrai nom de la personne à importer est TOUJOURS celui aligné à la date du soin (Patient / Ayant-droit / Soigné) et non celui de l'adhésion
              let rawNom = nomPatientSoin || (nomAdherent && !nomGeneral ? nomAdherent : nomGeneral) || nomAdherent || `Patient ${idx + 1}`;
              let sousSoc = String(getVal(['Sous_Societe', 'Sous-Société', 'Sous Societe', 'Département', 'Section', 'Service']) || '').trim();

              const parenMatch = rawNom.match(/^([^(]+)\s*\(([^)]+)\)$/);
              if (parenMatch) {
                rawNom = parenMatch[1].trim();
                if (!sousSoc) {
                  sousSoc = parenMatch[2].trim();
                }
              }

              const matricule = String(getVal([
                'Matricule', 'N° Matricule', 'N°_Matricule', 'Num_Matricule', 'Num Matricule',
                'Immatriculation', 'Immat', 'N° Immatriculation', 'Num Immatriculation', 'N°_Immatriculation',
                'Code', 'Code_Assure', 'Code Assuré', 'Code_Adherent', 'Code Adhérent',
                'N° Assuré', 'N°_Assuré', 'Numéro Assuré', 'No Assure', 'No_Assure',
                'Police', 'N° Police', 'N°_Police',
                'N° Adhérent', 'N°_Adhérent', 'Numéro Adhérent', 'Numéro_Adhérent', 'No Adherent',
                'Numéro Adhesion', 'N° Adhésion', 'N°_Adhésion', 'Adhesion', 'Identifiant'
              ]) || '').trim();
              const rawDateSoins = String(getVal(['Date_Soins', 'Date', 'Date Soins', 'Date des Soins', 'Date Prestation']) || inferredDateReglement).trim();
              const dateSoins = normalizeDateISO(rawDateSoins);
              const montantBrut = Number(getVal([
                'FR_REELS', 'FR.REELS', 'FRAIS_REELS', 'FRAIS REELS', 'FR REELS', 'FRAIS REEL',
                'Montant_Reclame_Brut', 'Montant_Brut', 'Montant Total Brut', 'Montant Facture', 'Total Prestation', 'Montant Reclame'
              ])) || 0;
              const participation = Number(getVal([
                'TPG', 'TPG*', 'T.P.G', 'Ticket_Moderateur', 'Ticket Moderateur', 'Ticket Modérateur', 'Part Assuré', 'Participation'
              ])) || 0;
              const netAPayer = Number(getVal([
                'REMB', 'REMB.', 'REMBOURSEMENT', 'Montant_Paye_Regle', 'Somme_Payee_Net', 'Net A Payer', 'Montant Regle', 'Montant Réglé', 'Net Payé', 'Montant Remboursé', 'Somme Payée'
              ])) || 0;
              const montantExclu = Number(getVal([
                'NON_REMB', 'NON REMB', 'NON_REMB.', 'Montant_Exclu', 'Montant_Exclu_Rejet', 'Montant Exclu', 'Exclu', 'Rejet'
              ])) || 0;

              const finalBrut = montantBrut || (netAPayer > 0 ? (netAPayer + participation + montantExclu) : netAPayer);
              const finalNet = netAPayer || (finalBrut > 0 ? Math.max(0, finalBrut - participation - montantExclu) : 0);
              
              const actCode = String(getVal(['Code_Acte', 'Code Acte', 'Acte', 'Code']) || 'CONS').trim().toUpperCase();
              const actLibelle = String(getVal(['Libelle_Acte', 'Libellé Acte', 'Acte médicale/Prix', 'Actes Médicaux', 'Prestation', 'Libellé']) || actCode).trim();
              let observations = String(getVal(['Observations', 'Remarques', 'Commentaires', 'Motif', 'Motif_Observation']) || 'Import Excel').trim();
              if (nomAdherent && nomAdherent.toLowerCase() !== rawNom.toLowerCase() && !observations.toLowerCase().includes(nomAdherent.toLowerCase())) {
                observations = observations && observations !== 'Import Excel' ? `${observations} (Adhérent: ${nomAdherent})` : `Adhérent: ${nomAdherent}`;
              }

              return {
                numeroLigne: idx + 1,
                dateSoins,
                matricule,
                nomPrenom: rawNom,
                societeAffiliee: inferredOrganisme,
                sousSociete: sousSoc,
                actes: [{ code: actCode.substring(0, 8), libelle: actLibelle, montant: finalBrut }],
                actesTexte: actLibelle,
                montantBrut: finalBrut,
                montantExclu,
                baseReglement: finalBrut,
                participation,
                netAPayer: finalNet,
                observations
              };
            });

            const totalNet = lignes.reduce((s, l) => s + l.netAPayer, 0);
            const totalPart = lignes.reduce((s, l) => s + l.participation, 0);
            const totalBrut = lignes.reduce((s, l) => s + l.montantBrut, 0);

            const doc: ParsedFactureAssurance = {
              documentType: 'decompte',
              etablissement: 'CENTRE DE SANTÉ',
              numeroFacture: inferredBordereau || `BORD-${Date.now().toString().substring(6)}`,
              numeroBordereau: inferredBordereau || `BORD-${Date.now().toString().substring(6)}`,
              moisPriseEnCharge: new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
              clientDoit: inferredOrganisme,
              dateEmission: inferredDateReglement,
              totalMontantBrut: totalBrut,
              totalParticipation: totalPart,
              totalNetAPayer: totalNet,
              lignes
            };

            processLoadedDocument(doc, groupOnImport, matchedDetectedSoc?.id);
          } catch (err: any) {
            setErrorMessage(err.message || 'Erreur lors de la lecture du fichier Excel.');
            setIsProcessing(false);
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        throw new Error("Seuls les fichiers Excel (.xlsx, .xls, .csv) sont pris en charge pour l'importation de décompte.");
      }
    } catch (err: any) {
      console.warn('Decompte extraction error:', err);
      setErrorMessage(err.message || 'Erreur lors de la lecture du fichier Excel.');
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    e.target.value = '';
    if (!files || files.length === 0) return;
    if (files.length === 1) {
      setFileQueue([files[0]]);
      setCurrentFileIndex(0);
      setBatchHistory([]);
      processFile(files[0]);
    } else {
      handleFilesSelected(files);
    }
  };

  const handleRetryLastFile = () => {
    if (lastUploadedFile) {
      processFile(lastUploadedFile);
    } else {
      excelInputRef.current?.click();
    }
  };

  // Toggle selection
  const handleToggleSelectRow = (rowId: string) => {
    setRows(prev => prev.map(r => r.rowId === rowId ? { ...r, selected: !r.selected } : r));
  };

  const handleToggleSelectAll = (checked: boolean) => {
    setRows(prev => prev.map(r => ({ ...r, selected: checked })));
  };

  // Link selected candidate to active row
  const handleAssignCandidate = (rowId: string, candidate: MatchCandidate | null) => {
    setRows(prev => prev.map(r => {
      if (r.rowId === rowId) {
        return {
          ...r,
          matchedCandidate: candidate,
          createNewPrestation: candidate === null
        };
      }
      return r;
    }));
    setSearchingRowId(null);
    setActSearchQuery('');
  };

  const activeSearchingRow = rows.find(r => r.rowId === searchingRowId);

  // Filtered search list inside manual match modal, scored by match quality
  const filteredSearchCandidates = useMemo(() => {
    let list = allEligibleActs;
    if (actSearchQuery.trim()) {
      const q = actSearchQuery.toLowerCase().trim();
      list = allEligibleActs.filter(cand => 
        cand.personneNom.toLowerCase().includes(q) ||
        cand.matricule.toLowerCase().includes(q) ||
        cand.prestationNum.toLowerCase().includes(q) ||
        cand.codeActe.toLowerCase().includes(q) ||
        cand.libelleActe.toLowerCase().includes(q) ||
        (cand.sousSociete && cand.sousSociete.toLowerCase().includes(q)) ||
        (cand.societeNom && cand.societeNom.toLowerCase().includes(q))
      );
    }

    if (!activeSearchingRow) return list;

    // Sort so candidates with same date and same amount appear first
    return [...list].sort((a, b) => {
      const detailsA = getConfrontationDetails(activeSearchingRow.dateSoins, activeSearchingRow.montantBrut, activeSearchingRow.netAPayer, a);
      const detailsB = getConfrontationDetails(activeSearchingRow.dateSoins, activeSearchingRow.montantBrut, activeSearchingRow.netAPayer, b);

      const scoreMap: Record<ConfrontationType, number> = {
        PERFECT: 100,
        SAME_DATE: 70,
        SAME_AMOUNT: 60,
        VERIFY: 20,
        UNLINKED: 0
      };

      return (scoreMap[detailsB.type] || 0) - (scoreMap[detailsA.type] || 0);
    });
  }, [allEligibleActs, actSearchQuery, activeSearchingRow]);

  // Helper to find top candidate suggestions for a settlement row (strictly in the same month & year)
  const getRowSuggestions = (row: SettlementRowItem): MatchCandidate[] => {
    const normNom = (row.nomPrenom || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const cleanMat = (row.matricule || '').replace(/\s+/g, '').toLowerCase();

    if (!normNom && (!cleanMat || cleanMat === '-')) return [];

    const isoDateSoins = normalizeDateISO(row.dateSoins);
    const monthSoins = isoDateSoins ? isoDateSoins.substring(0, 7) : '';

    return allEligibleActs.filter(cand => {
      // Avoid candidates already assigned to another row in this settlement
      const isAlreadyAssigned = rows.some(r => r.rowId !== row.rowId && r.matchedCandidate?.lignePrestationId === cand.lignePrestationId);
      if (isAlreadyAssigned) return false;

      // Restreindre les suggestions automatiques au même mois (YYYY-MM)
      const isoCandDate = normalizeDateISO(cand.prestationDate);
      const monthCand = isoCandDate ? isoCandDate.substring(0, 7) : '';
      if (!monthSoins || !monthCand || monthSoins !== monthCand) {
        return false;
      }

      const candMat = (cand.matricule || '').replace(/\s+/g, '').toLowerCase();
      const candNom = (cand.personneNom || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

      const matMatch = Boolean(cleanMat && cleanMat !== '-' && candMat && candMat !== '-' && (cleanMat === candMat || candMat.includes(cleanMat) || cleanMat.includes(candMat)));
      const nameMatch = Boolean(normNom && candNom && (candNom.includes(normNom) || normNom.includes(candNom)));

      return matMatch || nameMatch;
    }).slice(0, 3);
  };

  // Automatically link all unlinked rows that have high-confidence suggestions
  const handleAutoLinkAllSuggestions = () => {
    let linkedCount = 0;
    setRows(prev => prev.map(r => {
      if (r.matchedCandidate) return r; // Already matched

      const suggestions = getRowSuggestions(r);
      if (suggestions.length > 0) {
        linkedCount++;
        return {
          ...r,
          matchedCandidate: suggestions[0],
          createNewPrestation: false,
        };
      }
      return r;
    }));
  };

  // Select rows by specific status category
  const handleSelectByStatus = (statusType: 'PERFECT' | 'LINKED' | 'UNLINKED' | 'VERIFY' | 'ALL') => {
    setRows(prev => prev.map(r => {
      const details = getConfrontationDetails(r.dateSoins, r.montantBrut, r.netAPayer, r.matchedCandidate);
      let selectIt = false;
      if (statusType === 'ALL') selectIt = true;
      else if (statusType === 'PERFECT') selectIt = details.type === 'PERFECT';
      else if (statusType === 'LINKED') selectIt = Boolean(r.matchedCandidate);
      else if (statusType === 'UNLINKED') selectIt = !r.matchedCandidate;
      else if (statusType === 'VERIFY') selectIt = details.type === 'VERIFY';
      return { ...r, selected: selectIt };
    }));
  };

  // Statistics for confrontation categories
  const confrontStats = useMemo(() => {
    let perfect = 0;
    let sameDate = 0;
    let sameAmount = 0;
    let verify = 0;
    let unlinked = 0;

    rows.forEach(r => {
      const details = getConfrontationDetails(r.dateSoins, r.montantBrut, r.netAPayer, r.matchedCandidate);
      if (details.type === 'PERFECT') perfect++;
      else if (details.type === 'SAME_DATE') sameDate++;
      else if (details.type === 'SAME_AMOUNT') sameAmount++;
      else if (details.type === 'VERIFY') verify++;
      else if (details.type === 'UNLINKED') unlinked++;
    });

    const linkedCount = perfect + sameDate + sameAmount + verify;
    const matchPercentage = rows.length > 0 ? Math.round((linkedCount / rows.length) * 100) : 0;

    return { perfect, sameDate, sameAmount, verify, unlinked, total: rows.length, linkedCount, matchPercentage };
  }, [rows]);

  // Statistics for insured matricule updates
  const matriculeSyncStats = useMemo(() => {
    let withMatricule = 0;
    let willUpdateExisting = 0;
    let willCreateNew = 0;

    rows.forEach(r => {
      if (isRealMatricule(r.matricule)) {
        withMatricule++;
        const normNom = (r.nomPrenom || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        const candPerId = r.matchedCandidate?.personneId;
        const existing = personnes.find(p => (candPerId && p.id === candPerId) || (p.matricule && p.matricule.toLowerCase() === r.matricule.toLowerCase()) || p.nomPrenom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() === normNom);

        if (existing) {
          if (existing.matricule.trim().toLowerCase() !== r.matricule.trim().toLowerCase()) {
            willUpdateExisting++;
          }
        } else {
          willCreateNew++;
        }
      }
    });

    return { withMatricule, willUpdateExisting, willCreateNew };
  }, [rows, personnes]);

  // Filtered and sorted rows for display in table
  const displayedRows = useMemo(() => {
    let list = rows;

    // 1. Filter by confrontation category chip
    if (confrontFilter !== 'ALL') {
      list = list.filter(r => {
        const details = getConfrontationDetails(r.dateSoins, r.montantBrut, r.netAPayer, r.matchedCandidate);
        return details.type === confrontFilter;
      });
    }

    // 2. Filter by search query
    if (tableSearchQuery.trim()) {
      const q = tableSearchQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      list = list.filter(r => {
        const normNom = (r.nomPrenom || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        const mat = (r.matricule || '').toLowerCase();
        const code = (r.actCode || '').toLowerCase();
        const lib = (r.actLibelle || '').toLowerCase();
        const candNom = (r.matchedCandidate?.personneNom || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        const candCode = (r.matchedCandidate?.codeActe || '').toLowerCase();
        const candNum = (r.matchedCandidate?.prestationNum || '').toLowerCase();
        const dateStr = formatDate(r.dateSoins).toLowerCase();
        const netStr = r.netAPayer.toString();
        const brutStr = r.montantBrut.toString();

        return normNom.includes(q) || mat.includes(q) || code.includes(q) || lib.includes(q) ||
          candNom.includes(q) || candCode.includes(q) || candNum.includes(q) || dateStr.includes(q) ||
          netStr.includes(q) || brutStr.includes(q);
      });
    }

    // 3. Sorting
    if (sortBy !== 'DEFAULT') {
      list = [...list].sort((a, b) => {
        let valA: any = 0;
        let valB: any = 0;

        if (sortBy === 'DATE') {
          valA = a.dateSoins || '';
          valB = b.dateSoins || '';
        } else if (sortBy === 'PATIENT') {
          valA = (a.nomPrenom || '').toLowerCase();
          valB = (b.nomPrenom || '').toLowerCase();
        } else if (sortBy === 'AMOUNT') {
          valA = a.netAPayer;
          valB = b.netAPayer;
        } else if (sortBy === 'STATUS') {
          const scoreMap: Record<ConfrontationType, number> = {
            UNLINKED: 1,
            VERIFY: 2,
            SAME_AMOUNT: 3,
            SAME_DATE: 4,
            PERFECT: 5,
          };
          const detA = getConfrontationDetails(a.dateSoins, a.montantBrut, a.netAPayer, a.matchedCandidate);
          const detB = getConfrontationDetails(b.dateSoins, b.montantBrut, b.netAPayer, b.matchedCandidate);
          valA = scoreMap[detA.type] || 0;
          valB = scoreMap[detB.type] || 0;
        }

        if (valA < valB) return sortOrder === 'ASC' ? -1 : 1;
        if (valA > valB) return sortOrder === 'ASC' ? 1 : -1;
        return 0;
      });
    }

    return list;
  }, [rows, confrontFilter, tableSearchQuery, sortBy, sortOrder]);

  // Final Validation
  const executeValidateAndSave = (overrideExistingSocId?: string) => {
    if (!parsedDoc) return;
    const selectedRows = rows.filter(r => r.selected);
    if (selectedRows.length === 0) {
      alert('Veuillez sélectionner au moins une ligne de décompte à régler.');
      return;
    }

    const effectiveSocId = overrideExistingSocId || selectedInsurance || (activeSocietesList.find(s => s.nom.toLowerCase() === (parsedDoc.clientDoit || '').toLowerCase())?.id);
    const socName = (parsedDoc.clientDoit || parsedDoc.garant || getEffectiveInsurance() || 'BSA / ASK GS').trim();
    let matchedSoc = (effectiveSocId ? societes.find(s => s.id === effectiveSocId) : null) || findBestMatchingSociete(socName, societes, getEffectiveInsurance());

    const createdSocietes: Societe[] = [];
    const finalPersonnesMap = new Map<string, Personne>();
    personnes.forEach(p => finalPersonnesMap.set(p.id, { ...p }));

    if (!matchedSoc) {
      setMissingSocPrompt({ socName });
      return;
    }

    const paymentId = generateId('pai');
    const newLignesPaiement: LignePaiement[] = [];
    const updatedPrestations = [...prestations];

    selectedRows.forEach((row, idx) => {
      let targetPrestationId = '';
      let targetLigneId = '';
      const rowMatricule = (row.matricule || '').trim();
      const hasRealMatricule = isRealMatricule(rowMatricule);
      const normRowNom = (row.nomPrenom || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

      if (row.matchedCandidate) {
        targetPrestationId = row.matchedCandidate.prestationId;
        targetLigneId = row.matchedCandidate.lignePrestationId;

        // Update the existing prestation in database
        const pIndex = updatedPrestations.findIndex(p => p.id === targetPrestationId);
        if (pIndex >= 0) {
          const prest = updatedPrestations[pIndex];

          // Locate the insured member's record in dossier
          let targetPersonne = finalPersonnesMap.get(row.matchedCandidate.personneId) ||
            finalPersonnesMap.get(prest.personneId) ||
            Array.from(finalPersonnesMap.values()).find(p => 
              (hasRealMatricule && p.matricule.toLowerCase() === rowMatricule.toLowerCase()) ||
              p.nomPrenom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() === normRowNom ||
              (prest.nomAgent && p.nomPrenom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() === prest.nomAgent.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim())
            );

          if (targetPersonne) {
            // Update matricule in the insured person's dossier if the file provides an immatriculation
            if (hasRealMatricule && targetPersonne.matricule.trim() !== rowMatricule) {
              targetPersonne = {
                ...targetPersonne,
                matricule: rowMatricule,
                sousSociete: row.sousSociete || targetPersonne.sousSociete
              };
              finalPersonnesMap.set(targetPersonne.id, targetPersonne);
            }
            if (hasRealMatricule) {
              prest.matricule = rowMatricule;
            }
            prest.personneId = targetPersonne.id;
          } else {
            // Create the insured person record if missing
            const newPer: Personne = {
              id: generateId(`per-cand-${idx}`),
              matricule: hasRealMatricule ? rowMatricule : (prest.matricule || `MAT-${1000 + idx}`),
              nomPrenom: row.nomPrenom || prest.nomAgent || 'Assuré',
              societeId: matchedSoc?.id || prest.societeId || 'soc-1',
              sousSociete: row.sousSociete || prest.sousSociete || undefined,
              qualite: 'Adhérent Principal'
            };
            finalPersonnesMap.set(newPer.id, newPer);
            prest.personneId = newPer.id;
            if (hasRealMatricule) {
              prest.matricule = rowMatricule;
            }
          }

          const updatedLignes = prest.lignes.map(l => {
            if (l.id === targetLigneId) {
              const newTotalPaye = (l.totalPaye || 0) + row.netAPayer;
              const lARemb = l.montantARembourser ?? (l.totalPrestation - (l.ticketModerateur || 0));
              const isLigneRejetee = (row.montantExclu || 0) >= lARemb && newTotalPaye === 0;
              const isLigneFullyCovered = (newTotalPaye + (row.montantExclu || 0)) >= lARemb || newTotalPaye >= lARemb;
              return {
                ...l,
                totalPaye: newTotalPaye,
                statut: isLigneRejetee ? ('Rejeté' as const) : isLigneFullyCovered ? ('Payé' as const) : newTotalPaye > 0 ? ('Partiellement payé' as const) : l.statut
              };
            }
            return l;
          });

          const totalPrestationVal = prest.montantTotal ?? prest.totalPrestation;
          const partVal = prest.ticketModerateur ?? prest.participation ?? 0;
          const rembVal = prest.montantARembourser ?? Math.max(0, totalPrestationVal - partVal);
          const totalPaidAll = updatedLignes.reduce((sum, l) => sum + (l.totalPaye || 0), 0);
          const newReste = Math.max(0, rembVal - totalPaidAll - (row.montantExclu || 0));
          const isAllRejected = updatedLignes.every(l => l.statut === 'Rejeté');
          const isFullyPaid = totalPaidAll >= rembVal || newReste <= 0;

          updatedPrestations[pIndex] = {
            ...prest,
            totalPaye: totalPaidAll,
            resteAPayer: newReste,
            lignes: updatedLignes,
            statut: isAllRejected ? 'Rejeté' : isFullyPaid ? 'Payé' : totalPaidAll > 0 ? 'Partiellement payé' : prest.statut
          };
        }
      } else {
        // Unlinked settlement line: do NOT create a fake Prestation in the medical invoices database.
        // It is safely registered as a LignePaiement in the Paiement object,
        // ready to be linked anytime from the Paiements view.
        targetPrestationId = '';
        targetLigneId = '';

        // Find or create patient and update their dossier if immatriculation is found
        let targetPersonne = Array.from(finalPersonnesMap.values()).find(p => 
          (hasRealMatricule && p.matricule.toLowerCase() === rowMatricule.toLowerCase()) ||
          p.nomPrenom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() === normRowNom
        );

        if (targetPersonne) {
          if (hasRealMatricule && targetPersonne.matricule.trim() !== rowMatricule) {
            targetPersonne = {
              ...targetPersonne,
              matricule: rowMatricule,
              sousSociete: row.sousSociete || targetPersonne.sousSociete
            };
            finalPersonnesMap.set(targetPersonne.id, targetPersonne);
          }
        } else if (hasRealMatricule || row.nomPrenom) {
          targetPersonne = {
            id: generateId(`per-new-${idx}`),
            matricule: hasRealMatricule ? rowMatricule : `MAT-${idx + 100}`,
            nomPrenom: row.nomPrenom,
            societeId: matchedSoc?.id || 'soc-1',
            sousSociete: row.sousSociete || undefined,
            qualite: 'Adhérent Principal'
          };
          finalPersonnesMap.set(targetPersonne.id, targetPersonne);
        }
      }

      newLignesPaiement.push({
        id: generateId(`lp-${idx}`),
        paiementId: paymentId,
        lignePrestationId: targetLigneId || undefined,
        prestationId: targetPrestationId || undefined,
        prestationNumero: row.matchedCandidate?.prestationNum || '-',
        dateSoins: row.dateSoins,
        immatriculation: rowMatricule || '-',
        nomBaseAssurance: row.nomPrenom,
        nomAgent: row.nomPrenom,
        totalPaye: row.netAPayer,
        montantPaye: row.netAPayer,
        ticketModerateur: row.participation,
        montantExclu: row.montantExclu,
        montantReclame: row.montantBrut,
        actesPayes: [{ code: row.actCode, libelle: row.actLibelle, montant: row.netAPayer }],
        commentaire: `Règlement ${parsedDoc.numeroBordereau || ''} - Acte ${row.actCode}`
      });
    });

    const totalReclame = selectedRows.reduce((s, r) => s + r.montantBrut, 0);
    const totalPaye = selectedRows.reduce((s, r) => s + r.netAPayer, 0);
    const totalModerateur = selectedRows.reduce((s, r) => s + r.participation, 0);
    const totalExclu = selectedRows.reduce((s, r) => s + r.montantExclu, 0);

    const nouveauPaiement: Paiement = {
      id: paymentId,
      numeroBordereau: parsedDoc.numeroBordereau || parsedDoc.numeroFacture || `BORD-${Date.now().toString().substring(6)}`,
      datePaiement: parsedDoc.dateEmission || new Date().toISOString().split('T')[0],
      dateSaisie: new Date().toISOString().split('T')[0],
      societeId: matchedSoc?.id || 'soc-1',
      modePaiement: 'Virement bancaire',
      referencePaiement: `VIR-${parsedDoc.numeroBordereau || Date.now().toString().substring(6)}`,
      totalReclame,
      totalPaye: totalPaye - (parsedDoc.remise || 0),
      totalModerateur,
      totalExclu,
      remise: parsedDoc.remise || 0,
      statut: 'Validé',
      notes: `Importation Décompte ${matchedSoc?.nom || parsedDoc.clientDoit} - ${selectedRows.length} actes rattachés`,
      lignes: newLignesPaiement
    };

    const finalPersonnesList = Array.from(finalPersonnesMap.values());
    onSavePaiement(nouveauPaiement, updatedPrestations, createdSocietes, finalPersonnesList);

    // Sequential Queue check: proceed to next file if present
    const currentFileName = fileQueue[currentFileIndex]?.name || parsedDoc.numeroBordereau || 'Fichier';
    const nextBatchHistory = [...batchHistory, { fileName: currentFileName, count: selectedRows.length, status: 'SUCCESS' as const }];
    setBatchHistory(nextBatchHistory);

    if (fileQueue.length > 1 && currentFileIndex + 1 < fileQueue.length) {
      const nextIdx = currentFileIndex + 1;
      setCurrentFileIndex(nextIdx);
      const nextFile = fileQueue[nextIdx];
      setParsedDoc(null);
      setRows([]);
      setErrorMessage(null);
      setSearchingRowId(null);
      setBatchNotice(`Fichier ${currentFileIndex + 1} « ${currentFileName} » importé avec succès (${selectedRows.length} actes). Traitement du fichier suivant ${nextIdx + 1} / ${fileQueue.length} (${nextFile.name})...`);
      processFile(nextFile);
    } else {
      const totalImportedCount = nextBatchHistory.reduce((acc, h) => acc + h.count, 0);
      if (fileQueue.length > 1) {
        alert(`Traitement par lot terminé avec succès !\n${fileQueue.length} fichier(s) traité(s), ${totalImportedCount} actes de règlement enregistrés.`);
      }
      handleResetAndBack();
      onClose();
    }
  };

  const handleValidateAndSave = () => {
    if (parsedDoc && isExactDuplicate) {
      alert(`Attention : Le bordereau de règlement N° "${bordereauRefDoc}" existe déjà avec un montant identique (${formatMoney(exactAmountDuplicates[0]?.totalPaye || 0)}). La validation est bloquée pour éviter un double encaissement.`);
      return;
    }
    
    // Check if there are unlinked rows selected
    const unlinkedCount = selectedRows.filter(r => !r.matchedCandidate).length;
    if (unlinkedCount > 0) {
      setShowUnlinkedConfirmModal(true);
      return;
    }

    executeValidateAndSave();
  };

  const cleanNum = (n?: string) => (n || '').replace(/[\s\-\_\.\/]/g, '').toUpperCase();
  const bordereauRefDoc = parsedDoc?.numeroBordereau || parsedDoc?.numeroFacture || '';
  const bordereauClean = cleanNum(bordereauRefDoc);
  
  const selectedRows = rows.filter(r => r.selected);
  const totalSelectedPaye = selectedRows.reduce((s, r) => s + r.netAPayer, 0);
  const docNetTotal = parsedDoc ? (parsedDoc.totalNetAPayer || totalSelectedPaye) : totalSelectedPaye;

  // Check if bordereau reference already exists in paiements
  const matchingRefPaiements = bordereauClean
    ? paiements.filter(p => cleanNum(p.numeroBordereau) === bordereauClean || cleanNum(p.referencePaiement) === bordereauClean)
    : [];

  // Exact duplicate: SAME reference AND SAME payment date AND SAME total amount (tolerance < 2 Ar)
  const exactAmountDuplicates = matchingRefPaiements.filter(p => {
    const pTotal = Number(p.totalPaye || 0);
    const pDate = p.datePaiement ? p.datePaiement.split('T')[0] : '';
    const docDate = parsedDoc?.dateEmission ? parsedDoc.dateEmission.split('T')[0] : '';
    const isSameDate = Boolean(pDate && docDate && pDate === docDate);
    const isSameAmount = Math.abs(pTotal - docNetTotal) < 2 || Math.abs(pTotal - totalSelectedPaye) < 2;
    return isSameDate && isSameAmount;
  });

  // Reference match with a different amount (e.g. tranche, installment, partial payment)
  const differentAmountPaiements = matchingRefPaiements.filter(p => 
    !exactAmountDuplicates.some(ed => ed.id === p.id)
  );

  // ONLY strictly block if both reference AND amount are identical
  const isExactDuplicate = exactAmountDuplicates.length > 0;
  const isDuplicateBordereau = isExactDuplicate;
  const hasRefMatchWithDifferentAmount = differentAmountPaiements.length > 0 && !isExactDuplicate;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-6xl rounded-2xl bg-white shadow-2xl flex flex-col max-h-[94vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            {parsedDoc && (
              <button
                onClick={handleResetAndBack}
                title="Retour au choix de document"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 text-xs font-semibold shadow-xs transition"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Retour</span>
              </button>
            )}
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {parsedDoc ? `Rapprochement Décompte : ${parsedDoc.numeroBordereau || parsedDoc.clientDoit}` : 'Importation Décompte Règlement (ASCOMA, MCI CARE, BSA)'}
              </h3>
              <p className="text-xs text-slate-500">
                {parsedDoc 
                  ? `Confrontation intelligente par Date de Soins et Montant Brut sans ticket modérateur (${selectedRows.length} actes).`
                  : 'Rapprochement automatique des règlements avec les actes prescrits ouverts par comparaison de date et montant initial.'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Multi-File Sequential Processing Header */}
        {fileQueue.length > 1 && (
          <div className="border-b border-indigo-100 bg-gradient-to-r from-indigo-50/90 via-sky-50/70 to-indigo-50/90 px-6 py-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white font-black text-xs shadow-xs">
                  <Files className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-indigo-900">
                      File d'attente Décomptes : Fichier {currentFileIndex + 1} / {fileQueue.length}
                    </span>
                    <span className="text-[11px] font-bold text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded-full">
                      Traitement séquentiel
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 font-medium truncate max-w-md">
                    Fichier en cours : <strong className="text-slate-900 font-bold">{fileQueue[currentFileIndex]?.name}</strong>
                  </p>
                </div>
              </div>

              {/* Progress Steps / Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleSkipCurrentFile}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-[11px] font-semibold transition shadow-2xs cursor-pointer"
                  title="Ignorer ce décompte et passer au fichier suivant dans la file"
                >
                  <FastForward className="w-3.5 h-3.5 text-slate-500" />
                  <span>Ignorer ce fichier</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetAndBack}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 text-[11px] font-semibold transition cursor-pointer"
                  title="Arrêter l'importation de toute la liste de fichiers"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Arrêter la file</span>
                </button>
              </div>
            </div>

            {/* Queue Files Horizontal Stepper */}
            <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
              {fileQueue.map((file, idx) => {
                const isCurrent = idx === currentFileIndex;
                const isPassed = idx < currentFileIndex;
                const historyItem = batchHistory.find(h => h.fileName === file.name);
                const isSkipped = historyItem?.status === 'SKIPPED';

                return (
                  <div
                    key={`${file.name}-${idx}`}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium whitespace-nowrap shrink-0 border transition ${
                      isCurrent
                        ? 'bg-indigo-600 text-white font-bold border-indigo-700 shadow-xs'
                        : isPassed
                        ? isSkipped
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-white/80 text-slate-500 border-slate-200'
                    }`}
                  >
                    {isCurrent && <RefreshCw className="w-3 h-3 animate-spin shrink-0" />}
                    {isPassed && !isSkipped && <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />}
                    {isPassed && isSkipped && <FastForward className="w-3 h-3 text-amber-600 shrink-0" />}
                    {!isCurrent && !isPassed && <Clock className="w-3 h-3 text-slate-400 shrink-0" />}
                    <span className="truncate max-w-[140px]">{idx + 1}. {file.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {batchNotice && (
            <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900 font-semibold shadow-2xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{batchNotice}</span>
            </div>
          )}

          {errorMessage && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <div>
                  <div className="font-bold text-rose-950">Échec du traitement</div>
                  <div className="mt-0.5">{errorMessage}</div>
                  {lastUploadedFile && (
                    <div className="text-[11px] text-rose-700/80 font-mono mt-1">
                      Fichier : {lastUploadedFile.name} ({(lastUploadedFile.size / 1024).toFixed(1)} Ko)
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-rose-200">
                <button
                  type="button"
                  onClick={handleRetryLastFile}
                  disabled={isProcessing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-500 transition cursor-pointer"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
                  <span>{isProcessing ? 'Nouvelle tentative...' : 'Réessayer'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    excelInputRef.current?.click();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-rose-300 text-rose-800 hover:bg-rose-100 font-medium transition cursor-pointer"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Choisir un autre fichier</span>
                </button>
                {fileQueue.length > 1 && currentFileIndex + 1 < fileQueue.length && (
                  <button
                    type="button"
                    onClick={handleSkipCurrentFile}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 border border-amber-300 text-amber-900 hover:bg-amber-200 font-semibold transition cursor-pointer"
                  >
                    <FastForward className="h-3.5 w-3.5" />
                    <span>Passer au fichier suivant ({currentFileIndex + 2}/{fileQueue.length})</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {!parsedDoc && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-emerald-50/60 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-950">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-700 shrink-0" />
                  <span>
                    Importez vos bordereaux de règlement au format Excel. L'organisme et la société payeuse sont automatiquement détectés depuis les colonnes du fichier.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={downloadDecomptesExcelTemplate}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-emerald-300 text-emerald-800 font-bold hover:bg-emerald-100 text-xs shrink-0 shadow-2xs transition cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Télécharger Modèle Excel</span>
                </button>
              </div>

              {/* Excel Upload Area */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const files = e.dataTransfer.files;
                  if (files && files.length > 0) {
                    handleFilesSelected(files);
                  }
                }}
                className="flex min-h-52 flex-col items-center justify-center space-y-3 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/30 p-8 text-center transition hover:border-emerald-500 hover:bg-emerald-50/50"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-xs text-emerald-600 border border-emerald-100">
                  {isProcessing ? <RefreshCw className="h-6 w-6 animate-spin" /> : <FileSpreadsheet className="h-6 w-6" />}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">
                    {isProcessing ? 'Confrontation des actes en cours...' : 'Déposez un ou plusieurs fichiers Excel (.xlsx, .xls, .csv)'}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-md">
                    Sélectionnez un ou plusieurs bordereaux Excel. Ils seront traités séquentiellement un par un avec rapprochement automatique.
                  </p>
                </div>
                <input
                  type="file"
                  ref={excelInputRef}
                  onChange={handleFileUpload}
                  accept=".xlsx,.xls,.csv"
                  multiple
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => {
                    excelInputRef.current?.click();
                  }}
                  disabled={isProcessing}
                  className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600 shadow-xs cursor-pointer flex items-center gap-2"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Parcourir des fichiers Excel (Mono ou Multi-fichiers)</span>
                </button>
              </div>
            </div>
          )}

          {parsedDoc && (
            <div className="space-y-4">
              {/* DUPLICATE BLOCKING BANNER IF BORDEREAU ALREADY EXISTS WITH IDENTICAL AMOUNT */}
              {isExactDuplicate && (
                <div className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-4 shadow-sm text-rose-900 animate-in fade-in">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white font-bold shadow-xs">
                      <ShieldAlert className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-black uppercase tracking-wider text-rose-800 bg-rose-200 px-2 py-0.5 rounded-md">
                          Doublon Strict Détecté (Même Référence & Même Montant)
                        </span>
                        <span className="text-xs font-bold text-rose-700">
                          {exactAmountDuplicates.length} paiement(s) déjà enregistré(s) avec cette référence et ce même montant ({formatMoney(exactAmountDuplicates[0]?.totalPaye || 0)})
                        </span>
                      </div>
                      <p className="text-xs text-rose-800 mt-1 font-medium leading-relaxed">
                        Le numéro de bordereau / référence <strong>« {bordereauRefDoc} »</strong> existe déjà dans la base des règlements avec un montant identique de <strong>{formatMoney(exactAmountDuplicates[0]?.totalPaye || 0)}</strong> (enregistré le {formatDate(exactAmountDuplicates[0]?.datePaiement)}). 
                        Pour éviter les doubles encaissements et les erreurs comptables, la validation de ce bordereau est <strong>bloquée</strong>. Si ce décompte constitue un nouveau paiement distinct, vous pouvez modifier sa référence ci-dessous ou supprimer l'ancien paiement.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* INFORMATIVE BANNER IF BORDEREAU EXISTS WITH DIFFERENT AMOUNT (NON-BLOCKING) */}
              {hasRefMatchWithDifferentAmount && (
                <div className="rounded-2xl border-2 border-sky-300 bg-sky-50 p-4 shadow-sm text-sky-950 animate-in fade-in">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white font-bold shadow-xs">
                      <Info className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-black uppercase tracking-wider text-sky-800 bg-sky-200 px-2 py-0.5 rounded-md">
                          Information Référence (Montants Différents)
                        </span>
                        <span className="text-xs font-semibold text-sky-800">
                          {differentAmountPaiements.length} paiement(s) antérieur(s) trouvé(s)
                        </span>
                      </div>
                      <p className="text-xs text-sky-800 mt-1 font-medium leading-relaxed">
                        La référence <strong>« {bordereauRefDoc} »</strong> a déjà été enregistrée pour un montant de <strong>{differentAmountPaiements.map(p => formatMoney(p.totalPaye)).join(', ')}</strong>, alors que ce bordereau totalise <strong>{formatMoney(totalSelectedPaye)}</strong>. 
                        Les montants étant différents (ex: tranche, acompte, complément), <strong>l'enregistrement est autorisé</strong>.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Document Overview Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
                <div>
                  <span className="text-slate-500 block">Organisme / Garant</span>
                  <strong className="text-slate-900 font-bold text-sm">{parsedDoc.clientDoit}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Réf Bordereau</span>
                  <div className="flex items-center gap-1 mt-1">
                    <strong className="text-sm font-bold text-emerald-800 font-mono bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 shadow-2xs">
                      {parsedDoc.numeroBordereau || parsedDoc.numeroFacture || 'BORDEREAU'}
                    </strong>
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 block">Lignes à Régler</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="font-bold text-emerald-700">{confrontStats.linkedCount} rattachées</span>
                    <span className="text-slate-400">•</span>
                    <span className="font-semibold text-amber-700">{confrontStats.unlinked} non rattachées</span>
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 block">Net Réglé par l'Assurance</span>
                  <strong className="text-emerald-700 font-bold text-sm">{formatMoney(parsedDoc.totalNetAPayer)}</strong>
                </div>

                {/* Progress bar for reconciliation score */}
                <div className="col-span-2 sm:col-span-4 rounded-xl border border-slate-200 bg-white p-3 space-y-1.5 mt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      Taux de Rapprochement Automatique des Actes :
                    </span>
                    <span className="font-extrabold text-emerald-800 font-mono text-xs">
                      {confrontStats.matchPercentage}% ({confrontStats.linkedCount} / {confrontStats.total} actes rattachés)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden flex shadow-inner">
                    <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${(confrontStats.perfect / (confrontStats.total || 1)) * 100}%` }} title="Même Date & Même Montant" />
                    <div className="bg-sky-500 h-full transition-all duration-300" style={{ width: `${(confrontStats.sameDate / (confrontStats.total || 1)) * 100}%` }} title="Même Date" />
                    <div className="bg-purple-500 h-full transition-all duration-300" style={{ width: `${(confrontStats.sameAmount / (confrontStats.total || 1)) * 100}%` }} title="Même Montant" />
                    <div className="bg-amber-400 h-full transition-all duration-300" style={{ width: `${(confrontStats.verify / (confrontStats.total || 1)) * 100}%` }} title="À vérifier" />
                  </div>
                </div>
              </div>

              {/* Matricule synchronization informational banner */}
              {matriculeSyncStats.withMatricule > 0 && (
                <div className="flex items-center gap-3 rounded-xl border border-emerald-300 bg-emerald-50/90 px-4 py-2.5 text-xs text-emerald-950 shadow-2xs">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white shrink-0 shadow-2xs">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-emerald-950">
                      Mise à jour automatique du dossier des assurés :
                    </div>
                    <div className="text-[11px] text-emerald-800">
                      <strong>{matriculeSyncStats.withMatricule}</strong> immatriculation(s) détectée(s) dans le fichier.
                      {matriculeSyncStats.willUpdateExisting > 0 && ` ${matriculeSyncStats.willUpdateExisting} dossier(s) d'assuré(s) existant(s) seront automatiquement actualisé(s) avec leur nouvelle immatriculation.`}
                      {matriculeSyncStats.willCreateNew > 0 && ` ${matriculeSyncStats.willCreateNew} nouvelle(s) fiche(s) assuré(s) seront créée(s) avec leur immatriculation.`}
                    </div>
                  </div>
                </div>
              )}

              {/* Grouping Toggle Banner (Same Person + Same Date + Same Act) */}
              <div className="flex items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50/60 px-4 py-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-indigo-600 text-white font-bold text-[11px]">
                    ACTES
                  </span>
                  <div>
                    <div className="font-bold text-indigo-950">
                      Regroupement automatique des articles par acte (même personne, même date, même acte)
                    </div>
                    <div className="text-[11px] text-indigo-700">
                      Fusionne les articles de pharmacie/soins multiples en une seule ligne globale d'acte pour correspondre à votre base de soins.
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-semibold text-slate-700">
                    {groupOnImport ? 'Regroupement Actif' : 'Lignes Détaillées'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleToggleGrouping(!groupOnImport)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                      groupOnImport ? 'bg-indigo-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        groupOnImport ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Toolbar: Search Table, Sorting & Fast Match Shortcuts */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 space-y-3 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Table Search Input */}
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={tableSearchQuery}
                      onChange={(e) => setTableSearchQuery(e.target.value)}
                      placeholder="Rechercher par patient, matricule, code acte, montant ou date dans le tableau..."
                      className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-8 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 shadow-2xs"
                    />
                    {tableSearchQuery && (
                      <button
                        onClick={() => setTableSearchQuery('')}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Sorting & Batch Actions */}
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {/* Sort Selector */}
                    <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-2xs">
                      <span className="text-slate-500 text-[11px] font-medium">Trier par :</span>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
                      >
                        <option value="DEFAULT">Ordre du fichier</option>
                        <option value="STATUS">Statut (Non rattachés d'abord)</option>
                        <option value="DATE">Date Soins</option>
                        <option value="PATIENT">Nom Patient</option>
                        <option value="AMOUNT">Montant Net</option>
                      </select>
                      {sortBy !== 'DEFAULT' && (
                        <button
                          onClick={() => setSortOrder(prev => prev === 'ASC' ? 'DESC' : 'ASC')}
                          className="text-xs font-bold text-indigo-700 hover:bg-indigo-50 px-1 py-0.5 rounded cursor-pointer"
                          title="Changer le sens du tri"
                        >
                          {sortOrder === 'ASC' ? '↑ ASC' : '↓ DESC'}
                        </button>
                      )}
                    </div>

                    {/* Auto-link batch action */}
                    <button
                      type="button"
                      onClick={handleAutoLinkAllSuggestions}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-2xs transition cursor-pointer"
                      title="Rattacher automatiquement toutes les lignes non rattachées disposant d'une suggestion de candidat"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Rattacher les suggestions</span>
                    </button>
                  </div>
                </div>

                {/* Legend & Filter Chips with counts & selection shortcuts */}
                <div className="border-t border-slate-200/80 pt-2 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 font-bold text-slate-700 text-xs">
                      <Tag className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Filtres par statut de comparaison :</span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="text-slate-400 font-medium">Cocher rapides :</span>
                      <button
                        onClick={() => handleSelectByStatus('ALL')}
                        className="text-indigo-700 font-semibold hover:underline cursor-pointer"
                      >
                        Tous
                      </button>
                      <span className="text-slate-300">•</span>
                      <button
                        onClick={() => handleSelectByStatus('LINKED')}
                        className="text-emerald-700 font-semibold hover:underline cursor-pointer"
                      >
                        Rattachés
                      </button>
                      <span className="text-slate-300">•</span>
                      <button
                        onClick={() => handleSelectByStatus('UNLINKED')}
                        className="text-amber-700 font-semibold hover:underline cursor-pointer"
                      >
                        Non rattachés
                      </button>
                      <span className="text-slate-300">•</span>
                      <button
                        onClick={() => handleToggleSelectAll(false)}
                        className="text-slate-500 hover:underline cursor-pointer"
                      >
                        Aucun
                      </button>
                    </div>
                  </div>

                  {/* Filter Chips */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setConfrontFilter('ALL')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                        confrontFilter === 'ALL'
                          ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>Tous</span>
                      <span className="bg-white/20 px-1.5 py-0.2 rounded-full text-[10px]">{confrontStats.total}</span>
                    </button>

                    <button
                      onClick={() => setConfrontFilter('PERFECT')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                        confrontFilter === 'PERFECT'
                          ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>Même Date & Même Montant</span>
                      <span className="bg-emerald-200/70 text-emerald-900 px-1.5 py-0.2 rounded-full text-[10px] font-bold">{confrontStats.perfect}</span>
                    </button>

                    <button
                      onClick={() => setConfrontFilter('SAME_DATE')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                        confrontFilter === 'SAME_DATE'
                          ? 'bg-sky-700 text-white border-sky-700 shadow-2xs'
                          : 'bg-sky-50 text-sky-800 border-sky-300 hover:bg-sky-100'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                      <span>Même Date (Montant diff.)</span>
                      <span className="bg-sky-200/70 text-sky-900 px-1.5 py-0.2 rounded-full text-[10px] font-bold">{confrontStats.sameDate}</span>
                    </button>

                    <button
                      onClick={() => setConfrontFilter('SAME_AMOUNT')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                        confrontFilter === 'SAME_AMOUNT'
                          ? 'bg-purple-700 text-white border-purple-700 shadow-2xs'
                          : 'bg-purple-50 text-purple-800 border-purple-300 hover:bg-purple-100'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                      <span>Même Montant (Date diff.)</span>
                      <span className="bg-purple-200/70 text-purple-900 px-1.5 py-0.2 rounded-full text-[10px] font-bold">{confrontStats.sameAmount}</span>
                    </button>

                    <button
                      onClick={() => setConfrontFilter('VERIFY')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                        confrontFilter === 'VERIFY'
                          ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                          : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      <span>À Vérifier (Écarts)</span>
                      <span className="bg-amber-200/70 text-amber-900 px-1.5 py-0.2 rounded-full text-[10px] font-bold">{confrontStats.verify}</span>
                    </button>

                    <button
                      onClick={() => setConfrontFilter('UNLINKED')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                        confrontFilter === 'UNLINKED'
                          ? 'bg-slate-700 text-white border-slate-700 shadow-2xs'
                          : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                      <span>Non Rattachés (Créer)</span>
                      <span className="bg-slate-200 text-slate-800 px-1.5 py-0.2 rounded-full text-[10px] font-bold">{confrontStats.unlinked}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Table of settlement lines with live act attachment & color-coding */}
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 w-8">
                        <input
                          type="checkbox"
                          checked={selectedRows.length === rows.length}
                          onChange={(e) => handleToggleSelectAll(e.target.checked)}
                          className="rounded text-indigo-600"
                        />
                      </th>
                      <th className="py-2.5 px-3">Date Soins</th>
                      <th className="py-2.5 px-3">Adhérent & Matricule</th>
                      <th className="py-2.5 px-3">Acte Règlement (Brut sans TM)</th>
                      <th className="py-2.5 px-3 min-w-[320px]">Acte Prescrit Rattaché (Confrontation)</th>
                      <th className="py-2.5 px-3 text-right">Net Réglé</th>
                      <th className="py-2.5 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedRows.map((row) => {
                      const matched = row.matchedCandidate;
                      const confront = getConfrontationDetails(row.dateSoins, row.montantBrut, row.netAPayer, matched, row.participation);

                      return (
                        <tr
                          key={row.rowId}
                          className={`hover:bg-slate-50/80 transition ${confront.rowBorderClass} ${
                            row.selected ? '' : 'opacity-60 bg-slate-50/50'
                          }`}
                        >
                          <td className="py-2.5 px-3">
                            <input
                              type="checkbox"
                              checked={row.selected}
                              onChange={() => handleToggleSelectRow(row.rowId)}
                              className="rounded text-indigo-600"
                            />
                          </td>
                          
                          {/* Date Soins */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="font-mono text-xs font-bold text-slate-800">
                              {formatDate(row.dateSoins)}
                            </div>
                          </td>

                          {/* Adherent / Patient */}
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900 text-xs">{row.nomPrenom}</div>
                            <div className="text-[11px] text-slate-600 font-mono flex items-center gap-1.5 flex-wrap mt-0.5">
                              {isRealMatricule(row.matricule) ? (
                                (() => {
                                  const normNom = (row.nomPrenom || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
                                  const candPerId = matched?.personneId;
                                  const existing = personnes.find(p => (candPerId && p.id === candPerId) || (p.matricule && p.matricule.toLowerCase() === row.matricule.toLowerCase()) || p.nomPrenom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() === normNom);
                                  
                                  if (existing && existing.matricule.trim().toLowerCase() !== row.matricule.trim().toLowerCase()) {
                                    return (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300" title={`Ancien matricule: ${existing.matricule || 'aucun'} ➔ Mise à jour vers: ${row.matricule}`}>
                                        <span>🔄 Maj Immat :</span>
                                        <span className="font-mono">{row.matricule}</span>
                                      </span>
                                    );
                                  } else if (existing) {
                                    return (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                        <span>✓ Immat :</span>
                                        <span className="font-mono">{row.matricule}</span>
                                      </span>
                                    );
                                  } else {
                                    return (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
                                        <span>✨ Nouveau :</span>
                                        <span className="font-mono">{row.matricule}</span>
                                      </span>
                                    );
                                  }
                                })()
                              ) : (
                                <span className="text-slate-400 text-[10px]">Mat: -</span>
                              )}
                              {row.sousSociete ? <span className="text-slate-500 font-sans">({row.sousSociete})</span> : ''}
                            </div>
                            {row.articlesCount && row.articlesCount > 1 ? (
                              <div className="mt-1">
                                <span 
                                  className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200"
                                  title={row.mergedArticles?.join(' • ') || row.actLibelle}
                                >
                                  📦 {row.articlesCount} articles regroupés
                                </span>
                              </div>
                            ) : null}
                          </td>

                          {/* Acte Decompte (Gross amount without ticket moderator) */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200">
                              <span>{row.actCode}</span>
                              <span className="text-[10px] text-indigo-700 font-semibold">Brut: {formatMoney(row.montantBrut)}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[170px]" title={row.actLibelle}>
                              {row.articlesCount && row.articlesCount > 1 ? `Total: ${row.articlesCount} articles` : row.actLibelle}
                            </div>
                            {row.participation > 0 && (
                              <div className="text-[10px] text-amber-700 font-medium">
                                TM: {formatMoney(row.participation)}
                              </div>
                            )}
                          </td>

                          {/* Matched Prescription Act with Live Comparison & Color Coding */}
                          <td className="py-2.5 px-3 min-w-[340px]">
                            {matched ? (
                              <div className={`rounded-xl border p-2.5 text-xs space-y-2 shadow-2xs ${confront.cardBorderClass}`}>
                                {/* 1. En-tête : Référence Facture & Badge de Statut */}
                                <div className="flex items-center justify-between gap-2 border-b border-slate-200/60 pb-1.5">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <FileText className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                    <span className="font-mono font-bold text-slate-900 text-[11px] truncate" title={`Référence Facture : ${matched.prestationNum}`}>
                                      {matched.prestationNum ? `Facture N° ${matched.prestationNum}` : 'Facture en Base'}
                                    </span>
                                  </div>
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border shrink-0 ${confront.badgeClass}`}>
                                    {confront.type === 'PERFECT' && <CheckCircle2 className="w-3 h-3 text-emerald-700" />}
                                    {confront.type === 'SAME_DATE' && <CalendarCheck className="w-3 h-3 text-sky-700" />}
                                    {confront.type === 'SAME_AMOUNT' && <Tag className="w-3 h-3 text-purple-700" />}
                                    {confront.type === 'VERIFY' && <AlertTriangle className="w-3 h-3 text-amber-700" />}
                                    <span>{confront.label}</span>
                                  </span>
                                </div>

                                {/* 2. Acte & Patient (Alerte si patient différent) */}
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 shrink-0">
                                      {matched.codeActe}
                                    </span>
                                    <span className="font-semibold text-slate-800 text-[11px] truncate" title={matched.libelleActe}>
                                      {matched.libelleActe}
                                    </span>
                                  </div>

                                  {(() => {
                                    const rowNameNorm = (row.nomPrenom || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
                                    const candNameNorm = (matched.personneNom || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
                                    if (rowNameNorm && candNameNorm && !rowNameNorm.includes(candNameNorm) && !candNameNorm.includes(rowNameNorm)) {
                                      return (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shrink-0" title={`Patient en base : ${matched.personneNom}`}>
                                          <User className="w-2.5 h-2.5" />
                                          <span>Base: {matched.personneNom}</span>
                                        </span>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>

                                {/* 3. Encadré comparatif côte-à-côte (Tableau Synthétique Ultra-Clair) */}
                                <div className="bg-white/95 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200/80 space-y-1.5 text-[10px]">
                                  <div className="grid grid-cols-2 gap-2 text-slate-700 border-b border-slate-100 pb-1">
                                    <div>
                                      <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block">Décompte Excel</span>
                                      <div className="font-medium text-slate-900">Date: {formatDate(row.dateSoins)}</div>
                                      <div className="font-mono text-slate-800">
                                        Brut: <strong className="text-slate-900">{formatMoney(row.montantBrut)}</strong>
                                      </div>
                                      {row.participation > 0 && (
                                        <div className="font-mono text-amber-700 text-[9.5px]">
                                          TM: -{formatMoney(row.participation)}
                                        </div>
                                      )}
                                    </div>
                                    <div className="border-l border-slate-100 pl-2">
                                      <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block">Facture en Base</span>
                                      <div className="font-medium text-slate-900">Date: {formatDate(matched.prestationDate)}</div>
                                      <div className="font-mono text-slate-800">
                                        Initial: <strong className="text-slate-900">{formatMoney(matched.montantInitial)}</strong>
                                      </div>
                                      <div className="font-mono text-emerald-700 text-[9.5px] font-semibold">
                                        Reste: {formatMoney(matched.resteAPayer)}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Explication Synthétique du Rapprochement */}
                                  <div className="text-[10px] font-medium leading-tight">
                                    {confront.isSameDate && confront.isSameMontantBrut ? (
                                      <span className="text-emerald-700 flex items-center gap-1 font-bold">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                        <span>Montants et dates parfaitement identiques ({formatMoney(row.montantBrut)}).</span>
                                      </span>
                                    ) : confront.isSameDate && (row.participation > 0 && Math.abs((row.montantBrut - row.participation) - matched.montantInitial) < 2) ? (
                                      <span className="text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 flex items-center gap-1 font-bold">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                        <span>Part Net Assurance ({formatMoney(row.montantBrut)} Brut - TM {formatMoney(row.participation)} = {formatMoney(row.montantBrut - row.participation)}) égale à la Facture ({formatMoney(matched.montantInitial)}).</span>
                                      </span>
                                    ) : !confront.isSameDate ? (
                                      <span className="text-amber-800 flex items-center gap-1 font-semibold">
                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                        <span>Date Décompte ({formatDate(row.dateSoins)}) ≠ Date Facture ({formatDate(matched.prestationDate)}).</span>
                                      </span>
                                    ) : (
                                      <span className="text-rose-800 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 flex items-center gap-1 font-bold">
                                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                        <span>Écart de Montant : Décompte ({formatMoney(row.montantBrut)}) ≠ Facture ({formatMoney(matched.montantInitial)}).</span>
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* 4. Pied de carte : Société / Entreprise */}
                                {matched.sousSociete && (
                                  <div className="text-[10px] text-slate-500 font-medium truncate pt-0.5">
                                    Entreprise : <span className="text-slate-800 font-semibold">{matched.sousSociete}</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              (() => {
                                const suggestions = getRowSuggestions(row);
                                return (
                                  <div className="space-y-2">
                                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-xs flex items-center justify-between shadow-2xs">
                                      <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                                        <AlertCircle className="h-4 w-4 text-slate-400 shrink-0" />
                                        <span>Aucun acte non réglé rattaché</span>
                                      </div>
                                      <span className="text-[10px] font-semibold text-slate-700 bg-slate-200 px-2 py-0.5 rounded border border-slate-300">
                                        Nouvelle Prestation
                                      </span>
                                    </div>

                                    {suggestions.length > 0 && (
                                      <div className="rounded-xl bg-indigo-50/90 border border-indigo-200 p-2.5 text-xs space-y-2 shadow-2xs">
                                        <div className="flex items-center justify-between text-[11px] text-indigo-950 font-bold">
                                          <span className="flex items-center gap-1">
                                            <Sparkles className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
                                            Suggestion(s) trouvée(s) :
                                          </span>
                                          <span className="text-[10px] text-indigo-700 font-medium">{suggestions.length} acte(s) disponible(s)</span>
                                        </div>
                                        <div className="space-y-1.5">
                                          {suggestions.map((sug) => (
                                            <div key={sug.lignePrestationId} className="flex items-center justify-between gap-2 bg-white p-2 rounded-lg border border-indigo-100 shadow-2xs text-[11px]">
                                              <div className="min-w-0 flex-1">
                                                <div className="font-extrabold text-slate-900 truncate uppercase tracking-tight">{sug.personneNom}</div>
                                                <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1.5 flex-wrap">
                                                  <span className="font-mono bg-slate-100 px-1 py-0.2 rounded text-slate-700">{sug.codeActe}</span>
                                                  <span>• Brut: {formatMoney(sug.montantInitial)}</span>
                                                  <span>• {formatDate(sug.prestationDate)}</span>
                                                </div>
                                              </div>
                                              <button
                                                type="button"
                                                onClick={() => handleAssignCandidate(row.rowId, sug)}
                                                className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] shrink-0 transition shadow-2xs cursor-pointer flex items-center gap-1"
                                                title="Lier cet acte en 1 clic"
                                              >
                                                <Link2 className="w-3 h-3" />
                                                Lier 1-Clic
                                              </button>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()
                            )}
                          </td>

                          {/* Net Regle */}
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-700 whitespace-nowrap">
                            {formatMoney(row.netAPayer)}
                          </td>

                          {/* Action */}
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <button
                              onClick={() => {
                                setSearchingRowId(row.rowId);
                                const firstWord = (row.nomPrenom || '').trim().split(/\s+/)[0] || '';
                                setActSearchQuery(firstWord || row.matricule || '');
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition shadow-2xs cursor-pointer"
                              title="Modifier ou rechercher un acte à rattacher"
                            >
                              <Search className="h-3 w-3" />
                              <span>{matched ? 'Changer' : 'Lier'}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Reset action */}
              <div className="flex justify-between items-center text-xs text-slate-500 pt-2">
                <div>
                  Affichage de <strong className="text-slate-800">{displayedRows.length}</strong> sur <strong>{rows.length}</strong> lignes
                </div>
                <button
                  onClick={() => {
                    setParsedDoc(null);
                    setRows([]);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-700 hover:underline cursor-pointer"
                >
                  Charger un autre décompte
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 bg-slate-50/70 rounded-b-2xl">
          <div>
            {parsedDoc && (
              <div className="text-xs text-slate-600">
                <strong className="text-slate-900 font-bold">{selectedRows.length}</strong> lignes à régler •{' '}
                Total règlement net : <strong className="text-emerald-700 font-bold">{formatMoney(totalSelectedPaye)}</strong>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {parsedDoc && (
              <button
                onClick={handleResetAndBack}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Retour</span>
              </button>
            )}
            <button
              onClick={handleClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              Annuler
            </button>
            {parsedDoc && (
              <button
                onClick={handleValidateAndSave}
                disabled={selectedRows.length === 0 || isExactDuplicate}
                className={`rounded-xl px-5 py-2 text-xs font-bold transition shadow-xs flex items-center gap-2 cursor-pointer ${
                  isExactDuplicate
                    ? 'bg-rose-600 text-white hover:bg-rose-500 opacity-60 cursor-not-allowed'
                    : 'bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50'
                }`}
                title={isExactDuplicate ? `Doublon strict détecté (Même référence, même date et même montant de ${formatMoney(exactAmountDuplicates[0]?.totalPaye || 0)})` : undefined}
              >
                {isExactDuplicate ? <Ban className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                <span>
                  {isExactDuplicate 
                    ? 'Doublon Strict (Même Réf., Date & Montant)' 
                    : fileQueue.length > 1 
                    ? `Valider et Enregistrer (${currentFileIndex + 1}/${fileQueue.length})` 
                    : 'Valider et Enregistrer le Règlement'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Manual Search & Act Matching Sub-Modal */}
      {searchingRowId && activeSearchingRow && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Rattacher un acte prescrit à cette ligne de règlement
                </h4>
                <p className="text-xs text-slate-500">
                  Pour : <strong className="text-slate-800">{activeSearchingRow.nomPrenom}</strong> (Mat: {activeSearchingRow.matricule || '-'}) • Date Soins : <strong>{formatDate(activeSearchingRow.dateSoins)}</strong> • Brut sans TM : <strong>{formatMoney(activeSearchingRow.montantBrut)}</strong>
                </p>
              </div>
              <button
                onClick={() => setSearchingRowId(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {/* Search input with Quick Filters */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={actSearchQuery}
                    onChange={(e) => setActSearchQuery(e.target.value)}
                    placeholder="Rechercher par nom de patient, matricule, n° facture, code acte (ex: CONS, MEDIC)..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-8 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    autoFocus
                  />
                  {actSearchQuery && (
                    <button
                      onClick={() => setActSearchQuery('')}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>
                    {filteredSearchCandidates.length} acte(s) disponible(s) au rattachement (triés par pertinence)
                  </span>
                  {actSearchQuery && (
                    <button
                      onClick={() => setActSearchQuery('')}
                      className="text-indigo-600 hover:underline font-semibold cursor-pointer"
                    >
                      Afficher tous les actes ouverts ({allEligibleActs.length})
                    </button>
                  )}
                </div>

                {/* Quick filter chips */}
                <div className="flex items-center gap-1.5 flex-wrap text-[10px] pt-0.5">
                  <span className="text-slate-400 font-medium">Filtres rapides :</span>
                  {(() => {
                    const firstWord = (activeSearchingRow.nomPrenom || '').trim().split(/\s+/)[0];
                    const fullName = (activeSearchingRow.nomPrenom || '').trim();
                    const mat = activeSearchingRow.matricule;
                    return (
                      <>
                        {firstWord && (
                          <button
                            type="button"
                            onClick={() => setActSearchQuery(firstWord)}
                            className={`px-2 py-0.5 rounded-md border transition font-medium cursor-pointer ${
                              actSearchQuery.trim().toLowerCase() === firstWord.toLowerCase()
                                ? 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-2xs'
                                : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                            }`}
                          >
                            Premier nom : {firstWord}
                          </button>
                        )}
                        {fullName && fullName !== firstWord && (
                          <button
                            type="button"
                            onClick={() => setActSearchQuery(fullName)}
                            className={`px-2 py-0.5 rounded-md border transition font-medium cursor-pointer ${
                              actSearchQuery.trim().toLowerCase() === fullName.toLowerCase()
                                ? 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-2xs'
                                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                            }`}
                          >
                            Nom complet : {fullName}
                          </button>
                        )}
                        {mat && mat !== '-' && (
                          <button
                            type="button"
                            onClick={() => setActSearchQuery(mat)}
                            className={`px-2 py-0.5 rounded-md border transition font-medium cursor-pointer ${
                              actSearchQuery.trim().toLowerCase() === mat.toLowerCase()
                                ? 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-2xs'
                                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                            }`}
                          >
                            Matricule : {mat}
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Act candidate list with live comparison badges */}
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                {filteredSearchCandidates.length === 0 ? (
                  <div className="p-8 text-center space-y-2">
                    <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
                    <div className="text-xs text-slate-600 font-medium">
                      Aucun acte en attente ou partiellement payé correspondant trouvé.
                    </div>
                    {allEligibleActs.length > 0 && (
                      <button
                        onClick={() => setActSearchQuery('')}
                        className="text-xs text-indigo-600 hover:underline font-bold cursor-pointer"
                      >
                        Voir tous les {allEligibleActs.length} actes disponibles
                      </button>
                    )}
                  </div>
                ) : (
                  filteredSearchCandidates.map((cand) => {
                    const compDetails = getConfrontationDetails(activeSearchingRow.dateSoins, activeSearchingRow.montantBrut, activeSearchingRow.netAPayer, cand);

                    return (
                      <div
                        key={cand.lignePrestationId}
                        className={`p-3.5 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                          compDetails.type === 'PERFECT'
                            ? 'bg-emerald-50/40 hover:bg-emerald-50/70 border-l-4 border-l-emerald-500'
                            : compDetails.type === 'SAME_DATE'
                            ? 'bg-sky-50/30 hover:bg-sky-50/60 border-l-4 border-l-sky-500'
                            : compDetails.type === 'SAME_AMOUNT'
                            ? 'bg-purple-50/30 hover:bg-purple-50/60 border-l-4 border-l-purple-500'
                            : 'hover:bg-indigo-50/40'
                        }`}
                      >
                        <div className="space-y-1.5 flex-1 min-w-0">
                          {/* 1. Nom du Patient en évidence (Priorité N°1) */}
                          <div className="flex items-center flex-wrap gap-2">
                            <span className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                              {cand.personneNom}
                            </span>
                            {cand.matricule && cand.matricule !== '-' && (
                              <span className="text-[10px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                Mat: {cand.matricule}
                              </span>
                            )}
                            {cand.sousSociete && (
                              <span className="text-indigo-700 font-semibold text-[11px] bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                                ({cand.sousSociete})
                              </span>
                            )}
                            {cand.prestationNum && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                (Facture N° {cand.prestationNum} • {formatDate(cand.prestationDate)})
                              </span>
                            )}
                          </div>

                          {/* 2. Act header & Libelle + Live confrontation badge */}
                          <div className="flex items-center flex-wrap gap-2 pt-0.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                              {cand.codeActe}
                            </span>
                            <span className="font-semibold text-slate-800 text-xs truncate">
                              {cand.libelleActe}
                            </span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border ${compDetails.badgeClass}`}>
                              <span>{compDetails.label}</span>
                            </span>
                          </div>

                          {/* Detailed price breakdown & live comparison */}
                          <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-200/80">
                            <span>
                              Prix Brut Initial: <strong className="text-slate-900">{formatMoney(cand.montantInitial)}</strong>
                              {compDetails.isSameMontantBrut && (
                                <span className="ml-1 text-[10px] text-emerald-700 font-bold">(Même montant)</span>
                              )}
                            </span>
                            <span>Ticket Mod.: <strong className="text-amber-700">{formatMoney(cand.ticketModerateur)}</strong></span>
                            <span>À Rembourser: <strong className="text-indigo-700">{formatMoney(cand.montantARembourser)}</strong></span>
                            <span>Déjà Réglé: <strong className="text-emerald-700">{formatMoney(cand.dejaPaye)}</strong></span>
                          </div>
                        </div>

                        {/* Right column: Reste a payer & Action */}
                        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                          <div className="text-left sm:text-right">
                            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Reste à régler</span>
                            <strong className="text-sm font-extrabold text-emerald-800 font-mono">
                              {formatMoney(cand.resteAPayer)}
                            </strong>
                          </div>
                          <button
                            onClick={() => handleAssignCandidate(activeSearchingRow.rowId, cand)}
                            className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                          >
                            <Link2 className="w-3.5 h-3.5" />
                            <span>Rattacher cet Acte</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Unlink / Create option */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => handleAssignCandidate(activeSearchingRow.rowId, null)}
                  className="inline-flex items-center gap-1.5 text-xs text-amber-700 hover:text-amber-800 font-semibold cursor-pointer"
                >
                  <Unlink className="h-3.5 w-3.5" />
                  <span>Ne pas rattacher (Créer une nouvelle prestation au vol)</span>
                </button>
                <button
                  onClick={() => setSearchingRowId(null)}
                  className="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Confirmation Modal for Missing Society */}
      {/* Modal d'Alerte : Société Inexistante dans la Base */}
      {missingSocPrompt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600 border border-rose-200 shrink-0">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Société non répertoriée</h3>
                <p className="text-xs font-semibold text-rose-600">Création automatique interdite</p>
              </div>
            </div>

            <div className="rounded-xl bg-rose-50/80 p-4 border border-rose-200 text-xs sm:text-sm text-slate-800 leading-relaxed space-y-2">
              <p>
                La société ou l'organisme payeur <strong className="font-bold text-rose-950">« {missingSocPrompt.socName} »</strong> figurant sur ce décompte n'existe pas dans la base de données.
              </p>
              <p className="text-xs text-slate-600">
                <strong>Information :</strong> Aucune nouvelle société ne peut être créée automatiquement lors d'une importation. Veuillez d'abord enregistrer cette société dans le paramétrage de l'application, ou sélectionner ci-dessous une société existante à laquelle rattacher ce décompte.
              </p>
            </div>

            <div className="space-y-1.5 pt-1">
              <label className="block text-xs font-bold text-slate-700">Rattacher à une société existante (optionnel) :</label>
              <select
                value={selectedOverrideSocId}
                onChange={(e) => setSelectedOverrideSocId(e.target.value)}
                className="w-full bg-white text-xs font-semibold rounded-xl p-2.5 border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="">-- Choisir une société existante --</option>
                {societes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nom} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              {selectedOverrideSocId && (
                <button
                  type="button"
                  onClick={() => {
                    const socId = selectedOverrideSocId;
                    setMissingSocPrompt(null);
                    setSelectedOverrideSocId('');
                    executeValidateAndSave(socId);
                  }}
                  className="w-full inline-flex justify-center items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-500 transition focus:outline-none cursor-pointer"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Rattacher et enregistrer le décompte
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setMissingSocPrompt(null);
                  setSelectedOverrideSocId('');
                }}
                className="w-full inline-flex justify-center items-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition focus:outline-none cursor-pointer"
              >
                <X className="h-4 w-4" />
                Fermer / Annuler l'importation
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Confirmation Modal for Unlinked Acts */}
      {showUnlinkedConfirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-200 shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Actes non rattachés détectés</h3>
                <p className="text-xs text-slate-500">Avertissement avant validation du règlement</p>
              </div>
            </div>

            <div className="rounded-xl bg-amber-50/70 p-4 border border-amber-200/80 text-xs sm:text-sm text-slate-700 leading-relaxed space-y-2">
              <p>
                Il y a <strong className="font-bold text-amber-900">{selectedRows.filter(r => !r.matchedCandidate).length} acte(s) non relié(s)</strong> à une prescription ou facture existante dans votre sélection (sur un total de {selectedRows.length} actes sélectionnés).
              </p>
              <p className="text-xs text-slate-600">
                Si vous continuez, ces lignes seront enregistrées dans le règlement en tant qu'actes autonomes (créant des prestations enregistrées au vol), et vous pourrez toujours les consulter et les filtrer sous <em>« Non reliés »</em> dans la vue des Règlements.
              </p>
              <p className="text-xs font-semibold text-slate-800">
                Souhaitez-vous quand même valider et continuer l'importation ?
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowUnlinkedConfirmModal(false);
                  executeValidateAndSave();
                }}
                className="flex-1 inline-flex justify-center items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 transition focus:outline-none cursor-pointer"
              >
                <Check className="h-4 w-4" />
                Continuer et enregistrer
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUnlinkedConfirmModal(false);
                  setConfrontFilter('UNLINKED');
                }}
                className="inline-flex justify-center items-center gap-2 rounded-xl bg-amber-100 px-4 py-2.5 text-xs font-semibold text-amber-900 hover:bg-amber-200 transition focus:outline-none cursor-pointer"
                title="Afficher uniquement les actes non reliés pour les vérifier et les lier"
              >
                <Unlink className="h-4 w-4" />
                Vérifier les non reliés
              </button>
              <button
                type="button"
                onClick={() => setShowUnlinkedConfirmModal(false)}
                className="inline-flex justify-center items-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition focus:outline-none cursor-pointer"
              >
                <X className="h-4 w-4" />
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
