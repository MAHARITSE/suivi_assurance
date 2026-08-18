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
  Info
} from 'lucide-react';
import { Prestation, LignePrestation, Societe, Personne, Famille, ParsedFactureAssurance } from '../types';
import { formatMoney, generateId } from '../utils/formatters';
import { salfaSampleInvoice } from '../data/salfaInvoiceSample';
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
  const [parsedInvoice, setParsedInvoice] = useState<ParsedFactureAssurance | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [autoCreateMissingSocietes, setAutoCreateMissingSocietes] = useState(true);
  const [autoCreateMissingPersonnes, setAutoCreateMissingPersonnes] = useState(true);
  const [selectedLines, setSelectedLines] = useState<Record<number, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleLoadSample = () => {
    setIsProcessing(true);
    setErrorMessage(null);
    setTimeout(() => {
      setParsedInvoice(salfaSampleInvoice);
      const initialSelected: Record<number, boolean> = {};
      salfaSampleInvoice.lignes.forEach((_, idx) => {
        initialSelected[idx] = true;
      });
      setSelectedLines(initialSelected);
      setIsProcessing(false);
    }, 200);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
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
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonRows: any[] = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

            if (jsonRows.length === 0) {
              throw new Error('Le fichier Excel est vide.');
            }

            const lignes = jsonRows.map((row, idx) => {
              const getVal = (keys: string[]) => {
                for (const k of keys) {
                  const foundKey = Object.keys(row).find(rk => rk.toLowerCase().trim() === k.toLowerCase().trim());
                  if (foundKey && row[foundKey] !== undefined && row[foundKey] !== '') {
                    return row[foundKey];
                  }
                }
                return '';
              };

              const nom = String(getVal(['Nom', 'Nom et Prénom', 'Adhérent', 'Patient', 'Nom Adherent', 'Assuré']) || `Patient ${idx + 1}`);
              const matricule = String(getVal(['Matricule', 'N° Matricule', 'Immatriculation', 'Code']) || '').trim();
              const dateSoins = String(getVal(['Date', 'Date Soins', 'Date des Soins', 'Date Prestation']) || new Date().toISOString().split('T')[0]);
              const montantBrut = Number(getVal(['Montant Total Brut', 'Montant Brut', 'Montant Total', 'Total Prestation', 'Montant Facture', 'Fr. Réels'])) || 0;
              const participation = Number(getVal(['Ticket Moderateur', 'Ticket Modérateur', 'Part Assuré', 'Participation', 'Franchise'])) || 0;
              const netAPayer = Number(getVal(['Net A Payer', 'Net Payé', 'Montant Remboursé', 'Prise En Charge', 'Montant Réglé'])) || (montantBrut - participation);
              const sousSoc = String(getVal(['Sous-Societe', 'Sous-Société', 'Sous Societe', 'Département', 'Section']) || '');
              const socName = String(getVal(['Societe', 'Société', 'Organisme', 'Client']) || 'BSA');
              const actesRaw = String(getVal(['Acte médicale/Prix', 'Acte médicale / Prix', 'Acte medicale/Prix', 'Actes Médicaux', 'Actes', 'Prestations', 'Detail Actes Medicaux']) || 'CONS : ' + montantBrut);

              const parsedActes = parseActesFromText(actesRaw, montantBrut);

              return {
                numeroLigne: idx + 1,
                dateSoins,
                matricule,
                nomPrenom: nom,
                societeAffiliee: socName,
                sousSociete: sousSoc,
                actes: parsedActes,
                actesTexte: actesRaw,
                montantBrut,
                montantExclu: 0,
                baseReglement: montantBrut,
                participation,
                netAPayer,
                observations: 'Import Excel'
              };
            });

            const totalBrut = lignes.reduce((s, l) => s + l.montantBrut, 0);
            const totalPart = lignes.reduce((s, l) => s + l.participation, 0);
            const totalNet = lignes.reduce((s, l) => s + l.netAPayer, 0);

            const doc: ParsedFactureAssurance = {
              documentType: 'facture',
              etablissement: 'CENTRE MÉDICAL / HÔPITAL SALFA',
              numeroFacture: `FACT-SALFA-${Date.now().toString().substring(6)}`,
              moisPriseEnCharge: new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
              clientDoit: 'BSA',
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
        if ((file as any).type) {
          // hint for server prompt
        }

        const response = await fetch('/api/parse-invoice', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Erreur lors du traitement : ${response.statusText}`);
        }

        const json: any = await response.json();
        const data: ParsedFactureAssurance = json.data || json;
        if (!data || !data.lignes) throw new Error(json.error || 'Réponse vide du serveur');
        setParsedInvoice(data);
        const initialSelected: Record<number, boolean> = {};
        data.lignes.forEach((_, i) => { initialSelected[i] = true; });
        setSelectedLines(initialSelected);
        setIsProcessing(false);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors du traitement du document.');
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
      const cleanMatricule = (ligne.matricule || '').replace(/\s+/g, '');
      let matchedPer = personnes.find(p => 
        (cleanMatricule && p.matricule.replace(/\s+/g, '').toLowerCase() === cleanMatricule.toLowerCase()) ||
        (ligne.nomPrenom && p.nomPrenom.toLowerCase().includes(ligne.nomPrenom.toLowerCase()))
      );

      if (!matchedPer && autoCreateMissingPersonnes) {
        matchedPer = {
          id: generateId(`per-new-${idx}`),
          matricule: cleanMatricule || `MAT-${100000 + idx}`,
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

            return {
              id: generateId(`lig-${idx}-${actIdx}`),
              prestationId: prestId,
              code: a.code || 'CONS',
              libelle: a.libelle || a.code,
              totalPrestation: actMontant,
              totalPaye: actPaye,
            };
          })
        : [
            {
              id: generateId(`lig-${idx}`),
              prestationId: prestId,
              code: 'CONS',
              libelle: ligne.actesTexte || 'Consultation & Soins',
              totalPrestation: ligne.montantBrut,
              totalPaye: 0,
            }
          ];

      return {
        id: prestId,
        numeroFacture: parsedInvoice.numeroFacture || `FA-SALFA-${idx + 1}`,
        date: ligne.dateSoins || parsedInvoice.dateEmission || new Date().toISOString().split('T')[0],
        societeId: matchedSoc?.id || societes[0]?.id || 'soc-1',
        sousSociete: sousSoc,
        personneId: matchedPer?.id || personnes[0]?.id || 'per-1',
        totalPrestation: ligne.montantBrut,
        participation: ligne.participation,
        statut: 'En attente' as const,
        dateCreation: new Date().toISOString().split('T')[0],
        commentaires: `Facture Hôpital SALFA (${ligne.observations || parsedInvoice.numeroFacture})`,
        lignes: subLines,
      };
    });

    onImportPrestations(newPrestations, createdSocietes, createdPersonnes);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-5xl rounded-2xl bg-white shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Importation Facture Médicale SALFA
              </h3>
              <p className="text-xs text-slate-500">
                Créez directement les dossiers de soins et prestations avec détail des actes par patient.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMessage && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {!parsedInvoice && (
            <div className="space-y-4">
              {/* Quick sample loader */}
              <div className="flex items-center justify-between rounded-xl bg-indigo-50/70 border border-indigo-100 p-4">
                <div>
                  <div className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-indigo-600" />
                    <span>Exemple réel Hôpital SALFA (FA-05/BSA)</span>
                  </div>
                  <p className="text-xs text-indigo-700 mt-0.5">
                    25 patients, sous-sociétés BFV/Accès Banques/Orange et multi-actes (CONS, MEDIC, DENT, LABO).
                  </p>
                </div>
                <button
                  onClick={handleLoadSample}
                  disabled={isProcessing}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-indigo-500 shadow-xs"
                >
                  Charger l'exemple SALFA
                </button>
              </div>

              {/* Upload Drop Zone */}
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
                className="flex min-h-56 flex-col items-center justify-center space-y-3 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/50 p-8 text-center transition hover:border-indigo-400 hover:bg-indigo-50/20"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-xs text-indigo-600 border border-slate-200">
                  {isProcessing ? <RefreshCw className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">
                    {isProcessing ? 'Extraction de la facture SALFA en cours...' : 'Déposez votre facture SALFA (PDF, Image ou Excel)'}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Détecte automatiquement les sous-sociétés entre parenthèses et les actes sous <strong>Acte médicale / Prix</strong>.
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
                  Parcourir un fichier
                </button>
              </div>
            </div>
          )}

          {parsedInvoice && (
            <div className="space-y-4">
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
            <button
              onClick={onClose}
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
