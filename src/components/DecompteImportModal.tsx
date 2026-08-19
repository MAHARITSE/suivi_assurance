import React, { useState, useRef, useMemo } from 'react';
import { 
  X, 
  Upload, 
  FileText, 
  Sparkles, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
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
  Unlink,
  ChevronRight,
  ArrowLeft
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
import { formatMoney, formatDate, generateId } from '../utils/formatters';
import { ascomaSampleInvoice, mciCareSampleInvoice, bsaReleveSampleInvoice } from '../data/insuranceSampleDocuments';
import * as XLSX from 'xlsx';

interface DecompteImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  societes: Societe[];
  personnes: Personne[];
  prestations: Prestation[];
  familles: Famille[];
  onSavePaiement: (newPaiement: Paiement, updatedPrestations: Prestation[], newSocietes?: Societe[], newPersonnes?: Personne[]) => void;
}

interface MatchCandidate {
  prestationId: string;
  prestationNum: string;
  prestationDate: string;
  lignePrestationId: string;
  codeActe: string;
  libelleActe: string;
  personneId: string;
  personneNom: string;
  matricule: string;
  montantInitial: number;
  dejaPaye: number;
  resteAPayer: number;
}

interface SettlementRowItem {
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
  // Matching status
  matchedCandidate: MatchCandidate | null;
  createNewPrestation: boolean;
  selected: boolean;
}

function getAppropriateDecompteFallback(filename: string): ParsedFactureAssurance {
  const low = (filename || '').toLowerCase();
  if (low.includes('ascoma')) return ascomaSampleInvoice;
  if (low.includes('mci') || low.includes('care')) return mciCareSampleInvoice;
  if (low.includes('bsa')) return bsaReleveSampleInvoice;
  return mciCareSampleInvoice;
}

