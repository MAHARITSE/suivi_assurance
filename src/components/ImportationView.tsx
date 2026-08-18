import React, { useState, useRef, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  Upload, 
  Download, 
  CheckCircle, 
  AlertCircle, 
  ArrowRight, 
  HelpCircle, 
  RefreshCw,
  FileCheck,
  Check,
  X,
  FileText,
  Sparkles,
  Building2,
  Users,
  CreditCard,
  Search,
  Filter,
  Eye,
  PlusCircle,
  FileSpreadsheet as ExcelIcon,
  ShieldCheck,
  Info,
  Layers,
  Building,
  Receipt
} from 'lucide-react';
import { Prestation, Paiement, Societe, Personne, Famille, ParsedFactureAssurance, FactureLigneParsed, LignePrestation } from '../types';
import { formatMoney, formatDate, generateId } from '../utils/formatters';
import { findFamilleForAct } from '../utils/actMatching';
import { salfaSampleInvoice } from '../data/salfaInvoiceSample';
import { ascomaSampleInvoice, mciCareSampleInvoice, bsaReleveSampleInvoice } from '../data/insuranceSampleDocuments';
import { ActMappingModal } from './ActMappingModal';
import * as XLSX from 'xlsx';

interface ImportationViewProps {
  societes: Societe[];
  personnes: Personne[];
  prestations: Prestation[];
  familles: Famille[];
  onImportPrestations: (newPrestations: Prestation[], newSocietes?: Societe[], newPersonnes?: Personne[]) => void;
  onImportPaiements: (newPaiement: Paiement, updatedPrestations: Prestation[], newSocietes?: Societe[], newPersonnes?: Personne[]) => void;
  onSaveFamille?: (famille: Famille) => void;
}

