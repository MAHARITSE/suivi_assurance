import React, { useState, useRef } from 'react';
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
  X
} from 'lucide-react';
import { Prestation, Paiement, Societe, Personne, Famille } from '../types';
import { formatMoney, generateId } from '../utils/formatters';
import * as XLSX from 'xlsx';

interface ImportationViewProps {
  societes: Societe[];
  personnes: Personne[];
  prestations: Prestation[];
  onImportPrestations: (newPrestations: Prestation[]) => void;
  onImportPaiements: (newPaiement: Paiement, updatedPrestations: Prestation[]) => void;
}

interface ParsedRow {
  index: number;
  facture: string;
  date: string;
  nom: string;
  matricule: string;
  societeNom: string;
  montantTotal: number;
  montantPaye: number;
  ticketModerateur: number;
  montantExclu: number;
  commentaire: string;
  status: 'valid' | 'warning' | 'error';
  statusMsg: string;
  matchedPersonneId?: string;
  matchedSocieteId?: string;
  matchedPrestationId?: string;
}

export const ImportationView: React.FC<ImportationViewProps> = ({
  societes,
  personnes,
  prestations,
  onImportPrestations,
  onImportPaiements,
}) => {
  const [importMode, setImportMode] = useState<'prestations' | 'paiements'>('paiements');
  const [fileData, setFileData] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Download Sample Template files (EXEMPLAIRE FACTURE & EXEMPLAIRE PAIEMENT)
  const handleDownloadSample = (type: 'facture' | 'paiement') => {
    let sampleData: any[] = [];
    let name = '';

    if (type === 'facture') {
      name = 'EXEMPLAIRE_FACTURE.xlsx';
      sampleData = [
        {
          'Num Facture': 'FACT-2025-050',
          'Date Soins': '2025-02-28',
          'Nom Adherent': 'RAKOTONDRABE Haja',
          'Matricule': 'MAT-1049',
          'Societe': 'AXA Assurances Santé',
          'Sous Societe': 'Direction Générale',
          'Code Acte': 'CONS',
          'Description Acte': 'Consultation spécialiste',
          'Montant Facture': 45000,
          'Observations': 'Régulier',
        },
        {
          'Num Facture': 'FACT-2025-051',
          'Date Soins': '2025-03-01',
          'Nom Adherent': 'RASOAMALALA Bakoly',
          'Matricule': 'MAT-3315',
          'Societe': 'AXA Assurances Santé',
          'Sous Societe': 'Siège',
          'Code Acte': 'PHAR',
          'Description Acte': 'Médicaments prescrits',
          'Montant Facture': 68000,
          'Observations': 'Pharmacie remboursable',
        },
      ];
    } else {
      name = 'EXEMPLAIRE_PAIEMENT.xlsx';
      sampleData = [
        {
          'Num Facture': 'FACT-2025-001',
          'Date Reglement': '2025-02-20',
          'Nom Adherent': 'RAKOTONDRABE Haja',
          'Matricule': 'MAT-1049',
          'Societe': 'AXA Assurances Santé',
          'Montant Facture': 185000,
          'Montant Regle': 148000,
          'Ticket Moderateur': 37000,
          'Montant Exclu': 0,
          'Observations': 'Virement mensuel',
        },
        {
          'Num Facture': 'FACT-2025-020',
          'Date Reglement': '2025-02-20',
          'Nom Adherent': 'RANDRIAMAMPIANINA Faly',
          'Matricule': 'MAT-2280',
          'Societe': 'Allianz Madagascar',
          'Montant Facture': 1450000,
          'Montant Regle': 1160000,
          'Ticket Moderateur': 290000,
          'Montant Exclu': 0,
          'Observations': 'Prise en charge validée',
        },
      ];
    }

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Modele');
    XLSX.writeFile(wb, name);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setFileName(file.name);
    processFile(file);
  };

  const processFile = (file: File) => {
    setIsProcessing(true);
    setImportSuccessMsg(null);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws);

        const rows: ParsedRow[] = rawJson.map((row, idx) => {
          // Normalize column lookups with case insensitivity
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
          const societeNom = String(getVal(['Societe', 'Assurance', 'Assureur', 'Nom Societe']) || '');
          const montantTotal = Number(getVal(['Montant Facture', 'Total Facture', 'Total', 'Montant'])) || 0;
          const montantPaye = Number(getVal(['Montant Regle', 'Montant Paye', 'Paye', 'Regle', 'Total Paye'])) || Math.round(montantTotal * 0.8);
          const ticketModerateur = Number(getVal(['Ticket Moderateur', 'Moderateur', 'Copay', 'Participation'])) || Math.max(0, montantTotal - montantPaye);
          const montantExclu = Number(getVal(['Montant Exclu', 'Exclu', 'Rejet', 'Non Pris En Charge'])) || 0;
          const commentaire = String(getVal(['Observations', 'Commentaire', 'Remarque', 'Motif']) || 'Importation automatique Excel');

          // Check matching against local DB
          const matchedPersonne = personnes.find(p => 
            (matricule && p.matricule.toLowerCase() === matricule.toLowerCase()) ||
            (nom && p.nomPrenom.toLowerCase().includes(nom.toLowerCase())) ||
            (nom && nom.toLowerCase().includes(p.nomPrenom.toLowerCase()))
          );

          const matchedSociete = societes.find(s => 
            (societeNom && s.nom.toLowerCase().includes(societeNom.toLowerCase())) ||
            (societeNom && s.code.toLowerCase() === societeNom.toLowerCase())
          ) || (matchedPersonne ? societes.find(s => s.id === matchedPersonne.societeId) : societes[0]);

          const matchedPrestation = prestations.find(p => p.numeroFacture.toLowerCase() === facture.toLowerCase());

          let status: 'valid' | 'warning' | 'error' = 'valid';
          let statusMsg = 'Prêt à importer';

          if (importMode === 'paiements') {
            if (!matchedPrestation) {
              status = 'warning';
              statusMsg = 'Facture non trouvée - Créera un nouveau règlement autonome';
            } else {
              statusMsg = `Correspondance trouvée : Facture ${matchedPrestation.numeroFacture}`;
            }
          }

          return {
            index: idx + 1,
            facture,
            date,
            nom,
            matricule,
            societeNom: matchedSociete?.nom || societeNom || 'Société Principale',
            montantTotal,
            montantPaye,
            ticketModerateur,
            montantExclu,
            commentaire,
            status,
            statusMsg,
            matchedPersonneId: matchedPersonne?.id,
            matchedSocieteId: matchedSociete?.id,
            matchedPrestationId: matchedPrestation?.id,
          };
        });

        setFileData(rows);
      } catch (err: any) {
        alert("Erreur lors de la lecture du fichier Excel: " + (err.message || err));
      } finally {
        setIsProcessing(false);
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleCommitImport = () => {
    if (fileData.length === 0) return;

    if (importMode === 'prestations') {
      const newPrestations: Prestation[] = fileData.map(row => {
        const persId = row.matchedPersonneId || personnes[0]?.id || 'per-1';
        const socId = row.matchedSocieteId || societes[0]?.id || 'soc-1';

        return {
          id: generateId('prest-imp'),
          numeroFacture: row.facture,
          date: row.date,
          societeId: socId,
          sousSociete: 'Importation Fichier',
          personneId: persId,
          totalPrestation: row.montantTotal,
          participation: row.ticketModerateur,
          statut: 'En attente',
          dateCreation: new Date().toISOString().split('T')[0],
          commentaires: row.commentaire,
          lignes: [
            {
              id: generateId('lig-imp'),
              prestationId: '',
              code: 'CONS',
              libelle: 'Prestation importée',
              totalPrestation: row.montantTotal,
              totalPaye: 0,
            }
          ]
        };
      });

      onImportPrestations(newPrestations);
      setImportSuccessMsg(`Succès : ${newPrestations.length} dossiers de prestations ont été importés.`);
      setFileData([]);
    } else {
      // Import as settlement bordereau
      const bordereauId = generateId('pai-imp');
      const targetSocId = fileData[0]?.matchedSocieteId || societes[0]?.id || 'soc-1';

      const totalReclame = fileData.reduce((s, r) => s + r.montantTotal, 0);
      const totalPaye = fileData.reduce((s, r) => s + r.montantPaye, 0);
      const totalModerateur = fileData.reduce((s, r) => s + r.ticketModerateur, 0);
      const totalExclu = fileData.reduce((s, r) => s + r.montantExclu, 0);

      const lignesPaiement = fileData.map(row => ({
        id: generateId('lp-imp'),
        paiementId: bordereauId,
        lignePrestationId: row.matchedPrestationId || generateId('lig-auto'),
        prestationId: row.matchedPrestationId || generateId('prest-auto'),
        immatriculation: row.matricule,
        nomBaseAssurance: row.nom,
        totalPaye: row.montantPaye,
        ticketModerateur: row.ticketModerateur,
        montantExclu: row.montantExclu,
        commentaire: row.commentaire,
      }));

      const newPaiement: Paiement = {
        id: bordereauId,
        numeroBordereau: `BORD-IMP-${new Date().toISOString().split('T')[0]}`,
        datePaiement: fileData[0]?.date || new Date().toISOString().split('T')[0],
        dateSaisie: new Date().toISOString().split('T')[0],
        societeId: targetSocId,
        modePaiement: 'Virement bancaire',
        referencePaiement: `IMP-${fileName}`,
        totalReclame,
        totalPaye,
        totalModerateur,
        totalExclu,
        remise: 0,
        statut: 'Validé',
        notes: `Importation groupée depuis le fichier ${fileName}`,
        lignes: lignesPaiement,
      };

      // Update matching prestations
      const updatedPrestations = prestations.map(p => {
        const found = fileData.find(r => r.facture.toLowerCase() === p.numeroFacture.toLowerCase());
        if (found) {
          return {
            ...p,
            statut: 'Payé' as const,
            lignes: p.lignes.map(l => ({ ...l, totalPaye: l.totalPrestation })),
          };
        }
        return p;
      });

      onImportPaiements(newPaiement, updatedPrestations);
      setImportSuccessMsg(`Succès : Le bordereau de règlement ${newPaiement.numeroBordereau} avec ${fileData.length} lignes a été importé et rapproché.`);
      setFileData([]);
    }
  };

  return (
    <div id="importation-view" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Module d'Importation & Rapprochement Excel</h2>
          <p className="text-xs text-slate-500">
            Importez des relevés d'assurance, factures ou bordereaux de virement aux formats XLSX / CSV
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleDownloadSample('facture')}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-indigo-600" />
            <span>Modèle Factures (.xlsx)</span>
          </button>

          <button
            onClick={() => handleDownloadSample('paiement')}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Modèle Règlements (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {importSuccessMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between text-emerald-800 text-xs">
          <div className="flex items-center space-x-2 font-medium">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{importSuccessMsg}</span>
          </div>
          <button onClick={() => setImportSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Mode Selector & Drag-Drop Box */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4 md:col-span-1">
          <h3 className="font-bold text-slate-900 text-sm">1. Type d'Importation</h3>
          
          <div className="space-y-2">
            <label
              className={`flex items-start p-3 rounded-xl border cursor-pointer transition ${
                importMode === 'paiements'
                  ? 'border-emerald-500 bg-emerald-50/40 text-emerald-950 font-semibold'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <input
                type="radio"
                name="importMode"
                checked={importMode === 'paiements'}
                onChange={() => setImportMode('paiements')}
                className="mt-1 text-emerald-600 focus:ring-emerald-500"
              />
              <div className="ml-3 text-xs">
                <span className="block font-bold">Bordereau de Règlements</span>
                <span className="text-slate-500 font-normal">
                  Rapprochement de virements assurance, tickets modérateurs et exclusions reçus
                </span>
              </div>
            </label>

            <label
              className={`flex items-start p-3 rounded-xl border cursor-pointer transition ${
                importMode === 'prestations'
                  ? 'border-indigo-500 bg-indigo-50/40 text-indigo-950 font-semibold'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <input
                type="radio"
                name="importMode"
                checked={importMode === 'prestations'}
                onChange={() => setImportMode('prestations')}
                className="mt-1 text-indigo-600 focus:ring-indigo-500"
              />
              <div className="ml-3 text-xs">
                <span className="block font-bold">Factures de Prestations</span>
                <span className="text-slate-500 font-normal">
                  Enregistrement en masse de factures médicales et dossiers de soins engagés
                </span>
              </div>
            </label>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-[11px] text-slate-600 space-y-1">
            <span className="font-bold block text-slate-800">Colonnes reconnues :</span>
            <p>N° Facture, Date, Nom Adhérent, Matricule, Société, Montant Facture, Montant Réglé, Ticket Modérateur, Exclusions.</p>
          </div>
        </div>

        {/* Dropzone */}
        <div className="bg-white p-6 rounded-xl border-2 border-dashed border-slate-300 hover:border-indigo-500 transition shadow-xs flex flex-col items-center justify-center text-center md:col-span-2 space-y-3"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <div className="w-14 h-14 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Upload className="w-6 h-6" />
          </div>

          <div className="space-y-1">
            <h4 className="font-bold text-slate-800 text-sm">
              {fileName ? fileName : 'Déposez votre fichier Excel ici ou parcourez vos dossiers'}
            </h4>
            <p className="text-xs text-slate-500">Formats supportés : .xlsx, .xls, .csv (jusqu'à 10 Mo)</p>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xlsx,.xls,.csv"
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-xs"
          >
            Sélectionner un fichier Excel
          </button>
        </div>
      </div>

      {/* Preview Table of Parsed Rows */}
      {fileData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Aperçu et Contrôle des Données Détectées ({fileData.length} lignes)
              </h3>
              <p className="text-xs text-slate-500">
                Vérifiez les montants et les correspondances avec les adhérents avant de valider.
              </p>
            </div>

            <button
              id="btn-confirm-import"
              onClick={handleCommitImport}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition"
            >
              <Check className="w-4 h-4" />
              <span>Intégrer les {fileData.length} lignes dans l'application</span>
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
                  <th className="py-2.5 px-3">Société</th>
                  <th className="py-2.5 px-3 text-right">Montant Facture</th>
                  <th className="py-2.5 px-3 text-right">Montant Réglé</th>
                  <th className="py-2.5 px-3 text-right">Ticket Modérateur</th>
                  <th className="py-2.5 px-3 text-right">Exclu</th>
                  <th className="py-2.5 px-3">Statut Rapprochement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {fileData.map((row) => (
                  <tr key={row.index} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 text-slate-400 font-mono">{row.index}</td>
                    <td className="py-2.5 px-3 font-bold text-indigo-700">{row.facture}</td>
                    <td className="py-2.5 px-3 text-slate-600">{row.date}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-800">{row.nom}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{row.matricule || 'N/A'}</div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{row.societeNom}</td>
                    <td className="py-2.5 px-3 text-right font-medium text-slate-900">{formatMoney(row.montantTotal)}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-700">{formatMoney(row.montantPaye)}</td>
                    <td className="py-2.5 px-3 text-right text-amber-700 font-medium">{formatMoney(row.ticketModerateur)}</td>
                    <td className="py-2.5 px-3 text-right text-rose-600">{formatMoney(row.montantExclu)}</td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        row.status === 'valid'
                          ? 'bg-emerald-100 text-emerald-800'
                          : row.status === 'warning'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {row.statusMsg}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