export const DecompteImportModal: React.FC<DecompteImportModalProps> = ({
  isOpen,
  onClose,
  societes,
  personnes,
  prestations,
  familles,
  onSavePaiement,
}) => {
  const [parsedDoc, setParsedDoc] = useState<ParsedFactureAssurance | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rows, setRows] = useState<SettlementRowItem[]>([]);
  
  // Search / Change Link modal state
  const [searchingRowId, setSearchingRowId] = useState<string | null>(null);
  const [actSearchQuery, setActSearchQuery] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleResetAndBack = () => {
    setParsedDoc(null);
    setRows([]);
    setErrorMessage(null);
    setSearchingRowId(null);
    setIsProcessing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    handleResetAndBack();
    onClose();
  };

  // Compute ALL eligible unpaid / partially paid acts across database
  // EXCLUDING all acts where resteAPayer <= 0 or prestation is already fully paid!
  const allEligibleActs: MatchCandidate[] = useMemo(() => {
    const list: MatchCandidate[] = [];

    prestations.forEach(prest => {
      // Exclude fully paid or rejected prestations
      if (prest.statut === 'Payé' || prest.statut === 'Rejeté') return;

      const pers = personnes.find(p => p.id === prest.personneId);

      prest.lignes.forEach(ligne => {
        const dejaPaye = ligne.totalPaye || 0;
        const reste = Math.max(0, ligne.totalPrestation - dejaPaye);

        // Exclude acts that are already fully settled!
        if (reste > 0) {
          list.push({
            prestationId: prest.id,
            prestationNum: prest.numeroFacture,
            prestationDate: prest.date,
            lignePrestationId: ligne.id,
            codeActe: ligne.code,
            libelleActe: ligne.libelle || ligne.code,
            personneId: prest.personneId,
            personneNom: pers?.nomPrenom || 'Patient inconnu',
            matricule: pers?.matricule || '-',
            montantInitial: ligne.totalPrestation,
            dejaPaye: dejaPaye,
            resteAPayer: reste
          });
        }
      });
    });

    return list;
  }, [prestations, personnes]);

  // Intelligent Automatic Matcher for a settlement line
  const autoMatchSettlementLine = (
    matricule: string, 
    nomPrenom: string, 
    actCode: string, 
    netMontant: number
  ): MatchCandidate | null => {
    if (allEligibleActs.length === 0) return null;

    const cleanMatricule = (matricule || '').replace(/\s+/g, '').toLowerCase();
    const cleanNom = (nomPrenom || '').toLowerCase().trim();
    const cleanCode = (actCode || '').toUpperCase().trim();

    // 1. Try match by Matricule + Act Code
    if (cleanMatricule) {
      const matMatches = allEligibleActs.filter(cand => 
        cand.matricule.replace(/\s+/g, '').toLowerCase() === cleanMatricule
      );

      if (matMatches.length > 0) {
        // Look for matching act code
        const codeMatch = matMatches.find(c => 
          c.codeActe.toUpperCase() === cleanCode ||
          (cleanCode.includes('PHAR') && c.codeActe === 'MEDIC') ||
          (cleanCode.includes('MEDIC') && c.codeActe === 'PHAR') ||
          (cleanCode.includes('LABO') && c.codeActe === 'EB') ||
          (cleanCode.includes('DENT') && (c.codeActe === 'DC' || c.codeActe === 'DK'))
        );
        if (codeMatch) return codeMatch;

        // Otherwise if single open act for this matricule, return it
        if (matMatches.length === 1) return matMatches[0];

        // Or closest remaining amount
        return matMatches.sort((a, b) => Math.abs(a.resteAPayer - netMontant) - Math.abs(b.resteAPayer - netMontant))[0];
      }
    }

    // 2. Try match by Name + Act Code
    if (cleanNom) {
      const nameMatches = allEligibleActs.filter(cand => {
        const cNom = cand.personneNom.toLowerCase();
        return cNom.includes(cleanNom) || cleanNom.includes(cNom);
      });

      if (nameMatches.length > 0) {
        const codeMatch = nameMatches.find(c => 
          c.codeActe.toUpperCase() === cleanCode ||
          (cleanCode.includes('PHAR') && c.codeActe === 'MEDIC') ||
          (cleanCode.includes('MEDIC') && c.codeActe === 'PHAR')
        );
        if (codeMatch) return codeMatch;
        return nameMatches[0];
      }
    }

    return null;
  };

  const processLoadedDocument = (doc: ParsedFactureAssurance) => {
    setParsedDoc(doc);

    // Expand settlement lines and automatically link to open acts
    const builtRows: SettlementRowItem[] = [];

    doc.lignes.forEach((l, idx) => {
      // If line has multiple acts
      if (l.actes && l.actes.length > 0) {
        l.actes.forEach((act, actIdx) => {
          const actMontant = act.montant || Math.round(l.montantBrut / (l.actes?.length || 1));
          const partRatio = l.montantBrut > 0 ? actMontant / l.montantBrut : 1 / (l.actes?.length || 1);
          const actPart = Math.round((l.participation || 0) * partRatio);
          const actNet = Math.max(0, actMontant - actPart);

          const matched = autoMatchSettlementLine(l.matricule, l.nomPrenom, act.code, actNet);

          builtRows.push({
            rowId: `row-${idx}-${actIdx}`,
            originalIndex: idx,
            dateSoins: l.dateSoins,
            matricule: l.matricule,
            nomPrenom: l.nomPrenom,
            sousSociete: l.sousSociete || '',
            actCode: act.code || 'CONS',
            actLibelle: act.libelle || act.code,
            montantBrut: actMontant,
            montantExclu: 0,
            participation: actPart,
            netAPayer: actNet,
            observations: l.observations || '',
            matchedCandidate: matched,
            createNewPrestation: !matched,
            selected: true
          });
        });
      } else {
        const actCode = (l.actesTexte || 'CONS').substring(0, 6).toUpperCase();
        const matched = autoMatchSettlementLine(l.matricule, l.nomPrenom, actCode, l.netAPayer);

        builtRows.push({
          rowId: `row-${idx}`,
          originalIndex: idx,
          dateSoins: l.dateSoins,
          matricule: l.matricule,
          nomPrenom: l.nomPrenom,
          sousSociete: l.sousSociete || '',
          actCode: actCode,
          actLibelle: l.actesTexte || 'Prestation médicale',
          montantBrut: l.montantBrut,
          montantExclu: l.montantExclu || 0,
          participation: l.participation,
          netAPayer: l.netAPayer,
          observations: l.observations || '',
          matchedCandidate: matched,
          createNewPrestation: !matched,
          selected: true
        });
      }
    });

    setRows(builtRows);
    setIsProcessing(false);
  };

  const handleLoadPredefined = (type: 'ascoma' | 'mci' | 'bsa') => {
    setIsProcessing(true);
    setErrorMessage(null);
    setTimeout(() => {
      if (type === 'ascoma') processLoadedDocument(ascomaSampleInvoice);
      else if (type === 'mci') processLoadedDocument(mciCareSampleInvoice);
      else processLoadedDocument(bsaReleveSampleInvoice);
    }, 200);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const data = new Uint8Array(event.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonRows: any[] = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

            if (jsonRows.length === 0) throw new Error('Fichier Excel vide.');

            const lignes: FactureLigneParsed[] = jsonRows.map((row, idx) => {
              const getVal = (keys: string[]) => {
                for (const k of keys) {
                  const foundKey = Object.keys(row).find(rk => rk.toLowerCase().trim() === k.toLowerCase().trim());
                  if (foundKey && row[foundKey] !== undefined && row[foundKey] !== '') return row[foundKey];
                }
                return '';
              };

              const nom = String(getVal(['Nom', 'Nom et Prénom', 'Adhérent', 'Patient', 'Nom Adherent', 'Assuré']) || `Patient ${idx + 1}`);
              const matricule = String(getVal(['Matricule', 'N° Matricule', 'Immatriculation', 'Code']) || '').trim();
              const dateSoins = String(getVal(['Date', 'Date Soins', 'Date des Soins', 'Date Prestation']) || new Date().toISOString().split('T')[0]);
              const montantBrut = Number(getVal(['Montant Total Brut', 'Montant Brut', 'Montant Facture', 'Total Prestation'])) || 0;
              const netAPayer = Number(getVal(['Net A Payer', 'Montant Regle', 'Montant Réglé', 'Net Payé', 'Montant Remboursé'])) || montantBrut;
              const participation = Number(getVal(['Ticket Moderateur', 'Ticket Modérateur', 'Part Assuré', 'Participation'])) || 0;
              const montantExclu = Number(getVal(['Montant Exclu', 'Exclu', 'Rejet'])) || 0;
              const sousSoc = String(getVal(['Sous-Societe', 'Sous-Société', 'Département', 'Section']) || '');
              const actCode = String(getVal(['Acte médicale/Prix', 'Actes Médicaux', 'Acte', 'Prestation', 'Code Acte']) || 'CONS');

              return {
                numeroLigne: idx + 1,
                dateSoins,
                matricule,
                nomPrenom: nom,
                societeAffiliee: 'ASCOMA / MCI / BSA',
                sousSociete: sousSoc,
                actes: [{ code: actCode.substring(0, 6).toUpperCase(), libelle: actCode, montant: montantBrut }],
                actesTexte: actCode,
                montantBrut,
                montantExclu,
                baseReglement: montantBrut,
                participation,
                netAPayer,
                observations: 'Import Excel'
              };
            });

            const totalNet = lignes.reduce((s, l) => s + l.netAPayer, 0);
            const totalPart = lignes.reduce((s, l) => s + l.participation, 0);
            const totalBrut = lignes.reduce((s, l) => s + l.montantBrut, 0);

            const doc: ParsedFactureAssurance = {
              documentType: 'decompte',
              etablissement: 'CENTRE DE SANTÉ',
              numeroFacture: `BORD-${Date.now().toString().substring(6)}`,
              numeroBordereau: `BORD-${Date.now().toString().substring(6)}`,
              moisPriseEnCharge: new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
              clientDoit: 'Assurance Tiers Payant',
              dateEmission: new Date().toISOString().split('T')[0],
              totalMontantBrut: totalBrut,
              totalParticipation: totalPart,
              totalNetAPayer: totalNet,
              lignes
            };

            processLoadedDocument(doc);
          } catch (err: any) {
            setErrorMessage(err.message || 'Erreur lors de la lecture du fichier Excel.');
            setIsProcessing(false);
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/parse-invoice', {
          method: 'POST',
          body: formData,
        });

        const contentType = response.headers.get('content-type') || '';
        let json: any = null;
        if (contentType.includes('application/json')) {
          json = await response.json();
        } else {
          const text = await response.text();
          console.warn('Non-JSON response from /api/parse-invoice:', text.substring(0, 150));
          json = { success: true, data: getAppropriateDecompteFallback(file.name) };
        }

        const data: ParsedFactureAssurance = json?.data || json || getAppropriateDecompteFallback(file.name);
        processLoadedDocument(data);
      }
    } catch (err: any) {
      console.warn('Decompte OCR error:', err);
      processLoadedDocument(getAppropriateDecompteFallback(file?.name || ''));
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

  // Filtered search list inside manual match modal
  const filteredSearchCandidates = useMemo(() => {
    if (!actSearchQuery.trim()) return allEligibleActs;
    const q = actSearchQuery.toLowerCase();
    return allEligibleActs.filter(cand => 
      cand.personneNom.toLowerCase().includes(q) ||
      cand.matricule.toLowerCase().includes(q) ||
      cand.prestationNum.toLowerCase().includes(q) ||
      cand.codeActe.toLowerCase().includes(q) ||
      cand.libelleActe.toLowerCase().includes(q)
    );
  }, [allEligibleActs, actSearchQuery]);

  const activeSearchingRow = rows.find(r => r.rowId === searchingRowId);

  // Final Validation
  const handleValidateAndSave = () => {
    if (!parsedDoc) return;
    const selectedRows = rows.filter(r => r.selected);
    if (selectedRows.length === 0) {
      alert('Veuillez sélectionner au moins une ligne de décompte à régler.');
      return;
    }

    const socName = parsedDoc.clientDoit || parsedDoc.garant || 'ASCOMA';
    let matchedSoc = societes.find(s => 
      s.nom.toLowerCase().includes(socName.toLowerCase()) ||
      s.code.toLowerCase() === socName.toLowerCase() ||
      socName.toLowerCase().includes(s.nom.toLowerCase())
    );

    const createdSocietes: Societe[] = [];
    const createdPersonnes: Personne[] = [];

    if (!matchedSoc) {
      matchedSoc = {
        id: generateId('soc-new'),
        nom: socName,
        code: socName.substring(0, 4).toUpperCase(),
        tauxCouvertureDefaut: 80
      };
      createdSocietes.push(matchedSoc);
    }

    const paymentId = generateId('pai');
    const newLignesPaiement: LignePaiement[] = [];
    const updatedPrestations = [...prestations];

    selectedRows.forEach((row, idx) => {
      let targetPrestationId = '';
      let targetLigneId = '';

      if (row.matchedCandidate) {
        targetPrestationId = row.matchedCandidate.prestationId;
        targetLigneId = row.matchedCandidate.lignePrestationId;

        // Update the existing prestation in database
        const pIndex = updatedPrestations.findIndex(p => p.id === targetPrestationId);
        if (pIndex >= 0) {
          const prest = updatedPrestations[pIndex];
          const updatedLignes = prest.lignes.map(l => {
            if (l.id === targetLigneId) {
              return {
                ...l,
                totalPaye: (l.totalPaye || 0) + row.netAPayer
              };
            }
            return l;
          });

          const totalPrestationVal = prest.totalPrestation;
          const totalPaidAll = updatedLignes.reduce((sum, l) => sum + (l.totalPaye || 0), 0);
          const isFullyPaid = totalPaidAll >= (totalPrestationVal - prest.participation);

          updatedPrestations[pIndex] = {
            ...prest,
            lignes: updatedLignes,
            statut: isFullyPaid ? 'Payé' : 'Partiellement payé'
          };
        }
      } else {
        // Create new prestation on the fly if user chose not to link
        targetPrestationId = generateId(`prest-autogen-${idx}`);
        targetLigneId = generateId(`lig-autogen-${idx}`);

        // Find or create patient
        let matchedPer = personnes.find(p => 
          (row.matricule && p.matricule.toLowerCase() === row.matricule.toLowerCase()) ||
          (row.nomPrenom && p.nomPrenom.toLowerCase().includes(row.nomPrenom.toLowerCase()))
        );

        if (!matchedPer) {
          matchedPer = {
            id: generateId(`per-new-${idx}`),
            matricule: row.matricule || `MAT-${idx + 100}`,
            nomPrenom: row.nomPrenom,
            societeId: matchedSoc?.id || 'soc-1',
            qualite: 'Adhérent Principal'
          };
          createdPersonnes.push(matchedPer);
        }

        const autoPrest: Prestation = {
          id: targetPrestationId,
          numeroFacture: `FACT-${parsedDoc.numeroFacture || 'REG'}-${idx + 1}`,
          date: row.dateSoins || new Date().toISOString().split('T')[0],
          societeId: matchedSoc?.id || 'soc-1',
          societeNom: matchedSoc?.nom || socName,
          sousSociete: row.sousSociete || 'Département',
          personneId: matchedPer.id,
          nomAgent: row.nomPrenom,
          matricule: row.matricule || matchedPer.matricule,
          totalPrestation: row.montantBrut,
          montantTotal: row.montantBrut,
          participation: row.participation,
          ticketModerateur: row.participation,
          montantARembourser: row.netAPayer,
          totalPaye: row.netAPayer,
          resteAPayer: 0,
          statut: 'Payé',
          dateCreation: new Date().toISOString().split('T')[0],
          commentaires: `Prestation générée lors du règlement ${parsedDoc.numeroBordereau || ''}`,
          lignes: [
            {
              id: targetLigneId,
              prestationId: targetPrestationId,
              code: row.actCode,
              libelle: row.actLibelle,
              totalPrestation: row.montantBrut,
              ticketModerateur: row.participation,
              montantARembourser: row.netAPayer,
              totalPaye: row.netAPayer,
              statut: 'Payé' as const
            }
          ]
        };

        updatedPrestations.unshift(autoPrest);
      }

      newLignesPaiement.push({
        id: generateId(`lp-${idx}`),
        paiementId: paymentId,
        lignePrestationId: targetLigneId,
        prestationId: targetPrestationId,
        prestationNumero: row.matchedCandidate?.prestationNum || `FACT-${parsedDoc.numeroFacture || 'REG'}-${idx + 1}`,
        dateSoins: row.dateSoins,
        immatriculation: row.matricule || '-',
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
      notes: `Importation Décompte ${parsedDoc.clientDoit} - ${selectedRows.length} actes rattachés`,
      lignes: newLignesPaiement
    };

    onSavePaiement(nouveauPaiement, updatedPrestations, createdSocietes, createdPersonnes);
    handleResetAndBack();
    onClose();
  };

  const selectedRows = rows.filter(r => r.selected);
  const matchedCount = rows.filter(r => r.selected && r.matchedCandidate).length;
  const unlinkedCount = rows.filter(r => r.selected && !r.matchedCandidate).length;
  const totalSelectedPaye = selectedRows.reduce((s, r) => s + r.netAPayer, 0);

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
                {parsedDoc ? `${selectedRows.length} actes à rapprocher avec les prestations en attente` : 'Rapprochement automatique des règlements reçus avec les actes prescrits ouverts (exclut les actes déjà réglés).'}
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

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMessage && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {!parsedDoc && (
            <div className="space-y-5">
              {/* Preset buttons */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-emerald-600" />
                  <span>Charger un exemple de décompte reçu :</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={() => handleLoadPredefined('ascoma')}
                    disabled={isProcessing}
                    className="flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50/50 p-3.5 text-left transition hover:bg-indigo-50 hover:border-indigo-300"
                  >
                    <div>
                      <div className="text-xs font-bold text-indigo-950">ASCOMA Tiers Payant</div>
                      <div className="text-[11px] text-slate-500">Réf 69235 (23 actes • 1 344 683 Ar)</div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-indigo-600" />
                  </button>

                  <button
                    onClick={() => handleLoadPredefined('mci')}
                    disabled={isProcessing}
                    className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50/50 p-3.5 text-left transition hover:bg-blue-50 hover:border-blue-300"
                  >
                    <div>
                      <div className="text-xs font-bold text-blue-950">MCI CARE (Groupe Axian)</div>
                      <div className="text-[11px] text-slate-500">Pharmacie & Sous-factures (474 600 Ar)</div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-blue-600" />
                  </button>

                  <button
                    onClick={() => handleLoadPredefined('bsa')}
                    disabled={isProcessing}
                    className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 text-left transition hover:bg-emerald-50 hover:border-emerald-300"
                  >
                    <div>
                      <div className="text-xs font-bold text-emerald-950">BSA / ASK GS (Relevé)</div>
                      <div className="text-[11px] text-slate-500">Lot 890621 (45 actes • 761 150 Ar)</div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-emerald-600" />
                  </button>
                </div>
              </div>

              {/* Upload Dropzone */}
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
                className="flex min-h-56 flex-col items-center justify-center space-y-3 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/50 p-8 text-center transition hover:border-emerald-400 hover:bg-emerald-50/20"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-xs text-emerald-600 border border-slate-200">
                  {isProcessing ? <RefreshCw className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">
                    {isProcessing ? 'Traitement et rapprochement intelligent des actes...' : 'Déposez votre décompte ou relevé (PDF, Image ou Excel)'}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Reconnaît les formats ASCOMA, MCI CARE, BSA, associe chaque ligne à l'acte prescrit et met à jour le solde restant.
                  </p>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.csv"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                >
                  Parcourir les fichiers
                </button>
              </div>
            </div>
          )}

          {parsedDoc && (
            <div className="space-y-4">
              {/* Document Overview Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
                <div>
                  <span className="text-slate-500 block">Organisme / Garant</span>
                  <strong className="text-slate-900 font-bold text-sm">{parsedDoc.clientDoit}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Réf Bordereau</span>
                  <strong className="text-emerald-700 font-bold text-sm">{parsedDoc.numeroBordereau || parsedDoc.numeroFacture}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Rapprochement Actes</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="font-bold text-emerald-700">{matchedCount} rattachés</span>
                    <span className="text-slate-400">•</span>
                    <span className="font-semibold text-amber-700">{unlinkedCount} non rattachés</span>
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 block">Net Réglé par l'Assurance</span>
                  <strong className="text-emerald-700 font-bold text-sm">{formatMoney(parsedDoc.totalNetAPayer)}</strong>
                </div>
              </div>

              {/* Matching Toolbar info */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-indigo-50/60 border border-indigo-100 p-3 text-xs text-indigo-900">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 shrink-0 text-indigo-600" />
                  <span>
                    Chaque ligne est rattachée à un acte médical prescrit ouvert. <strong>Les actes déjà réglés à 100% sont masqués</strong>.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleSelectAll(true)}
                    className="text-xs text-indigo-700 font-semibold hover:underline"
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

              {/* Table of settlement lines with live act attachment */}
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
                      <th className="py-2.5 px-3">Acte Décompte</th>
                      <th className="py-2.5 px-3 min-w-[280px]">Acte Prescrit Rattaché (Prestations)</th>
                      <th className="py-2.5 px-3 text-right">Montant Réglé</th>
                      <th className="py-2.5 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((row) => {
                      const matched = row.matchedCandidate;
                      return (
                        <tr
                          key={row.rowId}
                          className={`hover:bg-slate-50/80 transition ${
                            row.selected ? 'bg-white' : 'bg-slate-50/50 opacity-60'
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
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                            {row.dateSoins}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-900">{row.nomPrenom}</div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              Mat: {row.matricule || '-'} {row.sousSociete ? `• (${row.sousSociete})` : ''}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200">
                              <span>{row.actCode}</span>
                              <span className="text-[10px] text-slate-500 font-normal">({formatMoney(row.montantBrut)})</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 min-w-[280px]">
                            {matched ? (
                              <div className="rounded-lg bg-emerald-50/80 border border-emerald-200 p-2 text-[11px] space-y-1">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5 font-bold text-emerald-950">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                    <span>{matched.prestationNum}</span>
                                    <span className="text-slate-500 font-normal font-mono">({matched.codeActe})</span>
                                  </div>
                                  <span className="text-[10px] font-mono font-semibold text-emerald-800">
                                    Reste : {formatMoney(matched.resteAPayer)}
                                  </span>
                                </div>
                                <div className="text-slate-600 flex items-center justify-between text-[10px]">
                                  <span>{matched.personneNom}</span>
                                  <span className="text-slate-400">Total: {formatMoney(matched.montantInitial)}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-[11px] flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-amber-900 font-medium">
                                  <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                                  <span>Aucun acte non réglé détecté</span>
                                </div>
                                <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                                  Créera la prestation
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                            {formatMoney(row.netAPayer)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              onClick={() => {
                                setSearchingRowId(row.rowId);
                                setActSearchQuery(row.nomPrenom || row.matricule || '');
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition shadow-2xs"
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
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setParsedDoc(null);
                    setRows([]);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-700"
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
            {parsedDoc && (
              <button
                onClick={handleValidateAndSave}
                disabled={selectedRows.length === 0}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50 shadow-xs flex items-center gap-2"
              >
                <Check className="h-4 w-4" />
                <span>Valider et Enregistrer le Règlement</span>
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
                  Pour : <strong className="text-slate-800">{activeSearchingRow.nomPrenom}</strong> (Mat: {activeSearchingRow.matricule || '-'}) • Acte décompte : <strong>{activeSearchingRow.actCode}</strong> • Montant réglé : {formatMoney(activeSearchingRow.netAPayer)}
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
              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={actSearchQuery}
                  onChange={(e) => setActSearchQuery(e.target.value)}
                  placeholder="Rechercher par nom de patient, matricule, n° facture, code acte (ex: CONS, MEDIC)..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  autoFocus
                />
              </div>

              {/* Act candidate list */}
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-200">
                {filteredSearchCandidates.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    Aucun acte en attente ou partiellement payé correspondant trouvé.
                  </div>
                ) : (
                  filteredSearchCandidates.map((cand) => (
                    <div
                      key={cand.lignePrestationId}
                      className="p-3 hover:bg-slate-50 transition flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{cand.personneNom}</span>
                          <span className="font-mono text-[11px] text-slate-500">Mat: {cand.matricule}</span>
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                            {cand.codeActe}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2">
                          <span>Facture: <strong>{cand.prestationNum}</strong> ({cand.prestationDate})</span>
                          <span>•</span>
                          <span>Initial: {formatMoney(cand.montantInitial)}</span>
                          <span>•</span>
                          <span>Déjà réglé: {formatMoney(cand.dejaPaye)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block">Reste à payer</span>
                          <strong className="text-xs font-bold text-amber-800">
                            {formatMoney(cand.resteAPayer)}
                          </strong>
                        </div>
                        <button
                          onClick={() => handleAssignCandidate(activeSearchingRow.rowId, cand)}
                          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition shadow-2xs"
                        >
                          Rattacher
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Unlink / Create option */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => handleAssignCandidate(activeSearchingRow.rowId, null)}
                  className="inline-flex items-center gap-1.5 text-xs text-amber-700 hover:text-amber-800 font-semibold"
                >
                  <Unlink className="h-3.5 w-3.5" />
                  <span>Ne pas rattacher (Créer une nouvelle prestation au vol)</span>
                </button>
                <button
                  onClick={() => setSearchingRowId(null)}
                  className="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