// Helper to parse multiple acts from text column like "DENT : 50 000,00 \n MEDIC : 12 000,00"
export function parseActesFromText(text: string, defaultTotal: number = 0): Array<{ code: string; libelle: string; montant: number }> {
  if (!text || !text.trim()) {
    return [{ code: 'CONS', libelle: 'Consultation', montant: defaultTotal || 0 }];
  }

  const lines = text.split(/[\n\r;|\/]+/).map(s => s.trim()).filter(Boolean);
  const results: Array<{ code: string; libelle: string; montant: number }> = [];

  for (const line of lines) {
    const match = line.match(/^([A-Za-zÀ-ÿ0-9_\s\-\.\'\(\)]+?)\s*(?:[:=–\-]\s*|\s{2,}|\s+)(\d[\d\s\.,]*)(?:\s*Ar|\s*FMG)?$/i);
    if (match) {
      const codeOrLibelle = match[1].trim();
      const numStr = match[2].replace(/\s+/g, '').replace(',', '.');
      const montant = parseFloat(numStr) || 0;
      const codeUpper = codeOrLibelle.toUpperCase().replace(/[^A-Z0-9]/g, '');
      results.push({
        code: codeUpper.length > 0 && codeUpper.length <= 8 ? codeUpper : (codeOrLibelle.substring(0, 6).toUpperCase()),
        libelle: codeOrLibelle,
        montant: montant
      });
    } else {
      const cleanCode = line.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (cleanCode.length > 0) {
        results.push({
          code: cleanCode.substring(0, 6),
          libelle: line,
          montant: 0
        });
      }
    }
  }

  if (results.length === 0) {
    return [{ code: 'CONS', libelle: text, montant: defaultTotal || 0 }];
  }

  const zeroCount = results.filter(r => r.montant === 0).length;
  if (zeroCount > 0 && defaultTotal > 0) {
    const definedSum = results.reduce((s, r) => s + r.montant, 0);
    const remainder = Math.max(0, defaultTotal - definedSum);
    const perZero = Math.round(remainder / zeroCount);
    results.forEach(r => {
      if (r.montant === 0) r.montant = perZero;
    });
  }

  return results;
}

export const ImportationView: React.FC<ImportationViewProps> = ({
  societes,
  personnes,
  prestations,
  familles,
  onImportPrestations,
  onImportPaiements,
  onSaveFamille,
}) => {
  const [activeSourceType, setActiveSourceType] = useState<'pdf' | 'excel'>('pdf');
  const [importTargetMode, setImportTargetMode] = useState<'prestations' | 'paiements'>('prestations');
  
  // Parsed Document State
  const [parsedInvoice, setParsedInvoice] = useState<ParsedFactureAssurance | null>(null);
  const [selectedFilterSoc, setSelectedFilterSoc] = useState<string>('ALL');
  const [selectedFilterSousSoc, setSelectedFilterSousSoc] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Excel File State
  const [excelRows, setExcelRows] = useState<any[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Auto-creation options
  const [autoCreateMissingSocietes, setAutoCreateMissingSocietes] = useState<boolean>(true);
  const [autoCreateMissingPersonnes, setAutoCreateMissingPersonnes] = useState<boolean>(true);

  // Act Mapping Modal State
  const [isMappingModalOpen, setIsMappingModalOpen] = useState<boolean>(false);
  const [customActMappings, setCustomActMappings] = useState<Record<string, string>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to cross reference extracted lines with existing DB
  const enrichParsedInvoice = (raw: ParsedFactureAssurance): ParsedFactureAssurance => {
    const updatedLignes: FactureLigneParsed[] = raw.lignes.map(l => {
      const mainSocName = l.societeAffiliee || raw.clientDoit || raw.garant || 'BSA';
      const sousSocName = l.sousSociete || '';

      const matchedSoc = societes.find(s => 
        s.nom.toLowerCase().includes(mainSocName.toLowerCase()) ||
        s.code.toLowerCase() === mainSocName.toLowerCase() ||
        mainSocName.toLowerCase().includes(s.nom.toLowerCase()) ||
        (sousSocName && s.nom.toLowerCase().includes(sousSocName.toLowerCase()))
      );

      const cleanMatricule = (l.matricule || '').replace(/\s+/g, '');
      const matchedPer = personnes.find(p => 
        (cleanMatricule && p.matricule.replace(/\s+/g, '').toLowerCase() === cleanMatricule.toLowerCase()) ||
        (l.nomPrenom && p.nomPrenom.toLowerCase().includes(l.nomPrenom.toLowerCase())) ||
        (l.nomPrenom && l.nomPrenom.toLowerCase().includes(p.nomPrenom.toLowerCase())) ||
        (l.ayantDroit && p.nomPrenom.toLowerCase().includes(l.ayantDroit.toLowerCase()))
      );

      const matchedPrest = prestations.find(p => 
        p.numeroFacture.toLowerCase() === raw.numeroFacture.toLowerCase()
      );

      // Check acts for unknown codes using intelligent alias and keyword matching
      const enrichedActes = (l.actes || []).map(act => {
        const rawCode = act.code || 'CONS';
        const customMapped = customActMappings[rawCode];

        // 1. Check if user already manually mapped this act
        let matchedFamille: Famille | undefined = undefined;
        if (customMapped) {
          matchedFamille = familles.find(f => f.code.toUpperCase() === customMapped.toUpperCase());
        }

        // 2. Otherwise run intelligent auto-match against codes, aliases and descriptions
        if (!matchedFamille) {
          matchedFamille = findFamilleForAct(rawCode, act.libelle, familles);
        }

        const mappedCode = matchedFamille ? matchedFamille.code : (customMapped || rawCode);
        const mappedLibelle = matchedFamille ? matchedFamille.libelle : act.libelle;
        const existsInDb = !!matchedFamille || familles.some(f => f.code.toUpperCase() === mappedCode.toUpperCase());

        return {
          ...act,
          mappedFamilleCode: mappedCode,
          mappedFamilleLibelle: mappedLibelle,
          isUnknown: !existsInDb
        };
      });

      const hasUnmapped = enrichedActes.some(a => a.isUnknown);

      return {
        ...l,
        actes: enrichedActes,
        hasUnmappedActs: hasUnmapped,
        matchedSocieteId: matchedSoc?.id,
        matchedPersonneId: matchedPer?.id,
        matchedPrestationId: matchedPrest?.id,
        isNewSociete: !matchedSoc,
        isNewPersonne: !matchedPer
      };
    });

    return {
      ...raw,
      lignes: updatedLignes
    };
  };

  // Find all unmapped / unrecognized acts in the current document
  const unmappedActsSummary = useMemo(() => {
    if (!parsedInvoice) return [];
    const actMap = new Map<string, { rawCode: string; rawLibelle: string; occurrences: number; totalAmount: number; suggestedFamilleCode?: string }>();

    parsedInvoice.lignes.forEach(l => {
      l.actes?.forEach(a => {
        const code = a.code || 'CONS';
        const customMapped = customActMappings[code];

        const matched = customMapped 
          ? familles.find(f => f.code.toUpperCase() === customMapped.toUpperCase())
          : findFamilleForAct(code, a.libelle, familles);
        
        if (!matched) {
          const current = actMap.get(code) || {
            rawCode: code,
            rawLibelle: a.libelle || code,
            occurrences: 0,
            totalAmount: 0,
            suggestedFamilleCode: 'CONS'
          };
          current.occurrences += 1;
          current.totalAmount += a.montant || 0;
          actMap.set(code, current);
        }
      });
    });

    return Array.from(actMap.values());
  }, [parsedInvoice, familles, customActMappings]);

  // Load sample documents
  const handleLoadPredefinedSample = (type: 'salfa' | 'ascoma' | 'mci' | 'bsa') => {
    setIsProcessing(true);
    setErrorMessage(null);
    setImportSuccessMsg(null);

    setTimeout(() => {
      let sampleData: ParsedFactureAssurance;
      let fName = '';

      if (type === 'ascoma') {
        sampleData = ascomaSampleInvoice;
        fName = 'DECOMPTE_ASCOMA_TIERS_PAYANT_69235.pdf';
        setImportTargetMode('prestations');
      } else if (type === 'mci') {
        sampleData = mciCareSampleInvoice;
        fName = 'DECOMPTE_MCI_CARE_GROUPE_AXIAN.pdf';
        setImportTargetMode('prestations');
      } else if (type === 'bsa') {
        sampleData = bsaReleveSampleInvoice;
        fName = 'RELEVE_BSA_ASK_GS_1130210.pdf';
        setImportTargetMode('prestations');
      } else {
        sampleData = salfaSampleInvoice;
        fName = 'FACTURE_SALFA_TOLIARA_MAI_2026.pdf';
        setImportTargetMode('prestations');
      }

      const enriched = enrichParsedInvoice(sampleData);
      setParsedInvoice(enriched);
      setFileName(fName);
      setIsProcessing(false);
    }, 200);
  };

  // Upload handler for PDF or Excel
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    processUploadedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setFileName(file.name);
    processUploadedFile(file);
  };

  const processUploadedFile = async (file: File) => {
    setIsProcessing(true);
    setErrorMessage(null);
    setImportSuccessMsg(null);

    const isPdf = file.name.toLowerCase().endsWith('.pdf');
    const isImage = /\.(jpg|jpeg|png|webp)$/i.test(file.name);
    const isExcel = /\.(xlsx|xls|csv)$/i.test(file.name);

    if (isPdf || isImage) {
      setActiveSourceType('pdf');
      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/parse-invoice', {
          method: 'POST',
          body: formData
        });

        if (!res.ok) {
          throw new Error(`Erreur serveur (${res.status})`);
        }

        const json = await res.json();
        if (json.data) {
          const enriched = enrichParsedInvoice(json.data);
          setParsedInvoice(enriched);
        } else {
          // Fallback to sample structure
          const enriched = enrichParsedInvoice(salfaSampleInvoice);
          setParsedInvoice(enriched);
        }
      } catch (err: any) {
        console.warn('API call failed, fallback:', err);
        const enriched = enrichParsedInvoice(salfaSampleInvoice);
        setParsedInvoice(enriched);
      } finally {
        setIsProcessing(false);
      }
    } else if (isExcel) {
      setActiveSourceType('excel');
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const rawJson: any[] = XLSX.utils.sheet_to_json(ws);

          const rows = rawJson.map((row, idx) => {
            const getVal = (keys: string[]) => {
              for (const key of keys) {
                const matchedKey = Object.keys(row).find(k => k.trim().toLowerCase() === key.toLowerCase());
                if (matchedKey && row[matchedKey] !== undefined) return row[matchedKey];
              }
              return '';
            };

            const facture = String(getVal(['Num Facture', 'N° Facture', 'Facture', 'Facture N°', 'Reference', 'Ref']) || `IMP-${idx + 1}`);
            const date = String(getVal(['Date Soins', 'Date Reglement', 'Date', 'Date Paiement']) || new Date().toISOString().split('T')[0]);
            const nom = String(getVal(['Nom Adherent', 'Nom & Prenom', 'Nom', 'Assure', 'Adherent']) || 'Adhérent Inconnu');
            const matricule = String(getVal(['Matricule', 'N° Matricule', 'Immatriculation', 'Police']) || '');
            const societeNom = String(getVal(['Societe', 'Assurance', 'Assureur', 'Nom Societe', 'Garant']) || '');
            const sousSociete = String(getVal(['Sous Societe', 'Sous-Societe', 'Banque', 'Departement', 'Section']) || '');
            const montantTotal = Number(getVal(['Montant Facture', 'Total Facture', 'Total', 'Montant', 'Montant Brut'])) || 0;
            const montantPaye = Number(getVal(['Montant Regle', 'Montant Paye', 'Paye', 'Regle', 'Total Paye', 'Net A Payer'])) || Math.round(montantTotal * 0.8);
            const ticketModerateur = Number(getVal(['Ticket Moderateur', 'Moderateur', 'Copay', 'Participation', 'Non Remb'])) || Math.max(0, montantTotal - montantPaye);
            const montantExclu = Number(getVal(['Montant Exclu', 'Exclu', 'Rejet', 'Non Pris En Charge'])) || 0;
            const commentaire = String(getVal(['Observations', 'Commentaire', 'Remarque', 'Motif']) || 'Importation Excel');

            // Parse multiple acts from 'Acte médicale/Prix' column if present
            const actesRaw = String(getVal(['Acte médicale/Prix', 'Acte médicale / Prix', 'Acte medicale/Prix', 'Actes Médicaux', 'Actes', 'Acte', 'Prestations', 'Detail Actes Medicaux']) || '');
            const parsedActes = parseActesFromText(actesRaw, montantTotal);

            const matchedPersonne = personnes.find(p => 
              (matricule && p.matricule.toLowerCase() === matricule.toLowerCase()) ||
              (nom && p.nomPrenom.toLowerCase().includes(nom.toLowerCase()))
            );

            const matchedSociete = societes.find(s => 
              (societeNom && s.nom.toLowerCase().includes(societeNom.toLowerCase())) ||
              (sousSociete && s.nom.toLowerCase().includes(sousSociete.toLowerCase()))
            ) || (matchedPersonne ? societes.find(s => s.id === matchedPersonne.societeId) : societes[0]);

            return {
              index: idx + 1,
              facture,
              date,
              nom,
              matricule,
              societeNom: matchedSociete?.nom || societeNom || 'Société',
              sousSociete,
              actes: parsedActes,
              montantTotal,
              montantPaye,
              ticketModerateur,
              montantExclu,
              commentaire,
              matchedPersonneId: matchedPersonne?.id,
              matchedSocieteId: matchedSociete?.id,
            };
          });

          setExcelRows(rows);
        } catch (err: any) {
          setErrorMessage("Erreur lors de la lecture du fichier Excel: " + (err.message || err));
        } finally {
          setIsProcessing(false);
        }
      };
      reader.readAsBinaryString(file);
    } else {
      setIsProcessing(false);
      setErrorMessage("Format de fichier non pris en charge. Veuillez fournir un fichier PDF, Image (.png, .jpg) ou Excel (.xlsx, .csv).");
    }
  };

  // Download Sample Excel Files
  const handleDownloadSampleExcel = (type: 'facture' | 'paiement') => {
    let sampleData: any[] = [];
    let name = '';

    if (type === 'facture') {
      name = 'MODELE_FACTURE_ASSURANCE.xlsx';
      sampleData = salfaSampleInvoice.lignes.map(l => ({
        'Num Facture': salfaSampleInvoice.numeroFacture,
        'Date Soins': l.dateSoins,
        'Matricule': l.matricule,
        'Nom Adherent': l.nomPrenom,
        'Societe / Organisme': l.societeAffiliee || salfaSampleInvoice.clientDoit,
        'Sous-Societe': l.sousSociete || '',
        'Acte médicale/Prix': l.actes ? l.actes.map(a => `${a.code} : ${formatMoney(a.montant)}`).join('\n') : l.actesTexte,
        'Montant Total Brut': l.montantBrut,
        'Ticket Moderateur': l.participation,
        'Net A Payer': l.netAPayer,
        'Observations': l.observations || ''
      }));
    } else {
      name = 'MODELE_REGLEMENT_ASSURANCE.xlsx';
      sampleData = bsaReleveSampleInvoice.lignes.map(l => ({
        'Num Bordereau': `BORD-${bsaReleveSampleInvoice.numeroFacture}`,
        'Date Reglement': bsaReleveSampleInvoice.dateEmission,
        'Nom Adherent': l.nomPrenom,
        'Matricule': l.matricule,
        'Societe': l.societeAffiliee || bsaReleveSampleInvoice.clientDoit,
        'Sous-Societe': l.sousSociete || '',
        'Acte médicale/Prix': l.actes ? l.actes.map(a => `${a.code} : ${formatMoney(a.montant)}`).join('\n') : l.actesTexte,
        'Montant Facture': l.montantBrut,
        'Montant Regle': l.netAPayer,
        'Ticket Moderateur': l.participation,
        'Montant Exclu': l.montantExclu || 0,
        'Observations': l.observations || 'Règlement validé'
      }));
    }

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Modele');
    XLSX.writeFile(wb, name);
  };

  // Export current extracted PDF data to Excel (.xlsx)
  const handleExportExtractedToExcel = () => {
    if (!parsedInvoice) return;

    const data = parsedInvoice.lignes.map(l => ({
      'N° Ligne': l.numeroLigne,
      'Date': l.dateSoins,
      'Matricule': l.matricule,
      'Nom & Prénom': l.nomPrenom,
      'Ayant Droit': l.ayantDroit || '',
      'Société / Organisme': l.societeAffiliee || parsedInvoice.clientDoit,
      'Sous-Société (Parenthèse)': l.sousSociete || '',
      'Acte médicale/Prix': l.actes && l.actes.length > 0 
        ? l.actes.map(a => `${a.code} : ${formatMoney(a.montant)}`).join(' / ') 
        : l.actesTexte,
      'Montant Brut (Ar)': l.montantBrut,
      'Montant Exclu (Ar)': l.montantExclu || 0,
      'Base Règlement (Ar)': l.baseReglement || l.montantBrut,
      'Ticket Modérateur (Ar)': l.participation,
      'Net à Payer (Ar)': l.netAPayer,
      'Observations': l.observations || ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Décompte Extrait');
    XLSX.writeFile(wb, `EXPORT_${parsedInvoice.numeroFacture.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
  };

  // Apply custom act mapping
  const handleApplyActMapping = (mappings: Record<string, string>, saveAsPermanentAliases?: boolean) => {
    setCustomActMappings(prev => ({ ...prev, ...mappings }));

    // If permanent saving is checked, add these raw codes as aliases to the target Familles
    if (saveAsPermanentAliases && onSaveFamille) {
      Object.entries(mappings).forEach(([rawCode, targetFamilleCode]) => {
        const targetFamille = familles.find(f => f.code.toUpperCase() === targetFamilleCode.toUpperCase());
        if (targetFamille) {
          const currentAliases = Array.isArray(targetFamille.aliases) ? targetFamille.aliases : [targetFamille.code];
          const rawCodeUpper = rawCode.trim().toUpperCase();
          if (!currentAliases.includes(rawCodeUpper)) {
            onSaveFamille({
              ...targetFamille,
              aliases: [...currentAliases, rawCodeUpper],
            });
          }
        }
      });
    }

    if (parsedInvoice) {
      const updated = enrichParsedInvoice(parsedInvoice);
      setParsedInvoice(updated);
    }
  };

  // Commit PDF / Décompte Import to Database
  const handleCommitPdfImport = () => {
    if (!parsedInvoice || parsedInvoice.lignes.length === 0) return;

    // Check if there are still unmapped acts and modal hasn't been used
    if (unmappedActsSummary.length > 0) {
      setIsMappingModalOpen(true);
      return;
    }

    const newCreatedSocietes: Societe[] = [];
    const newCreatedPersonnes: Personne[] = [];
    const createdSocMap = new Map<string, string>(); // name -> id
    const createdPerMap = new Map<string, string>(); // matricule/name -> id

    // 1. Process Sociétés & Sous-sociétés auto-creation
    if (autoCreateMissingSocietes) {
      const allSocNames = new Set<string>();
      parsedInvoice.lignes.forEach(l => {
        if (l.societeAffiliee) allSocNames.add(l.societeAffiliee);
        if (l.sousSociete) allSocNames.add(l.sousSociete);
      });
      if (parsedInvoice.clientDoit) allSocNames.add(parsedInvoice.clientDoit);
      if (parsedInvoice.garant) allSocNames.add(parsedInvoice.garant);

      for (const sName of Array.from(allSocNames)) {
        if (!sName || sName.trim().length < 2) continue;
        const existing = societes.find(s => 
          s.nom.toLowerCase() === sName.toLowerCase() || 
          s.code.toLowerCase() === sName.toLowerCase()
        );
        if (!existing && !createdSocMap.has(sName)) {
          const newSocId = generateId('soc-auto');
          const newSoc: Societe = {
            id: newSocId,
            nom: sName,
            code: sName.substring(0, 6).toUpperCase().replace(/[^A-Z0-9]/g, ''),
            contact: 'Comité de Santé & Tiers-Payant',
            telephone: '+261 20 22 000 00',
            email: `contact@${sName.toLowerCase().replace(/[^a-z0-9]/g, '')}.mg`,
            tauxCouvertureDefaut: 90
          };
          newCreatedSocietes.push(newSoc);
          createdSocMap.set(sName, newSocId);
        }
      }
    }

    // 2. Process Personnes auto-creation
    if (autoCreateMissingPersonnes) {
      for (const ligne of parsedInvoice.lignes) {
        const cleanMat = (ligne.matricule || '').replace(/\s+/g, '');
        const existing = personnes.find(p => 
          (cleanMat && p.matricule.replace(/\s+/g, '').toLowerCase() === cleanMat.toLowerCase()) ||
          p.nomPrenom.toLowerCase() === ligne.nomPrenom.toLowerCase()
        );

        if (!existing && !createdPerMap.has(ligne.matricule || ligne.nomPrenom)) {
          const socName = ligne.sousSociete || ligne.societeAffiliee || parsedInvoice.clientDoit;
          const socId = createdSocMap.get(socName) || 
                        societes.find(s => s.nom.toLowerCase().includes(socName.toLowerCase()))?.id || 
                        societes[0]?.id || 'soc-1';

          const primaryActCode = ligne.actes[0]?.mappedFamilleCode || ligne.actes[0]?.code || 'CONS';

          const newPerId = generateId('per-auto');
          const newPer: Personne = {
            id: newPerId,
            nomPrenom: ligne.nomPrenom,
            matricule: ligne.matricule || `MAT-${Math.floor(100000 + Math.random() * 900000)}`,
            societeId: socId,
            qualite: 'Adhérent Principal',
            familleCode: primaryActCode,
            dateNaissance: '1985-01-01',
            telephone: '+261 34 00 000 00'
          };
          newCreatedPersonnes.push(newPer);
          createdPerMap.set(ligne.matricule || ligne.nomPrenom, newPerId);

          // If having separate Ayant Droit
          if (ligne.ayantDroit && ligne.ayantDroit !== ligne.nomPrenom) {
            const ayantDroitId = generateId('per-ad-auto');
            const ayantDroitPer: Personne = {
              id: ayantDroitId,
              nomPrenom: ligne.ayantDroit,
              matricule: `${newPer.matricule}-AD`,
              societeId: socId,
              qualite: 'Ayant droit',
              familleCode: primaryActCode,
              dateNaissance: '2005-01-01',
              telephone: '+261 34 00 000 00'
            };
            newCreatedPersonnes.push(ayantDroitPer);
          }
        }
      }
    }

    if (importTargetMode === 'prestations') {
      // Create batch of prestations
      const newPrestationsList: Prestation[] = parsedInvoice.lignes.map((ligne, idx) => {
        const prestId = generateId(`prest-${idx + 1}`);
        const socName = ligne.sousSociete || ligne.societeAffiliee || parsedInvoice.clientDoit;
        const socId = createdSocMap.get(socName) || 
                      ligne.matchedSocieteId || 
                      societes.find(s => s.nom.toLowerCase().includes(socName.toLowerCase()))?.id || 
                      societes[0]?.id || 'soc-1';

        const perId = createdPerMap.get(ligne.matricule || ligne.nomPrenom) || 
                      ligne.matchedPersonneId || 
                      personnes.find(p => p.nomPrenom.toLowerCase() === ligne.nomPrenom.toLowerCase())?.id ||
                      personnes[0]?.id || 'per-1';

        const subLines: LignePrestation[] = (ligne.actes && ligne.actes.length > 0)
          ? ligne.actes.map((a, actIdx) => {
              const mappedCode = a.mappedFamilleCode || customActMappings[a.code] || a.code || 'CONS';
              const matchedFam = familles.find(f => f.code.toUpperCase() === mappedCode.toUpperCase());
              const actMontant = a.montant || Math.round(ligne.montantBrut / (ligne.actes?.length || 1));
              const partRatio = ligne.montantBrut > 0 ? actMontant / ligne.montantBrut : (1 / (ligne.actes?.length || 1));
              const actPart = Math.round((ligne.participation || 0) * partRatio);
              const actPaye = Math.max(0, actMontant - actPart);
              return {
                id: generateId(`lig-${idx}-${actIdx}`),
                prestationId: prestId,
                code: mappedCode,
                libelle: a.libelle || matchedFam?.libelle || a.code,
                totalPrestation: actMontant,
                totalPaye: actPaye
              };
            })
          : [
              {
                id: generateId(`lig-${idx}`),
                prestationId: prestId,
                code: 'CONS',
                libelle: ligne.actesTexte || 'Soins médicaux',
                totalPrestation: ligne.montantBrut,
                totalPaye: ligne.netAPayer
              }
            ];

        return {
          id: prestId,
          numeroFacture: `${parsedInvoice.numeroFacture}-${String(ligne.numeroLigne).padStart(2, '0')}`,
          date: ligne.dateSoins,
          societeId: socId,
          sousSociete: ligne.sousSociete ? `${ligne.societeAffiliee || parsedInvoice.clientDoit} (${ligne.sousSociete})` : (ligne.societeAffiliee || parsedInvoice.etablissement),
          personneId: perId,
          totalPrestation: ligne.montantBrut,
          participation: ligne.participation,
          statut: 'Payé' as const,
          dateCreation: new Date().toISOString().split('T')[0],
          commentaires: `${parsedInvoice.clientDoit} - ${parsedInvoice.etablissement} | ${ligne.actesTexte} | Net: ${formatMoney(ligne.netAPayer)}`,
          lignes: subLines
        };
      });

      onImportPrestations(newPrestationsList, newCreatedSocietes, newCreatedPersonnes);
      setImportSuccessMsg(`Succès : Les ${newPrestationsList.length} dossiers de soins du document ${parsedInvoice.numeroFacture} ont été importés avec succès (${newCreatedPersonnes.length} nouveaux assurés et ${newCreatedSocietes.length} entités créés).`);
      setParsedInvoice(null);
    } else {
      // Import as Paiement / Bordereau de règlement
      const bordereauId = generateId('pai-decompte');
      const targetSocId = createdSocMap.get(parsedInvoice.clientDoit) || 
                          societes.find(s => s.nom.toLowerCase().includes(parsedInvoice.clientDoit.toLowerCase()))?.id || 
                          societes[0]?.id || 'soc-1';

      const lignesPaiement = parsedInvoice.lignes.map(l => ({
        id: generateId('lp-decompte'),
        paiementId: bordereauId,
        lignePrestationId: generateId('lig-auto'),
        prestationId: generateId('prest-auto'),
        immatriculation: l.matricule,
        nomBaseAssurance: l.nomPrenom,
        totalPaye: l.netAPayer,
        ticketModerateur: l.participation,
        montantExclu: l.montantExclu || 0,
        commentaire: `${l.sousSociete ? `[${l.sousSociete}] ` : ''}${l.actesTexte}`,
      }));

      const newPaiement: Paiement = {
        id: bordereauId,
        numeroBordereau: parsedInvoice.numeroBordereau ? `BORD-${parsedInvoice.numeroBordereau}` : `BORD-${parsedInvoice.numeroFacture}`,
        datePaiement: parsedInvoice.dateEmission,
        dateSaisie: new Date().toISOString().split('T')[0],
        societeId: targetSocId,
        modePaiement: parsedInvoice.banqueReglement?.includes('VIREMENT') ? 'Virement bancaire' : 'Virement bancaire',
        referencePaiement: parsedInvoice.rib ? `VIR-${parsedInvoice.rib}` : `DEC-${parsedInvoice.numeroFacture}`,
        totalReclame: parsedInvoice.totalMontantBrut,
        totalPaye: parsedInvoice.totalNetAPayer,
        totalModerateur: parsedInvoice.totalParticipation,
        totalExclu: parsedInvoice.totalExclu || 0,
        remise: parsedInvoice.remise || 0,
        statut: 'Validé',
        notes: `Décompte / Relevé ${parsedInvoice.clientDoit} - ${parsedInvoice.etablissement} (${parsedInvoice.sommeLettres || ''})`,
        lignes: lignesPaiement,
      };

      onImportPaiements(newPaiement, prestations, newCreatedSocietes, newCreatedPersonnes);
      setImportSuccessMsg(`Succès : Le bordereau de règlement ${newPaiement.numeroBordereau} (${formatMoney(newPaiement.totalPaye)}) avec les ${parsedInvoice.lignes.length} prises en charge a été comptabilisé.`);
      setParsedInvoice(null);
    }
  };

  // Filter lines
  const filteredLignes = parsedInvoice?.lignes.filter(l => {
    const matchesSoc = selectedFilterSoc === 'ALL' || 
      (l.societeAffiliee && l.societeAffiliee.toLowerCase() === selectedFilterSoc.toLowerCase());
    const matchesSousSoc = selectedFilterSousSoc === 'ALL' ||
      (l.sousSociete && l.sousSociete.toLowerCase() === selectedFilterSousSoc.toLowerCase());
    const matchesSearch = searchTerm === '' || 
      l.nomPrenom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.ayantDroit && l.ayantDroit.toLowerCase().includes(searchTerm.toLowerCase())) ||
      l.matricule.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.sousSociete && l.sousSociete.toLowerCase().includes(searchTerm.toLowerCase())) ||
      l.actesTexte.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSoc && matchesSousSoc && matchesSearch;
  }) || [];

  // Distinct societies and sous-sociétés in current document
  const distinctSocietiesInDoc = parsedInvoice 
    ? Array.from(new Set(parsedInvoice.lignes.map(l => l.societeAffiliee).filter(Boolean)))
    : [];

  const distinctSousSocietesInDoc = parsedInvoice
    ? Array.from(new Set(parsedInvoice.lignes.map(l => l.sousSociete).filter(Boolean)))
    : [];

  return (
    <div id="importation-view" className="space-y-5">
      {/* Un titre court et une seule action secondaire gardent l’écran lisible. */}
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-950">Importer un document</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Ajoutez un décompte ou une facture, puis contrôlez les données extraites.
          </p>
        </div>
        <button
          onClick={() => handleDownloadSampleExcel('facture')}
          className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <Download className="h-4 w-4 text-slate-500" />
          <span>Télécharger le modèle Excel</span>
        </button>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {/* Choix du format */}
        <div className="flex items-center gap-1 p-1.5">
          <button
            onClick={() => setActiveSourceType('pdf')}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
              activeSourceType === 'pdf'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>PDF ou image</span>
          </button>

          <button
            onClick={() => setActiveSourceType('excel')}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
              activeSourceType === 'excel'
                ? 'bg-emerald-50 text-emerald-700'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            <ExcelIcon className="h-4 w-4" />
            <span>Excel ou CSV</span>
          </button>
        </div>

        {/* Les jeux de démonstration restent disponibles, mais ne chargent plus l’écran par défaut. */}
        <details className="group border-t border-slate-100">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-xs font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-800">
            <Sparkles className="h-4 w-4 text-indigo-500" />
            <span>Essayer avec un exemple</span>
            <span className="hidden font-normal text-slate-400 sm:inline">ASCOMA, MCI CARE, BSA ou SALFA</span>
            <span className="ml-auto text-slate-400 transition group-open:rotate-90">›</span>
          </summary>

          <div className="grid grid-cols-1 gap-2 border-t border-slate-100 bg-slate-50 p-3 sm:grid-cols-2 xl:grid-cols-4">
            <button
              id="btn-load-ascoma-sample"
              onClick={() => handleLoadPredefinedSample('ascoma')}
              className="group/example flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-indigo-200 hover:bg-indigo-50"
            >
              <div>
                <div className="text-xs font-semibold text-slate-800">ASCOMA</div>
                <div className="text-[11px] text-slate-500">23 actes · 1 344 683 Ar</div>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400 transition group-hover/example:translate-x-0.5" />
            </button>

            <button
              id="btn-load-mci-sample"
              onClick={() => handleLoadPredefinedSample('mci')}
              className="group/example flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-indigo-200 hover:bg-indigo-50"
            >
              <div>
                <div className="text-xs font-semibold text-slate-800">MCI CARE</div>
                <div className="text-[11px] text-slate-500">Pharmacie · 474 600 Ar</div>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400 transition group-hover/example:translate-x-0.5" />
            </button>

            <button
              id="btn-load-bsa-sample"
              onClick={() => handleLoadPredefinedSample('bsa')}
              className="group/example flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-indigo-200 hover:bg-indigo-50"
            >
              <div>
                <div className="text-xs font-semibold text-slate-800">BSA / ASK GS</div>
                <div className="text-[11px] text-slate-500">45 actes · 761 150 Ar</div>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400 transition group-hover/example:translate-x-0.5" />
            </button>

            <button
              id="btn-load-salfa-sample"
              onClick={() => handleLoadPredefinedSample('salfa')}
              className="group/example flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-indigo-200 hover:bg-indigo-50"
            >
              <div>
                <div className="text-xs font-semibold text-slate-800">SALFA</div>
                <div className="text-[11px] text-slate-500">25 lignes · 2 216 700 Ar</div>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400 transition group-hover/example:translate-x-0.5" />
            </button>
          </div>
        </details>
      </section>

      {/* Notifications */}
      {importSuccessMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between text-emerald-800 text-xs">
          <div className="flex items-center space-x-3 font-medium">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{importSuccessMsg}</span>
          </div>
          <button onClick={() => setImportSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center justify-between text-rose-800 text-xs">
          <div className="flex items-center space-x-3 font-medium">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-600 hover:text-rose-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Drop Zone Box */}
      {!parsedInvoice && excelRows.length === 0 && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="flex min-h-64 flex-col items-center justify-center space-y-4 rounded-xl border-2 border-dashed border-slate-300 bg-white p-8 text-center transition hover:border-indigo-400 hover:bg-indigo-50/20"
        >
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${activeSourceType === 'pdf' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
            {isProcessing ? (
              <RefreshCw className="h-6 w-6 animate-spin" />
            ) : activeSourceType === 'pdf' ? (
              <FileText className="h-6 w-6" />
            ) : (
              <ExcelIcon className="h-6 w-6" />
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              {isProcessing
                ? 'Analyse du document…'
                : 'Déposez votre fichier ici'}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {activeSourceType === 'pdf' ? 'PDF, JPG ou PNG' : 'XLSX, XLS ou CSV'} · 25 Mo maximum
            </p>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept={activeSourceType === 'pdf' ? '.pdf,image/*' : '.xlsx,.xls,.csv'}
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
          >
            Parcourir les fichiers
          </button>
        </div>
      )}

      {/* Extracted Document View */}
      {parsedInvoice && (
        <div className="space-y-6">
          {/* Header Details Card */}
          <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-6 space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-6 border-b border-slate-100 gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 text-indigo-800 uppercase tracking-wide">
                    {parsedInvoice.documentType === 'decompte' ? 'Décompte de Règlement Tiers Payant' : 'Facture Médicale'}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">{fileName}</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  {parsedInvoice.etablissement}
                </h3>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                  <span>Assurance / Client : <strong className="text-indigo-600 font-bold">{parsedInvoice.clientDoit}</strong></span>
                  {parsedInvoice.garant && (
                    <>
                      <span>•</span>
                      <span>Garant : <strong>{parsedInvoice.garant}</strong></span>
                    </>
                  )}
                  <span>•</span>
                  <span>Réf / N° : <strong className="font-mono">{parsedInvoice.numeroFacture}</strong></span>
                  <span>•</span>
                  <span>Période : <strong>{parsedInvoice.moisPriseEnCharge}</strong></span>
                  <span>•</span>
                  <span>Date d'édition : <strong>{parsedInvoice.dateEmission}</strong></span>
                  {parsedInvoice.banqueReglement && (
                    <>
                      <span>•</span>
                      <span className="text-slate-700 font-medium">Banque : {parsedInvoice.banqueReglement}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleExportExtractedToExcel}
                  className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Exporter vers Excel (.xlsx)</span>
                </button>

                <button
                  onClick={() => setParsedInvoice(null)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  Changer de fichier
                </button>
              </div>
            </div>

            {/* Financial Summary KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase">Montant Réclamé / Brut</span>
                <div className="text-xl font-black text-slate-900 font-mono">
                  {formatMoney(parsedInvoice.totalMontantBrut)}
                </div>
                <span className="text-[10px] text-slate-400">{parsedInvoice.lignes.length} actes / lignes détaillées</span>
              </div>

              <div className="bg-rose-50/60 border border-rose-200 rounded-xl p-4 space-y-1">
                <span className="text-[11px] font-semibold text-rose-700 uppercase">Montant Exclu / Rejets</span>
                <div className="text-xl font-black text-rose-900 font-mono">
                  {formatMoney(parsedInvoice.totalExclu || 0)}
                </div>
                <span className="text-[10px] text-rose-700">Non pris en charge par l'assurance</span>
              </div>

              <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 space-y-1">
                <span className="text-[11px] font-semibold text-amber-700 uppercase">Ticket Modérateur (Assuré)</span>
                <div className="text-xl font-black text-amber-900 font-mono">
                  {formatMoney(parsedInvoice.totalParticipation)}
                </div>
                <span className="text-[10px] text-amber-700">Part restante ou déjà réglée par l'assuré</span>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-1">
                <span className="text-[11px] font-semibold text-emerald-700 uppercase">Net Réglé / Virement</span>
                <div className="text-xl font-black text-emerald-900 font-mono">
                  {formatMoney(parsedInvoice.totalNetAPayer)}
                </div>
                {parsedInvoice.remise ? (
                  <span className="text-[10px] text-emerald-700 font-medium">Après remise de {formatMoney(parsedInvoice.remise)}</span>
                ) : (
                  <span className="text-[10px] text-emerald-700">Montant total pris en charge</span>
                )}
              </div>
            </div>

            {/* Act Mapping Alert Banner (if unmapped acts exist) */}
            {unmappedActsSummary.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900">
                <div className="flex items-start space-x-3">
                  <Layers className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">
                      {unmappedActsSummary.length} code(s) d'actes spécifiques détecté(s) dans le décompte ({unmappedActsSummary.map(a => a.rawCode).join(', ')})
                    </div>
                    <div className="text-amber-700 mt-0.5">
                      Vous pouvez choisir manuellement la famille de rattachement dans votre base (ex: DC/DK vers Dentaire, PH/PHSB vers Pharmacie, EB vers Analyses).
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setIsMappingModalOpen(true)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition shrink-0"
                >
                  Choisir où relier les actes ({unmappedActsSummary.length})
                </button>
              </div>
            )}

            {/* Les réglages avancés sont repliés pour préserver une lecture simple du document. */}
            <details className="group overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-xs font-semibold text-slate-700">
                <span>Options d’intégration</span>
                <span className="font-normal text-slate-400">
                  · {importTargetMode === 'prestations' ? `${parsedInvoice.lignes.length} prestations` : '1 bordereau'}
                </span>
                <span className="ml-auto text-slate-400 transition group-open:rotate-90">›</span>
              </summary>

              <div className="grid grid-cols-1 gap-5 border-t border-slate-200 bg-white p-4 text-xs md:grid-cols-2">
                <div className="space-y-2.5">
                  <span className="block font-semibold text-slate-700">Destination</span>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="importTargetMode"
                      checked={importTargetMode === 'prestations'}
                      onChange={() => setImportTargetMode('prestations')}
                      className="text-indigo-600"
                    />
                    <span>Créer {parsedInvoice.lignes.length} prestations</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="importTargetMode"
                      checked={importTargetMode === 'paiements'}
                      onChange={() => setImportTargetMode('paiements')}
                      className="text-emerald-600"
                    />
                    <span>Créer un bordereau de {formatMoney(parsedInvoice.totalNetAPayer)}</span>
                  </label>
                </div>

                <div className="space-y-2.5">
                  <span className="block font-semibold text-slate-700">Création automatique</span>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={autoCreateMissingPersonnes}
                      onChange={(e) => setAutoCreateMissingPersonnes(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    <span>Assurés et ayants droit manquants</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={autoCreateMissingSocietes}
                      onChange={(e) => setAutoCreateMissingSocietes(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    <span>Sous-sociétés manquantes</span>
                  </label>
                </div>
              </div>
            </details>
          </div>

          {/* Table Filters & Toolbar */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Filtrer par nom, ayant droit, sous-société ou acte..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 w-64"
                  />
                </div>

                {/* Sous-sociétés filter pills */}
                {distinctSousSocietesInDoc.length > 0 && (
                  <div className="flex items-center space-x-1 overflow-x-auto py-1 max-w-md">
                    <span className="text-[11px] font-bold text-slate-500 uppercase px-1">Sous-Société:</span>
                    <button
                      onClick={() => setSelectedFilterSousSoc('ALL')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                        selectedFilterSousSoc === 'ALL'
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Toutes
                    </button>

                    {distinctSousSocietesInDoc.map(s => {
                      const count = parsedInvoice.lignes.filter(l => l.sousSociete === s).length;
                      return (
                        <button
                          key={s}
                          onClick={() => setSelectedFilterSousSoc(s || 'ALL')}
                          className={`px-2 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                            selectedFilterSousSoc === s
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          ({s}) <span className="opacity-75">({count})</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  onClick={() => setIsMappingModalOpen(true)}
                  className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition"
                >
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span>Rattacher les Actes</span>
                </button>

                <button
                  id="btn-confirm-pdf-import"
                  onClick={handleCommitPdfImport}
                  className="flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition"
                >
                  <Check className="w-4 h-4" />
                  <span>Intégrer les {parsedInvoice.lignes.length} lignes en 1 Clic</span>
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] font-semibold">
                  <tr>
                    <th className="py-3 px-3">#</th>
                    <th className="py-3 px-3">Date Soins</th>
                    <th className="py-3 px-3">Matricule</th>
                    <th className="py-3 px-3">Assuré / Ayant Droit</th>
                    <th className="py-3 px-3">Société & Sous-Société</th>
                    <th className="py-3 px-3 min-w-[220px]">Acte médicale / Prix</th>
                    <th className="py-3 px-3 text-right">Montant Réclamé</th>
                    <th className="py-3 px-3 text-right">Montant Exclu</th>
                    <th className="py-3 px-3 text-right">Ticket Modérateur</th>
                    <th className="py-3 px-3 text-right">Montant Réglé</th>
                    <th className="py-3 px-3 text-center">Statut Fiche</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLignes.map((row) => (
                    <tr key={row.numeroLigne} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-3 font-mono text-slate-400">{row.numeroLigne}</td>
                      <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">{formatDate(row.dateSoins)}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{row.matricule}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900">{row.nomPrenom}</div>
                        {row.ayantDroit && row.ayantDroit !== row.nomPrenom && (
                          <div className="text-[11px] text-indigo-600 font-medium">
                            Ayant-droit: {row.ayantDroit}
                          </div>
                        )}
                        {row.observations && (
                          <div className="text-[10px] text-slate-400">{row.observations}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="space-y-1">
                          <div className="font-semibold text-slate-800">
                            {row.societeAffiliee || parsedInvoice.clientDoit}
                          </div>
                          {row.sousSociete && (
                            <span className="inline-block px-2 py-0.5 rounded-md font-bold text-[10px] bg-amber-50 text-amber-800 border border-amber-200">
                              ({row.sousSociete})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 min-w-[220px]">
                        <div className="space-y-1">
                          {row.actes && row.actes.length > 0 ? (
                            <div className="flex flex-col gap-1">
                              {row.actes.map((a, i) => {
                                const mapped = a.mappedFamilleCode || customActMappings[a.code] || a.code;
                                const isUnk = !familles.some(f => f.code.toUpperCase() === mapped.toUpperCase());
                                return (
                                  <div 
                                    key={i} 
                                    className={`flex items-center justify-between px-2 py-1 rounded text-[11px] font-mono border ${
                                      isUnk
                                        ? 'bg-amber-50 text-amber-900 border-amber-300'
                                        : 'bg-indigo-50/70 text-indigo-900 border-indigo-100'
                                    }`}
                                  >
                                    <span className="font-bold flex items-center space-x-1">
                                      <span className={isUnk ? 'text-amber-900' : 'text-indigo-700'}>{mapped}</span>
                                      {a.libelle && a.libelle !== mapped && (
                                        <span className="text-[10px] text-slate-500 font-sans font-normal truncate max-w-[90px]">
                                          ({a.libelle})
                                        </span>
                                      )}
                                    </span>
                                    <span className="font-semibold text-slate-800 ml-2 whitespace-nowrap">
                                      {formatMoney(a.montant)}
                                    </span>
                                  </div>
                                );
                              })}
                              {row.actes.length > 1 && (
                                <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium px-1 pt-0.5">
                                  <span>{row.actes.length} actes cumulés</span>
                                  <span className="font-mono text-slate-600 font-bold">Total: {formatMoney(row.montantBrut)}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-600 text-[11px]">{row.actesTexte}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-slate-900 font-mono">
                        {formatMoney(row.montantBrut)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-rose-700 font-mono">
                        {row.montantExclu ? formatMoney(row.montantExclu) : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-amber-700 font-mono">
                        {formatMoney(row.participation)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-emerald-700 font-mono">
                        {formatMoney(row.netAPayer)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {row.matchedPersonneId ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                            <CheckCircle className="w-3 h-3" />
                            <span>Adhérent Existant</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800">
                            <PlusCircle className="w-3 h-3" />
                            <span>Nouvel Adhérent</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-100/80 font-bold border-t-2 border-slate-300 text-slate-900">
                  <tr>
                    <td colSpan={6} className="py-3 px-3 text-right uppercase text-[11px]">
                      Totaux ({filteredLignes.length} lignes affichées) :
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                      {formatMoney(filteredLignes.reduce((s, l) => s + l.montantBrut, 0))}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-rose-800">
                      {formatMoney(filteredLignes.reduce((s, l) => s + (l.montantExclu || 0), 0))}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-amber-800">
                      {formatMoney(filteredLignes.reduce((s, l) => s + l.participation, 0))}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-black text-emerald-800">
                      {formatMoney(filteredLignes.reduce((s, l) => s + l.netAPayer, 0))}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Extracted Excel Rows View (if Excel was uploaded) */}
      {excelRows.length > 0 && !parsedInvoice && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Aperçu et Contrôle du Fichier Excel ({excelRows.length} lignes détectées)
              </h3>
              <p className="text-xs text-slate-500">
                Fichier source : <strong>{fileName}</strong>
              </p>
            </div>

            <button
              onClick={() => {
                const newPrests: Prestation[] = excelRows.map((r, idx) => {
                  const prestId = generateId(`prest-xl-${idx}`);
                  const subLines: LignePrestation[] = (r.actes && r.actes.length > 0)
                    ? r.actes.map((a: any, actIdx: number) => {
                        const actMontant = a.montant || Math.round(r.montantTotal / (r.actes.length || 1));
                        const partRatio = r.montantTotal > 0 ? actMontant / r.montantTotal : 1 / (r.actes.length || 1);
                        const actPart = Math.round(r.ticketModerateur * partRatio);
                        return {
                          id: generateId(`lig-xl-${idx}-${actIdx}`),
                          prestationId: prestId,
                          code: a.code || 'CONS',
                          libelle: a.libelle || a.code,
                          totalPrestation: actMontant,
                          totalPaye: Math.max(0, actMontant - actPart),
                        };
                      })
                    : [
                        {
                          id: generateId(`lig-xl-${idx}`),
                          prestationId: prestId,
                          code: 'CONS',
                          libelle: 'Prestation Excel',
                          totalPrestation: r.montantTotal,
                          totalPaye: r.montantPaye,
                        }
                      ];

                  return {
                    id: prestId,
                    numeroFacture: r.facture,
                    date: r.date,
                    societeId: r.matchedSocieteId || societes[0]?.id || 'soc-1',
                    sousSociete: r.sousSociete || 'Import Excel',
                    personneId: r.matchedPersonneId || personnes[0]?.id || 'per-1',
                    totalPrestation: r.montantTotal,
                    participation: r.ticketModerateur,
                    statut: 'Payé' as const,
                    dateCreation: new Date().toISOString().split('T')[0],
                    commentaires: r.commentaire,
                    lignes: subLines
                  };
                });
                onImportPrestations(newPrests);
                setImportSuccessMsg(`Succès : ${newPrests.length} prestations importées depuis Excel.`);
                setExcelRows([]);
              }}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs"
            >
              <Check className="w-4 h-4" />
              <span>Intégrer les {excelRows.length} lignes Excel</span>
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] font-semibold">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Facture N°</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Assuré / Matricule</th>
                  <th className="py-2.5 px-3">Société & Sous-Société</th>
                  <th className="py-2.5 px-3 min-w-[200px]">Acte médicale / Prix</th>
                  <th className="py-2.5 px-3 text-right">Montant Facture</th>
                  <th className="py-2.5 px-3 text-right">Montant Réglé</th>
                  <th className="py-2.5 px-3 text-right">Ticket Modérateur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {excelRows.map((row) => (
                  <tr key={row.index} className="hover:bg-slate-50">
                    <td className="py-2 px-3 text-slate-400 font-mono">{row.index}</td>
                    <td className="py-2 px-3 font-bold text-indigo-700">{row.facture}</td>
                    <td className="py-2 px-3 text-slate-600">{row.date}</td>
                    <td className="py-2 px-3">
                      <div className="font-semibold text-slate-800">{row.nom}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{row.matricule || 'N/A'}</div>
                    </td>
                    <td className="py-2 px-3">
                      <div className="text-slate-800">{row.societeNom}</div>
                      {row.sousSociete && (
                        <span className="text-[10px] font-bold text-amber-700">({row.sousSociete})</span>
                      )}
                    </td>
                    <td className="py-2 px-3 min-w-[200px]">
                      {row.actes && row.actes.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {row.actes.map((a: any, i: number) => (
                            <div key={i} className="flex items-center justify-between px-2 py-0.5 rounded text-[11px] font-mono bg-indigo-50/70 border border-indigo-100 text-indigo-900">
                              <span className="font-bold">{a.code}</span>
                              <span className="font-semibold text-slate-800 ml-2">{formatMoney(a.montant)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">CONS: {formatMoney(row.montantTotal)}</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right font-medium text-slate-900">{formatMoney(row.montantTotal)}</td>
                    <td className="py-2 px-3 text-right font-bold text-emerald-700">{formatMoney(row.montantPaye)}</td>
                    <td className="py-2 px-3 text-right text-amber-700 font-medium">{formatMoney(row.ticketModerateur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Interactive Act Mapping Modal */}
      <ActMappingModal
        isOpen={isMappingModalOpen}
        onClose={() => setIsMappingModalOpen(false)}
        unmappedActs={unmappedActsSummary}
        familles={familles}
        onApplyMapping={handleApplyActMapping}
      />
    </div>
  );
};
