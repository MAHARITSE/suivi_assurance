import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  FileText, 
  Sparkles, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Building2, 
  Users, 
  Check, 
  Download, 
  Info, 
  ArrowLeft, 
  FileSpreadsheet,
  ScanLine,
  FileCode,
  ShieldCheck
} from 'lucide-react';
import { Prestation, LignePrestation, Societe, Personne, Famille, ParsedFactureAssurance } from '../types';
import { formatMoney, generateId, normalizeDateISO } from '../utils/formatters';
import { salfaSampleInvoice } from '../data/salfaInvoiceSample';
import { mciCareFactureSampleInvoice, ascomaSampleInvoice } from '../data/insuranceSampleDocuments';
import { downloadPrestationsExcelTemplate } from '../utils/excelTemplates';
import * as XLSX from 'xlsx';

interface SalfaImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  societes: Societe[];
  personnes: Personne[];
  familles: Famille[];
  onImportPrestations: (newPrestations: Prestation[], newSocietes?: Societe[], newPersonnes?: Personne[]) => void;
}

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
        code: codeUpper.length > 0 && codeUpper.length <= 8 ? codeUpper : codeOrLibelle.substring(0, 6).toUpperCase(),
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

export const SalfaImportModal: React.FC<SalfaImportModalProps> = ({
  isOpen,
  onClose,
  societes,
  personnes,
  familles,
  onImportPrestations,
}) => {
  const [importMode, setImportMode] = useState<'excel' | 'pdf' | 'sample'>('excel');
  const [parsedInvoice, setParsedInvoice] = useState<ParsedFactureAssurance | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [autoCreateMissingSocietes, setAutoCreateMissingSocietes] = useState(true);
  const [autoCreateMissingPersonnes, setAutoCreateMissingPersonnes] = useState(true);
  const [selectedLines, setSelectedLines] = useState<Record<number, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  const getFallbackFacture = (filename?: string) => {
    const low = (filename || '').toLowerCase();
    if (low.includes('mci') || low.includes('care')) return mciCareFactureSampleInvoice;
    if (low.includes('ascoma')) return ascomaSampleInvoice;
    return salfaSampleInvoice;
  };

  const handleResetAndBack = () => {
    setParsedInvoice(null);
    setSelectedLines({});
    setErrorMessage(null);
    setIsProcessing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (excelInputRef.current) {
      excelInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    handleResetAndBack();
    onClose();
  };

  const handleLoadSample = () => {
    setIsProcessing(true);
    setErrorMessage(null);
    setTimeout(() => {
      const sample = salfaSampleInvoice;
      setParsedInvoice(sample);
      const initialSelected: Record<number, boolean> = {};
      sample.lignes.forEach((_, idx) => {
        initialSelected[idx] = true;
      });
      setSelectedLines(initialSelected);
      setIsProcessing(false);
    }, 200);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) {
        // Read Excel
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const data = new Uint8Array(event.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const firstSheet = workbook.Sheets[sheetName];
            const jsonRows: any[] = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

            if (jsonRows.length === 0) {
              throw new Error('Le fichier Excel est vide ou ne contient aucune ligne.');
            }

            let inferredFactureNum = '';
            let inferredClient = 'BSA';

            const lignes = jsonRows.map((row, idx) => {
              const getVal = (keys: string[]) => {
                for (const k of keys) {
                  const cleanK = k.toLowerCase().replace(/[\s_\-\.\/]/g, '');
                  const foundKey = Object.keys(row).find(rk => {
                    const cleanRk = rk.toLowerCase().replace(/[\s_\-\.\/]/g, '');
                    return cleanRk === cleanK;
                  });
                  if (foundKey && row[foundKey] !== undefined && row[foundKey] !== '') {
                    return row[foundKey];
                  }
                }
                return '';
              };

              const rawFacture = String(getVal(['Numero_Facture', 'NumeroFacture', 'N° Facture', 'Num Facture', 'Facture']) || '').trim();
              if (rawFacture && !inferredFactureNum) inferredFactureNum = rawFacture;

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

              // Règle BSA : Pour BSA et factures de soins, le vrai nom de la personne à importer est TOUJOURS celui aligné à la date du soin (Patient / Ayant-droit / Soigné) et non celui de l'adhésion
              let rawNom = nomPatientSoin || (nomAdherent && !nomGeneral ? nomAdherent : nomGeneral) || nomAdherent || `Patient ${idx + 1}`;
              let sousSoc = String(getVal(['Sous_Societe', 'Sous-Société', 'Sous Societe', 'Département', 'Section', 'Service']) || '').trim();

              const parenMatch = rawNom.match(/^([^(]+)\s*\(([^)]+)\)$/);
              if (parenMatch) {
                rawNom = parenMatch[1].trim();
                if (!sousSoc) {
                  sousSoc = parenMatch[2].trim();
                }
              }

              const matricule = String(getVal(['Matricule', 'N° Matricule', 'Immatriculation', 'Code']) || '').trim();
              const rawDateSoins = String(getVal(['Date_Soins', 'Date', 'Date Soins', 'Date des Soins', 'Date Prestation']) || new Date().toISOString().split('T')[0]).trim();
              const dateSoins = normalizeDateISO(rawDateSoins);
              const montantBrut = Number(getVal(['Montant_Total_Brut', 'Montant Total Brut', 'Montant Brut', 'Montant Total', 'Total Prestation', 'Montant Facture', 'Fr. Réels'])) || 0;
              const participation = Number(getVal(['Ticket_Moderateur', 'Ticket Moderateur', 'Ticket Modérateur', 'Part Assuré', 'Participation', 'Franchise'])) || 0;
              const netAPayer = Number(getVal(['Prise_En_Charge_Net', 'Net A Payer', 'Net Payé', 'Montant Remboursé', 'Prise En Charge', 'Montant Réglé'])) || (montantBrut - participation);
              const socName = String(getVal(['Societe', 'Société', 'Organisme', 'Client']) || 'BSA').trim();
              if (socName) inferredClient = socName;

              const actesRaw = String(getVal(['Acte_Medicale_Prix', 'Acte médicale/Prix', 'Acte médicale / Prix', 'Acte medicale/Prix', 'Actes Médicaux', 'Actes', 'Prestations', 'Detail Actes Medicaux']) || 'CONS : ' + montantBrut);
              let observations = String(getVal(['Observations', 'Remarques', 'Commentaires', 'Motif']) || 'Import Excel').trim();
              if (nomAdherent && nomAdherent.toLowerCase() !== rawNom.toLowerCase() && !observations.toLowerCase().includes(nomAdherent.toLowerCase())) {
                observations = observations && observations !== 'Import Excel' ? `${observations} (Adhérent: ${nomAdherent})` : `Adhérent: ${nomAdherent}`;
              }

              const parsedActes = parseActesFromText(actesRaw, montantBrut);

              return {
                numeroLigne: idx + 1,
                dateSoins,
                matricule,
                nomPrenom: rawNom,
                societeAffiliee: socName,
                sousSociete: sousSoc,
                actes: parsedActes,
                actesTexte: actesRaw,
                montantBrut,
                montantExclu: 0,
                baseReglement: montantBrut,
                participation,
                netAPayer,
                observations
              };
            });

            const totalBrut = lignes.reduce((s, l) => s + l.montantBrut, 0);
            const totalPart = lignes.reduce((s, l) => s + l.participation, 0);
            const totalNet = lignes.reduce((s, l) => s + l.netAPayer, 0);

            const doc: ParsedFactureAssurance = {
              documentType: 'facture',
              etablissement: 'CENTRE MÉDICAL / HÔPITAL SALFA',
              numeroFacture: inferredFactureNum || `FACT-SALFA-${Date.now().toString().substring(6)}`,
              moisPriseEnCharge: new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
              clientDoit: inferredClient,
              dateEmission: new Date().toISOString().split('T')[0],
              totalMontantBrut: totalBrut,
              totalParticipation: totalPart,
              totalNetAPayer: totalNet,
              lignes
            };

            setParsedInvoice(doc);
            const initialSelected: Record<number, boolean> = {};
            doc.lignes.forEach((_, i) => { initialSelected[i] = true; });
            setSelectedLines(initialSelected);
            setIsProcessing(false);
          } catch (err: any) {
            setErrorMessage(err.message || 'Erreur lors de la lecture du fichier Excel.');
            setIsProcessing(false);
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        // PDF or image -> Send to AI OCR server endpoint (champ attendu = 'file')
        const formData = new FormData();
        formData.append('file', file);
        formData.append('docType', 'facture');

        const response = await fetch('/api/parse-invoice', {
          method: 'POST',
          body: formData,
        });

        let json: any = null;
        try {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            json = await response.json();
          } else {
            const rawText = await response.text();
            try {
              json = JSON.parse(rawText);
            } catch {
              // Non-JSON
            }
          }
        } catch {
          // Ignore parsing error
        }

        if (!response.ok || !json || json.success === false) {
          const serverErr = json?.error;
          if (serverErr) {
            throw new Error(serverErr);
          }
          if (response.status === 413) {
            throw new Error("Le fichier est trop volumineux (taille maximale: 25 Mo).");
          }
          if (response.status === 504 || response.status === 408) {
            throw new Error("Délai d'analyse dépassé par le serveur. Veuillez réessayer ou privilégier l'importation via fichier Excel (.xlsx).");
          }
          throw new Error("L'extraction automatique du document PDF/Image n'a pas pu aboutir. Veuillez vérifier que votre clé GEMINI_API_KEY est configurée, ou utilisez l'import Excel / l'exemple SALFA.");
        }

        const data: ParsedFactureAssurance = json?.data || json;
        if (!data || !Array.isArray(data.lignes) || data.lignes.length === 0) {
          throw new Error("Aucune ligne de prestation valide n'a pu être extraite de ce document.");
        } else {
          setParsedInvoice(data);
          const initialSelected: Record<number, boolean> = {};
          data.lignes.forEach((_, i) => { initialSelected[i] = true; });
          setSelectedLines(initialSelected);
        }
        setIsProcessing(false);
      }
    } catch (err: any) {
      console.error('Erreur analyse document:', err);
      setErrorMessage(err.message || "Erreur lors de l'analyse du document.");
      setIsProcessing(false);
    }
  };

  const handleToggleSelectAll = (checked: boolean) => {
    if (!parsedInvoice) return;
    const updated: Record<number, boolean> = {};
    parsedInvoice.lignes.forEach((_, i) => {
      updated[i] = checked;
    });
    setSelectedLines(updated);
  };

  const handleToggleSelectLine = (index: number) => {
    setSelectedLines(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const handleValidateImport = () => {
    if (!parsedInvoice) return;

    const chosenLignes = parsedInvoice.lignes.filter((_, idx) => selectedLines[idx]);
    if (chosenLignes.length === 0) {
      alert('Veuillez sélectionner au moins une ligne de soins à importer.');
      return;
    }

    const createdSocietes: Societe[] = [];
    const createdPersonnes: Personne[] = [];

    const isRealMatricule = (mat: string) => {
      const m = (mat || '').trim();
      return m !== '' && !m.toUpperCase().startsWith('MAT-');
    };

    const getBestMatricule = (mat1: string, mat2: string) => {
      if (isRealMatricule(mat1)) return mat1;
      if (isRealMatricule(mat2)) return mat2;
      return mat1 || mat2;
    };

    // Build a map of patient name to the best matricule found in this uploaded document
    const fileBestMatricules: Record<string, string> = {};
    chosenLignes.forEach(l => {
      const nameKey = (l.nomPrenom || '').trim().toLowerCase();
      const mat = (l.matricule || '').replace(/\s+/g, '');
      if (nameKey) {
        if (!fileBestMatricules[nameKey]) {
          fileBestMatricules[nameKey] = mat;
        } else {
          fileBestMatricules[nameKey] = getBestMatricule(fileBestMatricules[nameKey], mat);
        }
      }
    });

    const newPrestations: Prestation[] = chosenLignes.map((ligne, idx) => {
      const prestId = generateId(`prest-salfa-${idx}`);
      const mainSocName = ligne.societeAffiliee || parsedInvoice.clientDoit || 'BSA';
      const sousSoc = ligne.sousSociete || 'Département Général';

      // Society match / create
      let matchedSoc = societes.find(s => 
        s.nom.toLowerCase().includes(mainSocName.toLowerCase()) ||
        s.code.toLowerCase() === mainSocName.toLowerCase() ||
        (sousSoc && s.nom.toLowerCase().includes(sousSoc.toLowerCase()))
      );

      if (!matchedSoc && autoCreateMissingSocietes) {
        matchedSoc = {
          id: generateId(`soc-new-${idx}`),
          nom: sousSoc ? `${mainSocName} (${sousSoc})` : mainSocName,
          code: (sousSoc || mainSocName).substring(0, 4).toUpperCase(),
          tauxCouvertureDefaut: 80,
        };
        createdSocietes.push(matchedSoc);
      }

      // Patient match / create
      const nameKey = (ligne.nomPrenom || '').trim().toLowerCase();
      const fileMat = fileBestMatricules[nameKey] || '';

      // Find existing person by name first
      let matchedPer = personnes.find(p => 
        ligne.nomPrenom && (
          p.nomPrenom.toLowerCase() === ligne.nomPrenom.toLowerCase() ||
          p.nomPrenom.toLowerCase().includes(ligne.nomPrenom.toLowerCase()) ||
          ligne.nomPrenom.toLowerCase().includes(p.nomPrenom.toLowerCase())
        )
      );

      const rowMatricule = fileMat || (ligne.matricule || '').replace(/\s+/g, '');
      if (!matchedPer && rowMatricule) {
        matchedPer = personnes.find(p => 
          p.matricule.replace(/\s+/g, '').toLowerCase() === rowMatricule.toLowerCase()
        );
      }

      let finalMatricule = rowMatricule;
      if (matchedPer) {
        finalMatricule = getBestMatricule(matchedPer.matricule, finalMatricule);
        
        // If we found a real/better matricule, update the existing person record in the parent state
        if (isRealMatricule(finalMatricule) && !isRealMatricule(matchedPer.matricule)) {
          matchedPer.matricule = finalMatricule;
          // Add to createdPersonnes to propagate the update back to App.tsx
          if (!createdPersonnes.some(p => p.id === matchedPer!.id)) {
            createdPersonnes.push({
              ...matchedPer,
              matricule: finalMatricule
            });
          }
        }
      }

      if (!matchedPer && autoCreateMissingPersonnes) {
        matchedPer = {
          id: generateId(`per-new-${idx}`),
          matricule: finalMatricule || `MAT-${100000 + idx}`,
          nomPrenom: ligne.nomPrenom,
          societeId: matchedSoc?.id || societes[0]?.id || 'soc-1',
          qualite: (ligne.ayantDroit ? 'Ayant droit' : 'Adhérent Principal') as any,
        };
        createdPersonnes.push(matchedPer);
      }

      // Build multiple sub-lines per act
      const subLines: LignePrestation[] = (ligne.actes && ligne.actes.length > 0)
        ? ligne.actes.map((a, actIdx) => {
            const actMontant = a.montant || Math.round(ligne.montantBrut / (ligne.actes?.length || 1));
            const partRatio = ligne.montantBrut > 0 ? actMontant / ligne.montantBrut : 1 / (ligne.actes?.length || 1);
            const actPart = Math.round((ligne.participation || 0) * partRatio);
            const actPaye = 0; // Not settled yet in Prestations tab!

            const actARemb = Math.max(0, actMontant - actPart);
            return {
              id: generateId(`lig-${idx}-${actIdx}`),
              prestationId: prestId,
              code: a.code || 'CONS',
              libelle: a.libelle || a.code,
              totalPrestation: actMontant,
              ticketModerateur: actPart,
              montantARembourser: actARemb,
              totalPaye: actPaye,
              statut: 'En attente' as const,
            };
          })
        : [
            {
              id: generateId(`lig-${idx}`),
              prestationId: prestId,
              code: 'CONS',
              libelle: ligne.actesTexte || 'Consultation & Soins',
              totalPrestation: ligne.montantBrut,
              ticketModerateur: ligne.participation,
              montantARembourser: Math.max(0, ligne.montantBrut - ligne.participation),
              totalPaye: 0,
              statut: 'En attente' as const,
            }
          ];

      const montantARemb = Math.max(0, ligne.montantBrut - ligne.participation);

      return {
        id: prestId,
        numeroFacture: parsedInvoice.numeroFacture || `FA-SALFA-${idx + 1}`,
        date: ligne.dateSoins || parsedInvoice.dateEmission || new Date().toISOString().split('T')[0],
        societeId: matchedSoc?.id || societes[0]?.id || 'soc-1',
        societeNom: matchedSoc?.nom || mainSocName,
        sousSociete: sousSoc,
        personneId: matchedPer?.id || personnes[0]?.id || 'per-1',
        nomAgent: ligne.nomPrenom,
        matricule: finalMatricule || matchedPer?.matricule || '',
        totalPrestation: ligne.montantBrut,
        montantTotal: ligne.montantBrut,
        participation: ligne.participation,
        ticketModerateur: ligne.participation,
        montantARembourser: montantARemb,
        totalPaye: 0,
        resteAPayer: montantARemb,
        statut: 'En attente' as const,
        dateCreation: new Date().toISOString().split('T')[0],
        commentaires: `Facture Hôpital SALFA (${ligne.observations || parsedInvoice.numeroFacture})`,
        lignes: subLines,
      };
    });

    onImportPrestations(newPrestations, createdSocietes, createdPersonnes);
    handleResetAndBack();
    onClose();
  };

  const selectedCount = parsedInvoice ? parsedInvoice.lignes.filter((_, i) => selectedLines[i]).length : 0;
  const totalSelectedBrut = parsedInvoice
    ? parsedInvoice.lignes.filter((_, i) => selectedLines[i]).reduce((s, l) => s + l.montantBrut, 0)
    : 0;
  const totalSelectedPart = parsedInvoice
    ? parsedInvoice.lignes.filter((_, i) => selectedLines[i]).reduce((s, l) => s + l.participation, 0)
    : 0;
  const totalSelectedNet = parsedInvoice
    ? parsedInvoice.lignes.filter((_, i) => selectedLines[i]).reduce((s, l) => s + l.netAPayer, 0)
    : 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-5xl rounded-2xl bg-white shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            {parsedInvoice && (
              <button
                onClick={handleResetAndBack}
                title="Retour au choix de document"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 text-xs font-semibold shadow-xs transition"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Retour</span>
              </button>
            )}
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {parsedInvoice ? `Aperçu Facture : ${parsedInvoice.numeroFacture || parsedInvoice.clientDoit}` : 'Importation Facture Médicale SALFA'}
              </h3>
              <p className="text-xs text-slate-500">
                {parsedInvoice ? `${parsedInvoice.lignes.length} patients extraits • Vérifiez et validez les prestations` : 'Créez directement les dossiers de soins et prestations avec détail des actes par patient.'}
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Permanent Info Banner: Unique SALFA Format */}
          <div className="flex items-start gap-3 rounded-xl bg-indigo-50/50 border border-indigo-100 p-4 text-xs text-indigo-900 shadow-2xs">
            <Info className="h-5 w-5 shrink-0 text-indigo-600 mt-0.5" />
            <div>
              <h4 className="font-bold text-indigo-950 mb-1">ℹ️ Format Unique de Facturation SALFA</h4>
              <p className="leading-relaxed">
                Les factures de prestations de soins suivent <strong>un format unique émis par l'Hôpital SALFA</strong> à destination de ses différents clients assureurs (<strong>BSA, ASCOMA, MCI Care</strong>, etc.). Le système extrait automatiquement les assurés, leurs sous-sociétés d'affiliation et le détail complet des actes médicaux depuis ce format type.
              </p>
            </div>
          </div>

          {errorMessage && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-800 shadow-2xs space-y-2.5">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <span className="font-medium leading-relaxed">{errorMessage}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-rose-200/60">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setImportMode('excel');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-semibold shadow-xs transition"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span>Utiliser le Mode Excel (.xlsx)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    handleLoadSample();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-rose-300 text-rose-700 hover:bg-rose-100 font-semibold transition"
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  <span>Charger l'exemple SALFA</span>
                </button>
                <button
                  type="button"
                  onClick={() => setErrorMessage(null)}
                  className="ml-auto text-xs text-slate-500 hover:text-slate-700 underline"
                >
                  Fermer
                </button>
              </div>
            </div>
          )}

          {!parsedInvoice && (
            <div className="space-y-4">
              {/* Import Mode Selector */}
              <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setImportMode('excel')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-semibold transition ${
                    importMode === 'excel'
                      ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  <span>Mode Excel (.xlsx, .csv)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode('pdf')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-semibold transition ${
                    importMode === 'pdf'
                      ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <ScanLine className="h-4 w-4 text-indigo-600" />
                  <span>Mode Scan PDF / Image</span>
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode('sample')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-semibold transition ${
                    importMode === 'sample'
                      ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <span>Exemple Démo SALFA</span>
                </button>
              </div>

              {/* Mode: EXCEL */}
              {importMode === 'excel' && (
                <div className="space-y-3">
                  {/* Download Excel Template Banner */}
                  <div className="flex items-center justify-between rounded-xl bg-emerald-50/80 border border-emerald-200 p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 mt-0.5">
                        <FileSpreadsheet className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-emerald-950">Modèle Excel pour Prestations SALFA</h4>
                        <p className="text-xs text-emerald-800 mt-0.5 max-w-lg">
                          Téléchargez le fichier modèle prêt à remplir contenant toutes les colonnes requises : 
                          <strong> Numero_Facture, Nom_Agent, Societe, Sous_Societe, Acte_Medicale_Prix, Montants</strong>...
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => downloadPrestationsExcelTemplate()}
                      className="flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-600 shadow-xs shrink-0"
                    >
                      <Download className="h-4 w-4" />
                      <span>Télécharger le modèle Excel</span>
                    </button>
                  </div>

                  {/* Excel Upload Area */}
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files?.[0];
                      if (file) {
                        const event = { target: { files: [file] } } as any;
                        handleFileUpload(event);
                      }
                    }}
                    className="flex min-h-52 flex-col items-center justify-center space-y-3 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/30 p-8 text-center transition hover:border-emerald-500 hover:bg-emerald-50/50"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-xs text-emerald-600 border border-emerald-100">
                      {isProcessing ? <RefreshCw className="h-6 w-6 animate-spin" /> : <FileSpreadsheet className="h-6 w-6" />}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">
                        {isProcessing ? 'Lecture du fichier Excel en cours...' : 'Déposez votre fichier Excel de prestations (.xlsx, .xls, .csv)'}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 max-w-md">
                        Importe chaque agent, sépare la sous-société et découpe automatiquement les actes dans la colonne <strong>Acte médicale / Prix</strong>.
                      </p>
                    </div>
                    <input
                      type="file"
                      ref={excelInputRef}
                      onChange={handleFileUpload}
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => excelInputRef.current?.click()}
                      disabled={isProcessing}
                      className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600 shadow-xs"
                    >
                      Parcourir un fichier Excel
                    </button>
                  </div>
                </div>
              )}

              {/* Mode: PDF / IMAGE OCR */}
              {importMode === 'pdf' && (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) {
                      const event = { target: { files: [file] } } as any;
                      handleFileUpload(event);
                    }
                  }}
                  className="flex min-h-56 flex-col items-center justify-center space-y-3 rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50/20 p-8 text-center transition hover:border-indigo-500 hover:bg-indigo-50/40"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-xs text-indigo-600 border border-indigo-100">
                    {isProcessing ? <RefreshCw className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">
                      {isProcessing ? 'Extraction IA de la facture en cours...' : 'Déposez votre facture SALFA numérisée (PDF ou Image)'}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-md">
                      Reconnaissance intelligente des colonnes, sous-sociétés entre parenthèses et actes médicaux avec montants.
                    </p>
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessing}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500 shadow-xs"
                  >
                    Parcourir un fichier PDF ou Image
                  </button>
                </div>
              )}

              {/* Mode: SAMPLE */}
              {importMode === 'sample' && (
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-6 space-y-4">
                  <div className="flex items-center gap-2 text-indigo-950 font-bold text-sm">
                    <Sparkles className="h-5 w-5 text-indigo-600" />
                    <span>Facture réelle SALFA N° FA-05/BSA (Client BSA)</span>
                  </div>
                  <p className="text-xs text-indigo-800 leading-relaxed">
                    Charge un jeu de données réel complet avec 25 patients (BFV, Accès Banques, Orange, etc.) et actes médicaux variés (CONS, MEDIC, DENT, LABO, RADIO, SOINS). Parfait pour tester et valider le flux en 1 clic.
                  </p>
                  <div className="pt-2 flex justify-start">
                    <button
                      type="button"
                      onClick={handleLoadSample}
                      disabled={isProcessing}
                      className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-indigo-500 shadow-xs flex items-center gap-2"
                    >
                      {isProcessing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      <span>Charger l'exemple réel SALFA (25 patients)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {parsedInvoice && (
            <div className="space-y-4">
              {/* Conditional format check warning banner */}
              {(() => {
                const isSalfaDoc = 
                  parsedInvoice.etablissement?.toLowerCase().includes('salfa') || 
                  parsedInvoice.etablissement?.toLowerCase().includes('loterana') ||
                  parsedInvoice.etablissement?.toLowerCase().includes('lutherienne') ||
                  parsedInvoice.numeroFacture?.toLowerCase().includes('salfa') ||
                  parsedInvoice.numeroFacture?.toLowerCase().includes('fa-') ||
                  parsedInvoice.lignes?.some(l => l.observations?.toLowerCase().includes('salfa'));
                
                if (!isSalfaDoc) {
                  return (
                    <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900 shadow-2xs">
                      <Info className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                      <div>
                        <h4 className="font-bold text-amber-950 mb-1">⚠️ Info : Format non standard</h4>
                        <p className="leading-relaxed">
                          Ce document ne semble pas provenir de la facturation standard de <strong>l'Hôpital SALFA</strong>. 
                          Rappel : L'importation de prestations est spécifiquement optimisée pour le format de facture unique émis par SALFA vers ses clients (BSA, ASCOMA, MCI Care). 
                          Vous pouvez continuer l'importation, mais veillez à vérifier attentivement les données extraites ci-dessous.
                        </p>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Document Overview Header */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
                <div>
                  <span className="text-slate-500 block">Organisme / Client</span>
                  <strong className="text-slate-900 font-bold text-sm">{parsedInvoice.clientDoit}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Facture N°</span>
                  <strong className="text-indigo-600 font-bold text-sm">{parsedInvoice.numeroFacture}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Lignes extraites</span>
                  <strong className="text-slate-900 font-bold text-sm">{parsedInvoice.lignes.length} patients</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Montant Total Facturé</span>
                  <strong className="text-emerald-700 font-bold text-sm">{formatMoney(parsedInvoice.totalMontantBrut)}</strong>
                </div>
              </div>

              {/* Ingestion options */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 text-xs">
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={autoCreateMissingPersonnes}
                      onChange={(e) => setAutoCreateMissingPersonnes(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    <span>Créer assurés manquants</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={autoCreateMissingSocietes}
                      onChange={(e) => setAutoCreateMissingSocietes(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    <span>Créer sous-sociétés (parenthèses)</span>
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleSelectAll(true)}
                    className="text-xs text-indigo-600 font-semibold hover:underline"
                  >
                    Tout cocher
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    onClick={() => handleToggleSelectAll(false)}
                    className="text-xs text-slate-500 hover:underline"
                  >
                    Tout décocher
                  </button>
                </div>
              </div>

              {/* Extracted Lines Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 w-8">
                        <input
                          type="checkbox"
                          checked={selectedCount === parsedInvoice.lignes.length}
                          onChange={(e) => handleToggleSelectAll(e.target.checked)}
                          className="rounded text-indigo-600"
                        />
                      </th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Matricule & Assuré</th>
                      <th className="py-2.5 px-3">Sous-Société</th>
                      <th className="py-2.5 px-3 min-w-[200px]">Acte médicale / Prix</th>
                      <th className="py-2.5 px-3 text-right">Montant Brut</th>
                      <th className="py-2.5 px-3 text-right">Ticket Modérateur</th>
                      <th className="py-2.5 px-3 text-right">Prise en Charge (Net)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedInvoice.lignes.map((ligne, idx) => (
                      <tr
                        key={idx}
                        className={`hover:bg-slate-50/80 transition ${
                          selectedLines[idx] ? 'bg-white' : 'bg-slate-50/50 opacity-60'
                        }`}
                      >
                        <td className="py-2.5 px-3">
                          <input
                            type="checkbox"
                            checked={!!selectedLines[idx]}
                            onChange={() => handleToggleSelectLine(idx)}
                            className="rounded text-indigo-600"
                          />
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                          {ligne.dateSoins}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-900">{ligne.nomPrenom}</div>
                          <div className="text-[11px] text-slate-500 font-mono">Mat: {ligne.matricule || '-'}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          {ligne.sousSociete ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                              {ligne.sousSociete}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 min-w-[200px]">
                          {ligne.actes && ligne.actes.length > 0 ? (
                            <div className="flex flex-col gap-1">
                              {ligne.actes.map((a, i) => (
                                <div
                                  key={i}
                                  className="flex items-center justify-between px-2 py-0.5 rounded text-[11px] font-mono bg-indigo-50/70 border border-indigo-100 text-indigo-900"
                                >
                                  <span className="font-bold">{a.code}</span>
                                  <span className="font-semibold text-slate-800 ml-2">
                                    {formatMoney(a.montant)}
                                  </span>
                                </div>
                              ))}
                              {ligne.actes.length > 1 && (
                                <div className="text-[10px] text-slate-400 font-medium px-1">
                                  {ligne.actes.length} actes cumulés
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-600 text-[11px]">{ligne.actesTexte}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-slate-900">
                          {formatMoney(ligne.montantBrut)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-amber-700 font-medium">
                          {formatMoney(ligne.participation)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                          {formatMoney(ligne.netAPayer)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Bottom Reset Action */}
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setParsedInvoice(null);
                    setSelectedLines({});
                  }}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  Charger un autre document
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 bg-slate-50/70 rounded-b-2xl">
          <div>
            {parsedInvoice && (
              <div className="text-xs text-slate-600">
                <strong className="text-slate-900 font-bold">{selectedCount}</strong> prestations sélectionnées •{' '}
                Total : <strong className="text-slate-900 font-bold">{formatMoney(totalSelectedBrut)}</strong> (Net prise en charge :{' '}
                <strong className="text-emerald-700 font-bold">{formatMoney(totalSelectedNet)}</strong>)
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {parsedInvoice && (
              <button
                onClick={handleResetAndBack}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition flex items-center gap-1.5 shadow-2xs"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Retour</span>
              </button>
            )}
            <button
              onClick={handleClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Annuler
            </button>
            {parsedInvoice && (
              <button
                onClick={handleValidateImport}
                disabled={selectedCount === 0}
                className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white transition hover:bg-indigo-500 disabled:opacity-50 shadow-xs flex items-center gap-2"
              >
                <Check className="h-4 w-4" />
                <span>Enregistrer {selectedCount} Prestations</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
